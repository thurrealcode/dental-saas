import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendText } from '@/lib/evolution/client'

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = 'menu' | 'procedure' | 'professional' | 'slot' | 'confirm'

interface Session {
  phone: string
  company_id: string
  step: Step
  procedure_id: string | null
  professional_id: string | null
  slot_start: string | null
  slot_end: string | null
  page: number
  push_name: string | null
  expires_at: string
}

interface Procedure { id: string; name: string; duration_minutes: number; price: number | null }
interface Professional { id: string; name: string; specialty: string | null }
interface Availability { day_of_week: number; start_time: string; end_time: string }
interface BookedSlot { start_at: string; end_at: string }

// ── Constants ─────────────────────────────────────────────────────────────────

const SLOTS_PER_PAGE = 5
const DAYS_AHEAD = 14
const SESSION_TTL_MIN = 30

// ── Slot generation ───────────────────────────────────────────────────────────

function generateSlots(
  avail: Availability[],
  booked: BookedSlot[],
  durationMin: number,
  page: number,
): { slots: Date[]; hasMore: boolean } {
  const collected: Date[] = []
  const need = (page + 1) * SLOTS_PER_PAGE + 1
  const now = Date.now()
  const durMs = durationMin * 60_000

  const bookedRanges = booked.map(b => [+new Date(b.start_at), +new Date(b.end_at)] as [number, number])

  const byDow = new Map<number, Availability[]>()
  for (const a of avail) {
    const arr = byDow.get(a.day_of_week) ?? []
    arr.push(a)
    byDow.set(a.day_of_week, arr)
  }

  // Brazil is fixed UTC-3 (no DST since 2019)
  const BR_OFFSET_MS = 3 * 3600_000

  for (let dayOffset = 1; dayOffset <= DAYS_AHEAD && collected.length < need; dayOffset++) {
    // Shift UTC to Brazil time, then read calendar date components
    const brDay = new Date(now - BR_OFFSET_MS + dayOffset * 86_400_000)
    const dow = brDay.getUTCDay()
    const yyyy = brDay.getUTCFullYear()
    const mm = String(brDay.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(brDay.getUTCDate()).padStart(2, '0')

    for (const w of byDow.get(dow) ?? []) {
      // Supabase time columns return "HH:MM:SS" — take only "HH:MM"
      const startHHMM = w.start_time.substring(0, 5)
      const endHHMM = w.end_time.substring(0, 5)
      const ws = +new Date(`${yyyy}-${mm}-${dd}T${startHHMM}:00-03:00`)
      const we = +new Date(`${yyyy}-${mm}-${dd}T${endHHMM}:00-03:00`)

      for (let t = ws; t + durMs <= we; t += durMs) {
        if (t <= now) continue
        const clash = bookedRanges.some(([bs, be]) => t < be && t + durMs > bs)
        if (!clash) {
          collected.push(new Date(t))
          if (collected.length >= need) break
        }
      }
      if (collected.length >= need) break
    }
  }

  return {
    slots: collected.slice(page * SLOTS_PER_PAGE, (page + 1) * SLOTS_PER_PAGE),
    hasMore: collected.length > (page + 1) * SLOTS_PER_PAGE,
  }
}

function fmtSlot(d: Date) {
  return d.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short', day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit',
  })
}

function fmtTime(d: Date) {
  return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })
}

// ── DB helpers ────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any

async function loadProcedures(db: DB, companyId: string): Promise<Procedure[]> {
  const { data } = await db.from('procedures').select('id, name, duration_minutes, price').eq('company_id', companyId).order('name')
  return (data as Procedure[]) ?? []
}

async function loadProfessionals(db: DB, companyId: string, procedureId: string): Promise<Professional[]> {
  const { data: links } = await db.from('professional_procedures').select('professional_id').eq('company_id', companyId).eq('procedure_id', procedureId)
  const ids = (links as { professional_id: string }[] | null)?.map(l => l.professional_id)

  const q = db.from('professionals').select('id, name, specialty').eq('company_id', companyId).order('name')
  const { data } = ids?.length ? await q.in('id', ids) : await q
  return (data as Professional[]) ?? []
}

async function loadAvailableSlots(db: DB, companyId: string, professionalId: string, durationMin: number, page: number) {
  const { data: avail } = await db.from('professional_availability').select('day_of_week, start_time, end_time').eq('professional_id', professionalId).eq('company_id', companyId)
  const horizon = new Date(Date.now() + DAYS_AHEAD * 86_400_000).toISOString()
  const { data: booked } = await db.from('appointments').select('start_at, end_at').eq('company_id', companyId).eq('professional_id', professionalId).gte('start_at', new Date().toISOString()).lte('start_at', horizon).in('status', ['scheduled', 'confirmed', 'in_progress'])

  return generateSlots((avail as Availability[]) ?? [], (booked as BookedSlot[]) ?? [], durationMin, page)
}

// ── Message builders ──────────────────────────────────────────────────────────

function msgMenu(clinicName: string) {
  return `Olá! Bem-vindo(a) à ${clinicName} 🦷\n\nComo posso ajudar?\n\n1️⃣ Agendar consulta\n2️⃣ Falar com atendente\n\nDigite o número da opção.`
}

function msgProcedures(procs: Procedure[]) {
  if (!procs.length) return 'Desculpe, não há procedimentos disponíveis no momento.\n\n0. Voltar'
  const lines = procs.map((p, i) => {
    const price = p.price != null ? ` — R$ ${Number(p.price).toFixed(2).replace('.', ',')}` : ''
    return `${i + 1}. ${p.name} (${p.duration_minutes}min${price})`
  }).join('\n')
  return `Qual procedimento você precisa?\n\n${lines}\n\n0. Voltar`
}

function msgProfessionals(profs: Professional[]) {
  if (!profs.length) return 'Não há profissionais disponíveis para este procedimento.\n\n0. Voltar'
  const lines = profs.map((p, i) => `${i + 1}. ${p.name}${p.specialty ? ` (${p.specialty})` : ''}`).join('\n')
  return `Escolha o profissional:\n\n${lines}\n\n0. Voltar`
}

function msgSlots(slots: Date[], hasMore: boolean, procName: string, profName: string) {
  if (!slots.length) return `Não há horários disponíveis nos próximos ${DAYS_AHEAD} dias.\n\n0. Voltar`
  const lines = slots.map((s, i) => `${i + 1}. ${fmtSlot(s)}`).join('\n')
  const more = hasMore ? '\nM. Ver mais horários' : ''
  return `Horários disponíveis — ${procName} com ${profName}:\n\n${lines}\n\n0. Voltar${more}`
}

// ── State machine ─────────────────────────────────────────────────────────────

async function processMessage(
  db: DB,
  session: Session,
  input: string,
  clinicName: string,
): Promise<string> {
  const lower = input.trim().toLowerCase()

  // "0" = go back one step from anywhere except menu
  if (lower === '0' && session.step !== 'menu') {
    return await goBack(db, session, clinicName)
  }

  switch (session.step) {
    case 'menu':      return handleMenu(db, session, lower, clinicName)
    case 'procedure': return handleProcedure(db, session, lower)
    case 'professional': return handleProfessional(db, session, lower)
    case 'slot':      return handleSlot(db, session, lower)
    case 'confirm':   return handleConfirm(db, session, lower)
    default:
      session.step = 'menu'
      return msgMenu(clinicName)
  }
}

async function goBack(db: DB, session: Session, clinicName: string): Promise<string> {
  switch (session.step) {
    case 'procedure':
      session.step = 'menu'
      return msgMenu(clinicName)
    case 'professional': {
      session.step = 'procedure'
      const procs = await loadProcedures(db, session.company_id)
      return msgProcedures(procs)
    }
    case 'slot': {
      session.step = 'professional'
      const profs = await loadProfessionals(db, session.company_id, session.procedure_id!)
      return msgProfessionals(profs)
    }
    case 'confirm': {
      session.step = 'slot'
      session.slot_start = null
      session.slot_end = null
      session.page = 0
      const procs = await loadProcedures(db, session.company_id)
      const proc = procs.find(p => p.id === session.procedure_id)
      const profs = await loadProfessionals(db, session.company_id, session.procedure_id!)
      const prof = profs.find(p => p.id === session.professional_id)
      const { slots, hasMore } = await loadAvailableSlots(db, session.company_id, session.professional_id!, proc?.duration_minutes ?? 30, 0)
      return msgSlots(slots, hasMore, proc?.name ?? '', prof?.name ?? '')
    }
    default:
      session.step = 'menu'
      return msgMenu(clinicName)
  }
}

async function handleMenu(db: DB, session: Session, input: string, clinicName: string): Promise<string> {
  if (input === '1') {
    session.step = 'procedure'
    session.procedure_id = null
    session.professional_id = null
    session.slot_start = null
    session.slot_end = null
    session.page = 0
    const procs = await loadProcedures(db, session.company_id)
    return msgProcedures(procs)
  }
  if (input === '2') {
    return 'Em breve um atendente entrará em contato! 👋\n\nSe precisar de mais algo, envie qualquer mensagem.'
  }
  return msgMenu(clinicName)
}

async function handleProcedure(db: DB, session: Session, input: string): Promise<string> {
  const procs = await loadProcedures(db, session.company_id)
  const idx = parseInt(input) - 1
  if (isNaN(idx) || idx < 0 || idx >= procs.length) {
    return `Opção inválida.\n\n${msgProcedures(procs)}`
  }
  session.procedure_id = procs[idx].id
  session.step = 'professional'
  const profs = await loadProfessionals(db, session.company_id, session.procedure_id)
  return msgProfessionals(profs)
}

async function handleProfessional(db: DB, session: Session, input: string): Promise<string> {
  const profs = await loadProfessionals(db, session.company_id, session.procedure_id!)
  const idx = parseInt(input) - 1
  if (isNaN(idx) || idx < 0 || idx >= profs.length) {
    return `Opção inválida.\n\n${msgProfessionals(profs)}`
  }
  session.professional_id = profs[idx].id
  session.step = 'slot'
  session.page = 0

  const procs = await loadProcedures(db, session.company_id)
  const proc = procs.find(p => p.id === session.procedure_id)
  const { slots, hasMore } = await loadAvailableSlots(db, session.company_id, session.professional_id, proc?.duration_minutes ?? 30, 0)
  return msgSlots(slots, hasMore, proc?.name ?? '', profs[idx].name)
}

async function handleSlot(db: DB, session: Session, input: string): Promise<string> {
  const procs = await loadProcedures(db, session.company_id)
  const proc = procs.find(p => p.id === session.procedure_id)
  const profs = await loadProfessionals(db, session.company_id, session.procedure_id!)
  const prof = profs.find(p => p.id === session.professional_id)

  if (input === 'm') {
    session.page += 1
    const { slots, hasMore } = await loadAvailableSlots(db, session.company_id, session.professional_id!, proc?.duration_minutes ?? 30, session.page)
    if (!slots.length) {
      session.page -= 1
      return `Não há mais horários disponíveis.\n\n0. Voltar`
    }
    return msgSlots(slots, hasMore, proc?.name ?? '', prof?.name ?? '')
  }

  const { slots } = await loadAvailableSlots(db, session.company_id, session.professional_id!, proc?.duration_minutes ?? 30, session.page)
  const idx = parseInt(input) - 1
  if (isNaN(idx) || idx < 0 || idx >= slots.length) {
    const { slots: fresh, hasMore } = await loadAvailableSlots(db, session.company_id, session.professional_id!, proc?.duration_minutes ?? 30, session.page)
    return `Opção inválida.\n\n${msgSlots(fresh, hasMore, proc?.name ?? '', prof?.name ?? '')}`
  }

  const slotStart = slots[idx]
  const slotEnd = new Date(slotStart.getTime() + (proc?.duration_minutes ?? 30) * 60_000)
  session.slot_start = slotStart.toISOString()
  session.slot_end = slotEnd.toISOString()
  session.step = 'confirm'

  const price = proc?.price != null ? `\n💰 Valor: R$ ${Number(proc.price).toFixed(2).replace('.', ',')}` : ''
  return `Confirmar agendamento?\n\n📋 Serviço: ${proc?.name}\n👨‍⚕️ Profissional: ${prof?.name}\n📅 ${fmtSlot(slotStart)} — ${fmtTime(slotEnd)}${price}\n\n1. Confirmar ✅\n0. Cancelar ❌`
}

async function handleConfirm(db: DB, session: Session, input: string): Promise<string> {
  if (input !== '1') {
    session.step = 'menu'
    session.procedure_id = null
    session.professional_id = null
    session.slot_start = null
    session.slot_end = null
    return 'Agendamento cancelado. ❌\n\nEnvie qualquer mensagem para voltar ao menu.'
  }

  // Find or create patient
  const { data: existingPatient } = await db.from('patients').select('id').eq('company_id', session.company_id).eq('phone', session.phone).maybeSingle()
  let patientId = existingPatient?.id as string | undefined

  if (!patientId) {
    const { data: newPatient } = await db.from('patients').insert({
      company_id: session.company_id,
      full_name: session.push_name ?? 'Paciente WhatsApp',
      phone: session.phone,
      status: 'lead',
    }).select('id').single()
    patientId = newPatient?.id
  }

  if (!patientId) return 'Erro ao registrar paciente. Tente novamente.'

  const procs = await loadProcedures(db, session.company_id)
  const proc = procs.find(p => p.id === session.procedure_id)
  const slotStart = session.slot_start!
  const slotEnd = session.slot_end!

  const { error } = await db.from('appointments').insert({
    company_id: session.company_id,
    patient_id: patientId,
    professional_id: session.professional_id,
    procedure_id: session.procedure_id,
    start_at: slotStart,
    end_at: slotEnd,
    title: proc?.name ?? 'Consulta',
    status: 'scheduled',
    price: proc?.price ?? null,
    updated_at: new Date().toISOString(),
  })

  if (error) {
    console.error('[bot] appointment insert error', error)
    return 'Erro ao criar agendamento. Por favor, tente novamente.'
  }

  const displayDate = fmtSlot(new Date(slotStart))
  session.step = 'menu'
  session.procedure_id = null
  session.professional_id = null
  session.slot_start = null
  session.slot_end = null

  return `✅ Agendamento confirmado!\n\nNos vemos em ${displayDate}!\n\nEm caso de dúvidas, entre em contato. 😊\n\n─────────────\nEnvie 1 para novo agendamento.`
}

// ── Webhook entry point ───────────────────────────────────────────────────────

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: 'whatsapp-webhook', ts: new Date().toISOString() })
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

    console.log('[bot] webhook received:', body.event, 'instance:', body.instance)

    // Only handle message events
    if (body.event !== 'messages.upsert') return NextResponse.json({ ok: true })

    const data = body.data
    if (!data?.key || data.key.fromMe) return NextResponse.json({ ok: true })

    const remoteJid: string = data.key.remoteJid ?? ''
    // Skip group messages
    if (remoteJid.includes('@g.us')) return NextResponse.json({ ok: true })

    const phone = remoteJid.replace(/@.*$/, '')
    const pushName: string | null = data.pushName ?? null
    const msg = data.message
    const text: string | null =
      msg?.conversation ??
      msg?.extendedTextMessage?.text ??
      msg?.buttonsResponseMessage?.selectedButtonId ??
      msg?.listResponseMessage?.singleSelectReply?.selectedRowId ??
      null

    if (!text) return NextResponse.json({ ok: true })

    const instanceName: string = body.instance ?? ''
    if (!instanceName) return NextResponse.json({ ok: true })

    const db = createServiceClient() as DB

    // Resolve company from Evolution instance name (ignore is_active — may be false during reconnect)
    const { data: integration, error: integErr } = await db
      .from('integrations')
      .select('company_id, config')
      .eq('type', 'whatsapp')
      .filter('config->>instance_name', 'eq', instanceName)
      .maybeSingle()

    console.log('[bot] instance:', instanceName, 'integration:', integration?.company_id ?? null, 'err:', integErr?.message ?? null)

    if (!integration) {
      console.warn('[bot] no integration found for instance:', instanceName)
      return NextResponse.json({ ok: true })
    }

    const companyId: string = integration.company_id

    // Load or create session
    const { data: savedSession } = await db
      .from('bot_sessions')
      .select('*')
      .eq('phone', phone)
      .eq('company_id', companyId)
      .maybeSingle()

    const isExpired = savedSession && new Date(savedSession.expires_at) < new Date()
    const session: Session = (!savedSession || isExpired)
      ? { phone, company_id: companyId, step: 'menu', procedure_id: null, professional_id: null, slot_start: null, slot_end: null, page: 0, push_name: pushName, expires_at: '' }
      : { ...savedSession }

    if (pushName && !session.push_name) session.push_name = pushName

    // Get clinic name
    const { data: company } = await db.from('companies').select('name').eq('id', companyId).single()
    const clinicName: string = company?.name ?? 'Clínica'

    // Process the message
    const reply = await processMessage(db, session, text, clinicName)

    // Save updated session
    const expires = new Date(Date.now() + SESSION_TTL_MIN * 60_000).toISOString()
    await db.from('bot_sessions').upsert({
      phone,
      company_id: companyId,
      step: session.step,
      procedure_id: session.procedure_id,
      professional_id: session.professional_id,
      slot_start: session.slot_start,
      slot_end: session.slot_end,
      page: session.page,
      push_name: session.push_name,
      updated_at: new Date().toISOString(),
      expires_at: expires,
    }, { onConflict: 'phone,company_id' })

    // Send reply
    await sendText(instanceName, phone, reply)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[whatsapp/webhook]', err)
    return NextResponse.json({ ok: true }) // Always 200 to Evolution API
  }
}
