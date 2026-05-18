import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendText } from '@/lib/evolution/client'

// ── Types ──────────────────────────────────────────────────────────────────────

type Step =
  | 'menu'
  | 'procedure'            // booking: pick procedure
  | 'professional'         // booking: pick professional
  | 'slot'                 // booking: pick slot
  | 'confirm'              // booking: confirm new booking
  | 'collect_name'         // booking: collect patient full name before finalising
  | 'manage_action'        // manage: choose action (confirm/cancel/reschedule)
  | 'manage_list'          // manage: pick one of user's appointments
  | 'cancel_confirm'       // cancel: confirm the cancellation
  | 'post_cancel'          // cancel: follow-up choice after successful cancellation
  | 'reschedule_slot'      // reschedule: pick new slot
  | 'reschedule_confirm'   // reschedule: confirm new slot
  | 'human'                // human takeover — bot is silent

type ManageFlow = 'confirm_appt' | 'cancel' | 'reschedule' | null

interface Session {
  phone: string
  company_id: string
  step: Step
  flow: ManageFlow
  appointment_id: string | null   // appointment being managed (cancel/reschedule)
  procedure_id: string | null
  professional_id: string | null
  slot_start: string | null
  slot_end: string | null
  page: number
  push_name: string | null
  expires_at: string
}

interface ApptEntry {
  id: string
  title: string
  status: string
  start_at: string
  end_at: string
  procedure_id: string | null
  professional_id: string | null
  professionals: { name: string } | null
  procedures: { name: string; duration_minutes: number } | null
}

interface Procedure    { id: string; name: string; duration_minutes: number; price: number | null }
interface Professional { id: string; name: string; specialty: string | null }
interface Availability { day_of_week: number; start_time: string; end_time: string }
interface BookedSlot   { start_at: string; end_at: string }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any

// ── Constants ──────────────────────────────────────────────────────────────────

const SLOTS_PER_PAGE  = 5
const DAYS_AHEAD      = 14
const SESSION_TTL_MIN = 60

// ── Slot generation ───────────────────────────────────────────────────────────

function generateSlots(
  avail: Availability[],
  booked: BookedSlot[],
  durationMin: number,
  page: number,
): { slots: Date[]; hasMore: boolean } {
  const collected: Date[] = []
  const need   = (page + 1) * SLOTS_PER_PAGE + 1
  const now    = Date.now()
  const durMs  = durationMin * 60_000
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
    const brDay = new Date(now - BR_OFFSET_MS + dayOffset * 86_400_000)
    const dow  = brDay.getUTCDay()
    const yyyy = brDay.getUTCFullYear()
    const mm   = String(brDay.getUTCMonth() + 1).padStart(2, '0')
    const dd   = String(brDay.getUTCDate()).padStart(2, '0')

    for (const w of byDow.get(dow) ?? []) {
      const startHHMM = w.start_time.substring(0, 5) // "HH:MM:SS" → "HH:MM"
      const endHHMM   = w.end_time.substring(0, 5)
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

// ── Formatters ────────────────────────────────────────────────────────────────

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

// ── Intent detection ──────────────────────────────────────────────────────────

type Intent = 'book' | 'confirm_appt' | 'cancel' | 'reschedule' | 'human' | 'menu' | null

function detectIntent(raw: string): Intent {
  // Normalise: lowercase + strip accents
  const t = raw.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .trim()

  if (/\bagendar|marcar|nova consulta|quero consulta|marcar consulta\b/.test(t)) return 'book'
  if (/\bconfirmar|confirmo|confirmacao|quero confirmar|sim confirmo\b/.test(t)) return 'confirm_appt'
  if (/\bcancelar|desmarcar|nao vou|nao consigo|cancelamento|quero cancelar\b/.test(t)) return 'cancel'
  if (/\bremarcar|reagendar|mudar horario|novo horario|trocar horario|outro horario\b/.test(t)) return 'reschedule'
  if (/\batendente|humano|pessoa|operador|falar com alguem|quero falar|suporte\b/.test(t)) return 'human'
  if (/\bmenu|inicio|comecar|voltar ao menu|ola|oi|bom dia|boa tarde|boa noite\b/.test(t)) return 'menu'
  return null
}

// ── DB helpers ────────────────────────────────────────────────────────────────

async function loadProcedures(db: DB, companyId: string): Promise<Procedure[]> {
  const { data, error } = await db
    .from('procedures')
    .select('id, name, duration_minutes, price')
    .eq('company_id', companyId)
    .order('name')
  if (error) console.error('[bot] loadProcedures:', error.message)
  return (data as Procedure[]) ?? []
}

async function loadProfessionals(db: DB, companyId: string, procedureId?: string | null): Promise<Professional[]> {
  // Try to load only professionals linked to this procedure
  if (procedureId) {
    const { data: links, error: linkErr } = await db
      .from('professional_procedures')
      .select('professional_id')
      .eq('company_id', companyId)
      .eq('procedure_id', procedureId)
    if (!linkErr) {
      const ids = (links as { professional_id: string }[] | null)?.map(l => l.professional_id) ?? []
      if (ids.length > 0) {
        const { data } = await db
          .from('professionals').select('id, name, specialty')
          .eq('company_id', companyId).in('id', ids).order('name')
        if ((data as Professional[])?.length > 0) return data as Professional[]
      }
    }
  }
  // Fallback: all active professionals for this company
  const { data, error } = await db
    .from('professionals').select('id, name, specialty')
    .eq('company_id', companyId).order('name')
  if (error) console.error('[bot] loadProfessionals:', error.message)
  return (data as Professional[]) ?? []
}

async function loadAvailableSlots(
  db: DB, companyId: string, professionalId: string, durationMin: number, page: number,
) {
  const { data: avail, error: availErr } = await db
    .from('professional_availability')
    .select('day_of_week, start_time, end_time')
    .eq('professional_id', professionalId)
    .eq('company_id', companyId)
  if (availErr) console.error('[bot] availability:', availErr.message)

  const horizon = new Date(Date.now() + DAYS_AHEAD * 86_400_000).toISOString()
  const { data: booked, error: bookedErr } = await db
    .from('appointments')
    .select('start_at, end_at')
    .eq('company_id', companyId)
    .eq('professional_id', professionalId)
    .gte('start_at', new Date().toISOString())
    .lte('start_at', horizon)
    .in('status', ['scheduled', 'confirmed', 'in_progress'])
  if (bookedErr) console.error('[bot] booked slots:', bookedErr.message)

  return generateSlots(
    (avail as Availability[]) ?? [],
    (booked as BookedSlot[]) ?? [],
    durationMin,
    page,
  )
}

async function loadPatientAppointments(
  db: DB, companyId: string, phone: string, statusFilter: string[],
): Promise<ApptEntry[]> {
  const { data: patient } = await db
    .from('patients').select('id')
    .eq('company_id', companyId).eq('phone', phone).maybeSingle()
  if (!patient?.id) return []

  const { data, error } = await db
    .from('appointments')
    .select('id, title, status, start_at, end_at, procedure_id, professional_id, professionals(name), procedures(name, duration_minutes)')
    .eq('company_id', companyId)
    .eq('patient_id', patient.id)
    .gte('start_at', new Date().toISOString())
    .in('status', statusFilter)
    .order('start_at')
    .limit(8)
  if (error) console.error('[bot] loadPatientAppointments:', error.message)
  return (data as ApptEntry[]) ?? []
}

// ── Message builders ──────────────────────────────────────────────────────────

function msgMenu(clinicName: string, name?: string | null) {
  const greeting = name ? `Olá, ${name.split(' ')[0]}! 👋` : `Olá! 👋`
  return `${greeting} Bem-vindo(a) à *${clinicName}* 🦷\n\nComo posso ajudar?\n\n1️⃣ Agendar consulta\n2️⃣ Minhas consultas\n3️⃣ Falar com atendente\n\nDigite o número da opção.`
}

function msgManageAction() {
  return `O que deseja fazer?\n\n1️⃣ Confirmar uma consulta\n2️⃣ Cancelar uma consulta\n3️⃣ Remarcar uma consulta\n\n0. Voltar ao menu`
}

function msgManageList(appts: ApptEntry[], flow: ManageFlow) {
  if (!appts.length) {
    const empty = flow === 'confirm_appt'
      ? 'Você não tem consultas aguardando confirmação.'
      : 'Você não tem consultas futuras.'
    return `${empty}\n\n0. Voltar`
  }
  const header = flow === 'confirm_appt'
    ? 'Consultas para confirmar:'
    : flow === 'cancel'
      ? 'Consultas que podem ser canceladas:'
      : 'Consultas para remarcar:'

  const lines = appts.map((a, i) => {
    const prof = (a.professionals as { name: string } | null)?.name
    const date = fmtSlot(new Date(a.start_at))
    return `${i + 1}. *${date}*\n   ${a.title}${prof ? ` · ${prof}` : ''}`
  }).join('\n\n')

  return `${header}\n\n${lines}\n\nDigite o número ou *0* para voltar.`
}

function msgProcedures(procs: Procedure[]) {
  if (!procs.length) return `Não há procedimentos disponíveis no momento.\n\n0. Voltar`
  const lines = procs.map((p, i) => {
    const price = p.price != null ? ` — R$ ${Number(p.price).toFixed(2).replace('.', ',')}` : ''
    return `${i + 1}. ${p.name} (${p.duration_minutes}min${price})`
  }).join('\n')
  return `Qual procedimento você precisa?\n\n${lines}\n\n0. Voltar`
}

function msgProfessionals(profs: Professional[]) {
  if (!profs.length) return `Não há profissionais disponíveis para este procedimento.\n\n0. Voltar`
  const lines = profs.map((p, i) => `${i + 1}. ${p.name}${p.specialty ? ` (${p.specialty})` : ''}`).join('\n')
  return `Escolha o profissional:\n\n${lines}\n\n0. Voltar`
}

function msgSlots(slots: Date[], hasMore: boolean, procName: string, profName: string, page: number) {
  if (!slots.length) return `Não há horários disponíveis nos próximos ${DAYS_AHEAD} dias.\n\n0. Voltar`
  const lines = slots.map((s, i) => `${i + 1}. ${fmtSlot(s)}`).join('\n')
  const pageInfo = page > 0 ? ` (pág. ${page + 1})` : ''
  const moreMsg  = hasMore ? '\n*M* - Ver mais horários' : ''
  return `Horários — *${procName}* com *${profName}*${pageInfo}:\n\n${lines}\n\n0. Voltar${moreMsg}`
}

function msgCancelConfirm(appt: ApptEntry) {
  const prof = (appt.professionals as { name: string } | null)?.name
  return (
    `Deseja cancelar esta consulta?\n\n` +
    `📋 *${appt.title}*${prof ? `\n👨‍⚕️ ${prof}` : ''}\n📅 ${fmtSlot(new Date(appt.start_at))}\n\n` +
    `0 - ❌ Sim, cancelar\n` +
    `1 - ✅ Manter consulta`
  )
}

function msgRescheduleConfirm(appt: ApptEntry, newStart: Date, newEnd: Date) {
  const prof = (appt.professionals as { name: string } | null)?.name
  return `Confirmar remarcação?\n\n📋 *${appt.title}*${prof ? `\n👨‍⚕️ ${prof}` : ''}\n📅 Novo horário: *${fmtSlot(newStart)}* — ${fmtTime(newEnd)}\n\n1. ✅ Confirmar\n0. ❌ Cancelar`
}

// ── Booking flow handlers ─────────────────────────────────────────────────────

async function startBooking(db: DB, session: Session): Promise<string> {
  session.step = 'procedure'
  session.procedure_id = null
  session.professional_id = null
  session.slot_start = null
  session.slot_end = null
  session.page = 0
  const procs = await loadProcedures(db, session.company_id)
  return msgProcedures(procs)
}

async function handleProcedure(db: DB, session: Session, input: string): Promise<string> {
  const procs = await loadProcedures(db, session.company_id)
  const idx = parseInt(input) - 1
  if (isNaN(idx) || idx < 0 || idx >= procs.length) return `Opção inválida.\n\n${msgProcedures(procs)}`
  session.procedure_id = procs[idx].id
  session.step = 'professional'
  const profs = await loadProfessionals(db, session.company_id, session.procedure_id)
  return msgProfessionals(profs)
}

async function handleProfessional(db: DB, session: Session, input: string): Promise<string> {
  const profs = await loadProfessionals(db, session.company_id, session.procedure_id)
  const idx = parseInt(input) - 1
  if (isNaN(idx) || idx < 0 || idx >= profs.length) return `Opção inválida.\n\n${msgProfessionals(profs)}`
  session.professional_id = profs[idx].id
  session.step = 'slot'
  session.page = 0
  const procs = await loadProcedures(db, session.company_id)
  const proc  = procs.find(p => p.id === session.procedure_id)
  const { slots, hasMore } = await loadAvailableSlots(db, session.company_id, session.professional_id, proc?.duration_minutes ?? 30, 0)
  return msgSlots(slots, hasMore, proc?.name ?? '', profs[idx].name, 0)
}

async function handleSlot(db: DB, session: Session, input: string): Promise<string> {
  const procs = await loadProcedures(db, session.company_id)
  const proc  = procs.find(p => p.id === session.procedure_id)
  const profs = await loadProfessionals(db, session.company_id, session.procedure_id)
  const prof  = profs.find(p => p.id === session.professional_id)
  const dur   = proc?.duration_minutes ?? 30

  if (input === 'm') {
    session.page += 1
    const { slots, hasMore } = await loadAvailableSlots(db, session.company_id, session.professional_id!, dur, session.page)
    if (!slots.length) { session.page -= 1; return `Não há mais horários disponíveis.\n\n0. Voltar` }
    return msgSlots(slots, hasMore, proc?.name ?? '', prof?.name ?? '', session.page)
  }

  const { slots } = await loadAvailableSlots(db, session.company_id, session.professional_id!, dur, session.page)
  const idx = parseInt(input) - 1
  if (isNaN(idx) || idx < 0 || idx >= slots.length) {
    const { slots: fresh, hasMore } = await loadAvailableSlots(db, session.company_id, session.professional_id!, dur, session.page)
    return `Opção inválida.\n\n${msgSlots(fresh, hasMore, proc?.name ?? '', prof?.name ?? '', session.page)}`
  }

  const slotStart = slots[idx]
  const slotEnd   = new Date(slotStart.getTime() + dur * 60_000)
  session.slot_start = slotStart.toISOString()
  session.slot_end   = slotEnd.toISOString()
  session.step = 'confirm'

  const price = proc?.price != null ? `\n💰 Valor: R$ ${Number(proc.price).toFixed(2).replace('.', ',')}` : ''
  return `Confirmar agendamento?\n\n📋 Serviço: *${proc?.name}*\n👨‍⚕️ Profissional: *${prof?.name}*\n📅 *${fmtSlot(slotStart)}* — ${fmtTime(slotEnd)}${price}\n\n1. ✅ Confirmar\n0. ❌ Cancelar`
}

// Shared booking logic — called from handleConfirm (patient has name) and handleCollectName
async function createBooking(db: DB, session: Session, patientName: string, clinicAddress: string | null): Promise<string> {
  // Find or create patient, always keeping the most complete name
  const { data: existing } = await db.from('patients')
    .select('id, full_name')
    .eq('company_id', session.company_id)
    .eq('phone', session.phone)
    .maybeSingle()

  let patientId: string | undefined = existing?.id

  if (!patientId) {
    const { data: newP, error: patErr } = await db.from('patients').insert({
      company_id: session.company_id,
      full_name:  patientName,
      phone:      session.phone,
      status:     'lead',
    }).select('id').single()
    if (patErr) {
      console.error('[bot] patient insert:', patErr.message, patErr.details)
      return 'Erro ao registrar paciente. Por favor, tente novamente.'
    }
    patientId = newP?.id
  } else {
    const existingName  = (existing?.full_name as string | null) ?? ''
    const isPlaceholder = !existingName || existingName === 'Paciente WhatsApp' || existingName.trim() === '.'
    if (isPlaceholder || existingName !== patientName) {
      await db.from('patients')
        .update({ full_name: patientName })
        .eq('id', patientId).eq('company_id', session.company_id)
      console.log(`[bot] patient name updated → ${patientName}`)
    }
  }

  if (!patientId) return 'Erro ao registrar paciente. Tente novamente.'

  const procs = await loadProcedures(db, session.company_id)
  const proc  = procs.find(p => p.id === session.procedure_id)
  const profs = await loadProfessionals(db, session.company_id, session.procedure_id)
  const prof  = profs.find(p => p.id === session.professional_id)

  const { error: apptErr } = await db.from('appointments').insert({
    company_id:      session.company_id,
    patient_id:      patientId,
    professional_id: session.professional_id,
    procedure_id:    session.procedure_id,
    start_at:        session.slot_start!,
    end_at:          session.slot_end!,
    title:           proc?.name ?? 'Consulta',
    status:          'scheduled',
    price:           proc?.price ?? null,
    updated_at:      new Date().toISOString(),
  })
  if (apptErr) {
    console.error('[bot] appointment insert:', apptErr.message, apptErr.details)
    return 'Erro ao criar agendamento. Por favor, tente novamente.'
  }

  const displayDate = fmtSlot(new Date(session.slot_start!))
  const priceText   = proc?.price != null ? `\n💰 R$ ${Number(proc.price).toFixed(2).replace('.', ',')}` : ''
  const addrText    = clinicAddress ? `\n📍 ${clinicAddress}` : ''

  // Reset booking state
  session.step = 'menu'
  session.procedure_id = null; session.professional_id = null
  session.slot_start = null;   session.slot_end = null

  return (
    `✅ *Agendamento confirmado!*\n\n` +
    `👤 *${patientName}*\n` +
    `🦷 ${proc?.name ?? 'Consulta'}\n` +
    (prof ? `👨‍⚕️ ${prof.name}\n` : '') +
    `📅 *${displayDate}*` +
    priceText +
    addrText +
    `\n\n─────────────\nEnvie *menu* para mais opções.`
  )
}

async function handleConfirm(db: DB, session: Session, input: string, clinicName: string, clinicAddress: string | null): Promise<string> {
  if (input !== '1') {
    session.step = 'menu'
    session.procedure_id = null; session.professional_id = null
    session.slot_start = null;   session.slot_end = null
    return `Agendamento cancelado.\n\n${msgMenu(clinicName, session.push_name)}`
  }

  // Check if patient already has a real full name
  const { data: existing } = await db.from('patients')
    .select('id, full_name')
    .eq('company_id', session.company_id).eq('phone', session.phone).maybeSingle()

  const storedName  = ((existing?.full_name as string | null) ?? '').trim()
  const hasRealName = storedName.length >= 3 && storedName !== 'Paciente WhatsApp' && storedName !== '.'

  if (hasRealName) {
    session.push_name = storedName
    return createBooking(db, session, storedName, clinicAddress)
  }

  // Need to collect the patient's full name before finalising
  session.step = 'collect_name'
  return `👤 Antes de confirmar, precisamos do seu *nome completo*.\n\nQual é o seu nome?`
}

async function handleCollectName(db: DB, session: Session, input: string, clinicName: string, clinicAddress: string | null): Promise<string> {
  const name = input.trim()

  // Validate: at least 3 chars, must contain at least one letter
  if (name.length < 3 || !/[a-zA-ZÀ-ú]/.test(name)) {
    return `Por favor, informe seu nome completo.\n\nExemplo: *João Silva*`
  }

  // Save collected name to session (overrides WhatsApp display name)
  session.push_name = name
  console.log(`[bot] name collected phone=${session.phone} → ${name}`)
  return createBooking(db, session, name, clinicAddress)
}

// ── Manage flow handlers ──────────────────────────────────────────────────────

async function handleManageAction(db: DB, session: Session, input: string, clinicName: string): Promise<string> {
  if (input === '0') { session.step = 'menu'; return msgMenu(clinicName, session.push_name) }

  const flowMap: Record<string, ManageFlow> = { '1': 'confirm_appt', '2': 'cancel', '3': 'reschedule' }
  const flow = flowMap[input]
  if (!flow) return `Opção inválida.\n\n${msgManageAction()}`

  session.flow = flow
  session.step = 'manage_list'
  const statusFilter = flow === 'confirm_appt' ? ['scheduled'] : ['scheduled', 'confirmed', 'in_progress']
  const appts = await loadPatientAppointments(db, session.company_id, session.phone, statusFilter)
  return msgManageList(appts, flow)
}

async function handleManageList(db: DB, session: Session, input: string, clinicName: string): Promise<string> {
  if (input === '0') { session.step = 'manage_action'; return msgManageAction() }

  const statusFilter = session.flow === 'confirm_appt' ? ['scheduled'] : ['scheduled', 'confirmed', 'in_progress']
  const appts = await loadPatientAppointments(db, session.company_id, session.phone, statusFilter)
  const idx = parseInt(input) - 1
  if (isNaN(idx) || idx < 0 || idx >= appts.length) {
    return `Opção inválida.\n\n${msgManageList(appts, session.flow)}`
  }

  const appt = appts[idx]
  session.appointment_id = appt.id

  if (session.flow === 'confirm_appt') {
    const { error } = await db.from('appointments')
      .update({ status: 'confirmed', updated_at: new Date().toISOString() })
      .eq('id', appt.id).eq('company_id', session.company_id)
    if (error) {
      console.error('[bot] confirm appt:', error.message, appt.id)
      return 'Erro ao confirmar consulta. Tente novamente.'
    }
    const prof = (appt.professionals as { name: string } | null)?.name
    session.step = 'menu'; session.appointment_id = null
    return `✅ *Consulta confirmada!*\n\n📅 ${fmtSlot(new Date(appt.start_at))}${prof ? `\n👨‍⚕️ ${prof}` : ''}\n\nAté lá! 😊\n\n─────────────\nEnvie *menu* para mais opções.`
  }

  if (session.flow === 'cancel') {
    session.step = 'cancel_confirm'
    return msgCancelConfirm(appt)
  }

  if (session.flow === 'reschedule') {
    if (!appt.professional_id) {
      session.step = 'menu'
      return `Esta consulta não tem profissional definido e não pode ser remarcada aqui. Por favor, entre em contato.\n\n─────────────\n${msgMenu(clinicName, session.push_name)}`
    }
    session.professional_id = appt.professional_id
    session.procedure_id    = appt.procedure_id
    session.page = 0
    session.step = 'reschedule_slot'
    const proc    = (appt.procedures as { name: string; duration_minutes: number } | null)
    const profName = (appt.professionals as { name: string } | null)?.name ?? ''
    const { slots, hasMore } = await loadAvailableSlots(db, session.company_id, appt.professional_id, proc?.duration_minutes ?? 30, 0)
    return msgSlots(slots, hasMore, proc?.name ?? appt.title, profName, 0)
  }

  session.step = 'menu'
  return msgMenu(clinicName, session.push_name)
}

async function handleCancelConfirm(db: DB, session: Session, input: string, clinicName: string): Promise<string> {
  console.log(`[bot][cancel_confirm] phone=${session.phone} flow=${session.flow} step=${session.step} input=${JSON.stringify(input)} → ${input === '0' ? 'CANCELAR' : 'MANTER'}`)

  // Anything other than 0 = keep the appointment
  if (input !== '0') {
    console.log(`[bot][cancel_confirm] keeping appointment ${session.appointment_id}`)
    session.step = 'menu'; session.flow = null; session.appointment_id = null
    return `✅ *Consulta mantida.*\n\n${msgMenu(clinicName, session.push_name)}`
  }

  // 0 = confirm cancellation
  console.log(`[bot][cancel_confirm] cancelling appointment ${session.appointment_id}`)

  // Load appointment details BEFORE cancelling — needed for the success message
  const { data: apptData } = await db.from('appointments')
    .select('id, title, start_at, end_at, procedure_id, professional_id, professionals(name), procedures(name, duration_minutes)')
    .eq('id', session.appointment_id!)
    .single()

  const { error } = await db.from('appointments')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', session.appointment_id!).eq('company_id', session.company_id)
  if (error) {
    console.error('[bot][cancel_confirm] DB error:', error.message, session.appointment_id)
    return 'Erro ao cancelar consulta. Por favor, tente novamente.'
  }

  const appt = apptData as ApptEntry | null
  const prof  = (appt?.professionals as { name: string } | null)?.name
  const proc  = (appt?.procedures as { name: string } | null)?.name ?? appt?.title ?? 'Consulta'
  const date  = appt ? fmtSlot(new Date(appt.start_at)) : '—'

  // Full session reset — post_cancel step offers rebook or main menu
  session.step            = 'post_cancel'
  session.flow            = null
  session.appointment_id  = null
  session.procedure_id    = null
  session.professional_id = null
  session.slot_start      = null
  session.slot_end        = null
  session.page            = 0

  console.log(`[bot][cancel_confirm] done — step=post_cancel`)

  return (
    `❌ *Consulta cancelada com sucesso.*\n\n` +
    `📋 *${proc}*\n` +
    (prof ? `👨‍⚕️ ${prof}\n` : '') +
    `📅 ${date}\n\n` +
    `1 - Novo agendamento\n` +
    `2 - Menu principal`
  )
}

async function handlePostCancel(db: DB, session: Session, input: string, clinicName: string): Promise<string> {
  if (input === '1') return startBooking(db, session)
  session.step = 'menu'
  return msgMenu(clinicName, session.push_name)
}

async function handleRescheduleSlot(db: DB, session: Session, input: string): Promise<string> {
  let durationMin = 30
  let procName    = 'Consulta'
  let profName    = ''

  if (session.procedure_id) {
    const procs = await loadProcedures(db, session.company_id)
    const proc  = procs.find(p => p.id === session.procedure_id)
    if (proc) { durationMin = proc.duration_minutes; procName = proc.name }
  }
  if (session.professional_id) {
    const profs = await loadProfessionals(db, session.company_id)
    const prof  = profs.find(p => p.id === session.professional_id)
    if (prof) profName = prof.name
  }

  if (input === 'm') {
    session.page += 1
    const { slots, hasMore } = await loadAvailableSlots(db, session.company_id, session.professional_id!, durationMin, session.page)
    if (!slots.length) { session.page -= 1; return `Não há mais horários disponíveis.\n\n0. Voltar` }
    return msgSlots(slots, hasMore, procName, profName, session.page)
  }

  const { slots } = await loadAvailableSlots(db, session.company_id, session.professional_id!, durationMin, session.page)
  const idx = parseInt(input) - 1
  if (isNaN(idx) || idx < 0 || idx >= slots.length) {
    const { slots: fresh, hasMore } = await loadAvailableSlots(db, session.company_id, session.professional_id!, durationMin, session.page)
    return `Opção inválida.\n\n${msgSlots(fresh, hasMore, procName, profName, session.page)}`
  }

  const newStart = slots[idx]
  const newEnd   = new Date(newStart.getTime() + durationMin * 60_000)
  session.slot_start = newStart.toISOString()
  session.slot_end   = newEnd.toISOString()
  session.step = 'reschedule_confirm'

  // Load appointment to show confirmation message
  const { data: apptData } = await db.from('appointments')
    .select('id, title, status, start_at, end_at, procedure_id, professional_id, professionals(name), procedures(name, duration_minutes)')
    .eq('id', session.appointment_id!).single()

  if (apptData) return msgRescheduleConfirm(apptData as ApptEntry, newStart, newEnd)
  return `Confirmar novo horário?\n\n📅 *${fmtSlot(newStart)}* — ${fmtTime(newEnd)}\n\n1. ✅ Confirmar\n0. ❌ Cancelar`
}

async function handleRescheduleConfirm(db: DB, session: Session, input: string, clinicName: string): Promise<string> {
  if (input !== '1') {
    // Go back to slot selection
    session.step = 'reschedule_slot'
    session.slot_start = null; session.slot_end = null; session.page = 0
    let durationMin = 30; let procName = 'Consulta'; let profName = ''
    if (session.procedure_id) {
      const procs = await loadProcedures(db, session.company_id)
      const proc  = procs.find(p => p.id === session.procedure_id)
      if (proc) { durationMin = proc.duration_minutes; procName = proc.name }
    }
    if (session.professional_id) {
      const profs = await loadProfessionals(db, session.company_id)
      const prof  = profs.find(p => p.id === session.professional_id)
      if (prof) profName = prof.name
    }
    const { slots, hasMore } = await loadAvailableSlots(db, session.company_id, session.professional_id!, durationMin, 0)
    return msgSlots(slots, hasMore, procName, profName, 0)
  }

  const { error } = await db.from('appointments')
    .update({ start_at: session.slot_start!, end_at: session.slot_end!, status: 'scheduled', updated_at: new Date().toISOString() })
    .eq('id', session.appointment_id!).eq('company_id', session.company_id)
  if (error) {
    console.error('[bot] reschedule:', error.message, session.appointment_id)
    return 'Erro ao remarcar consulta. Por favor, tente novamente.'
  }

  const newDate = fmtSlot(new Date(session.slot_start!))
  session.step = 'menu'; session.appointment_id = null
  session.procedure_id = null; session.professional_id = null
  session.slot_start = null;   session.slot_end = null
  return `✅ *Consulta remarcada!*\n\nNovo horário: *${newDate}*\n\nNos vemos em breve! 😊\n\n─────────────\n${msgMenu(clinicName, session.push_name)}`
}

// ── goBack ────────────────────────────────────────────────────────────────────

async function goBack(db: DB, session: Session, clinicName: string): Promise<string> {
  if (session.step === 'procedure') {
    session.step = 'menu'
    return msgMenu(clinicName, session.push_name)
  }
  if (session.step === 'professional') {
    session.step = 'procedure'
    return msgProcedures(await loadProcedures(db, session.company_id))
  }
  if (session.step === 'slot') {
    session.step = 'professional'
    return msgProfessionals(await loadProfessionals(db, session.company_id, session.procedure_id))
  }
  if (session.step === 'collect_name') {
    // Go back to slot confirmation screen
    session.step = 'confirm'
    const procs2 = await loadProcedures(db, session.company_id)
    const proc2  = procs2.find(p => p.id === session.procedure_id)
    const profs2 = await loadProfessionals(db, session.company_id, session.procedure_id)
    const prof2  = profs2.find(p => p.id === session.professional_id)
    const ss = new Date(session.slot_start!), se = new Date(session.slot_end!)
    const price2 = proc2?.price != null ? `\n💰 Valor: R$ ${Number(proc2.price).toFixed(2).replace('.', ',')}` : ''
    return `Confirmar agendamento?\n\n📋 Serviço: *${proc2?.name}*\n👨‍⚕️ Profissional: *${prof2?.name}*\n📅 *${fmtSlot(ss)}* — ${fmtTime(se)}${price2}\n\n1. ✅ Confirmar\n0. ❌ Cancelar`
  }
  if (session.step === 'confirm') {
    session.step = 'slot'; session.slot_start = null; session.slot_end = null; session.page = 0
    const procs = await loadProcedures(db, session.company_id)
    const proc  = procs.find(p => p.id === session.procedure_id)
    const profs = await loadProfessionals(db, session.company_id, session.procedure_id)
    const prof  = profs.find(p => p.id === session.professional_id)
    const { slots, hasMore } = await loadAvailableSlots(db, session.company_id, session.professional_id!, proc?.duration_minutes ?? 30, 0)
    return msgSlots(slots, hasMore, proc?.name ?? '', prof?.name ?? '', 0)
  }
  if (session.step === 'manage_action') {
    session.step = 'menu'
    return msgMenu(clinicName, session.push_name)
  }
  if (session.step === 'manage_list') {
    session.step = 'manage_action'
    return msgManageAction()
  }
  if (session.step === 'post_cancel') {
    session.step = 'menu'
    return msgMenu(clinicName, session.push_name)
  }
  if (session.step === 'cancel_confirm' || session.step === 'reschedule_slot') {
    session.step = 'manage_list'
    const appts = await loadPatientAppointments(db, session.company_id, session.phone, ['scheduled', 'confirmed', 'in_progress'])
    return msgManageList(appts, session.flow)
  }
  if (session.step === 'reschedule_confirm') {
    session.step = 'reschedule_slot'; session.slot_start = null; session.slot_end = null; session.page = 0
    let durationMin = 30; let procName = 'Consulta'; let profName = ''
    if (session.procedure_id) {
      const procs = await loadProcedures(db, session.company_id)
      const p = procs.find(p => p.id === session.procedure_id)
      if (p) { durationMin = p.duration_minutes; procName = p.name }
    }
    if (session.professional_id) {
      const profs = await loadProfessionals(db, session.company_id)
      const p = profs.find(p => p.id === session.professional_id)
      if (p) profName = p.name
    }
    const { slots, hasMore } = await loadAvailableSlots(db, session.company_id, session.professional_id!, durationMin, 0)
    return msgSlots(slots, hasMore, procName, profName, 0)
  }
  // Fallback
  session.step = 'menu'
  return msgMenu(clinicName, session.push_name)
}

// ── Main dispatcher ───────────────────────────────────────────────────────────

async function processMessage(db: DB, session: Session, rawInput: string, clinicName: string, clinicAddress: string | null = null): Promise<string> {
  const input = rawInput.trim()
  const lower = input.toLowerCase()

  console.log(`[bot] phone=${session.phone} step=${session.step} flow=${session.flow} input=${JSON.stringify(input.substring(0, 50))}`)

  // Human takeover: silent until user requests menu
  if (session.step === 'human') {
    if (/\bmenu\b/i.test(lower) || lower === '0') {
      session.step = 'menu'
      return msgMenu(clinicName, session.push_name)
    }
    console.log('[bot] human mode — no reply sent')
    return '' // empty = don't send a reply
  }

  // ── Session sanity guard ─────────────────────────────────────────────────
  // Detect inconsistent state: a manage flow (cancel/reschedule/confirm) left
  // lingering while the session is stuck inside a booking step. This happens
  // when the session was not fully reset in a previous interaction. Auto-reset
  // to menu so the user can start fresh without waiting for the TTL to expire.
  const BOOKING_STEPS = ['procedure', 'professional', 'slot', 'confirm', 'collect_name'] as const
  if (session.flow !== null && BOOKING_STEPS.includes(session.step as typeof BOOKING_STEPS[number])) {
    console.warn(`[bot] inconsistent state phone=${session.phone} step=${session.step} flow=${session.flow} — auto-reset`)
    session.step = 'menu'; session.flow = null; session.appointment_id = null
    session.procedure_id = null; session.professional_id = null
    session.slot_start = null; session.slot_end = null; session.page = 0
    return `_Sessão reiniciada._\n\n${msgMenu(clinicName, session.push_name)}`
  }

  // Global escape: typing "menu" from any active step returns to main menu
  if (lower === 'menu' && session.step !== 'menu') {
    session.step = 'menu'; session.flow = null; session.appointment_id = null
    session.procedure_id = null; session.professional_id = null
    session.slot_start = null; session.slot_end = null; session.page = 0
    return msgMenu(clinicName, session.push_name)
  }

  // Global "0" = go back — but NOT at cancel_confirm (there 0 = confirm cancellation)
  if (lower === '0' && session.step !== 'menu' && session.step !== 'cancel_confirm') {
    return goBack(db, session, clinicName)
  }

  // ── Menu ──────────────────────────────────────────────────────────────────
  if (session.step === 'menu') {
    const intent = detectIntent(lower)
    console.log('[bot] intent:', intent, '| input:', lower.substring(0, 30))

    if (lower === '1' || intent === 'book')        return startBooking(db, session)
    if (lower === '3' || intent === 'human') {
      session.step = 'human'
      return `Certo! Em breve um atendente entrará em contato. 👋\n\nEnvie *menu* quando quiser voltar ao atendimento automático.`
    }
    if (lower === '2') {
      session.step = 'manage_action'
      return msgManageAction()
    }
    // Natural language shortcuts — jump directly to correct manage sub-flow
    if (intent === 'confirm_appt') {
      session.flow = 'confirm_appt'; session.step = 'manage_list'
      return msgManageList(await loadPatientAppointments(db, session.company_id, session.phone, ['scheduled']), 'confirm_appt')
    }
    if (intent === 'cancel') {
      session.flow = 'cancel'; session.step = 'manage_list'
      return msgManageList(await loadPatientAppointments(db, session.company_id, session.phone, ['scheduled', 'confirmed', 'in_progress']), 'cancel')
    }
    if (intent === 'reschedule') {
      session.flow = 'reschedule'; session.step = 'manage_list'
      return msgManageList(await loadPatientAppointments(db, session.company_id, session.phone, ['scheduled', 'confirmed', 'in_progress']), 'reschedule')
    }
    if (intent === 'menu') return msgMenu(clinicName, session.push_name) // "menu", "oi", "boa tarde" → re-show menu

    return msgMenu(clinicName, session.push_name)
  }

  // ── Booking ───────────────────────────────────────────────────────────────
  if (session.step === 'procedure')   return handleProcedure(db, session, lower)
  if (session.step === 'professional') return handleProfessional(db, session, lower)
  if (session.step === 'slot')         return handleSlot(db, session, lower)
  if (session.step === 'confirm')      return handleConfirm(db, session, lower, clinicName, clinicAddress)
  if (session.step === 'collect_name') return handleCollectName(db, session, input.trim(), clinicName, clinicAddress)

  // ── Manage ────────────────────────────────────────────────────────────────
  if (session.step === 'manage_action')    return handleManageAction(db, session, lower, clinicName)
  if (session.step === 'manage_list')      return handleManageList(db, session, lower, clinicName)
  if (session.step === 'cancel_confirm')   return handleCancelConfirm(db, session, lower, clinicName)
  if (session.step === 'post_cancel')      return handlePostCancel(db, session, lower, clinicName)
  if (session.step === 'reschedule_slot')  return handleRescheduleSlot(db, session, lower)
  if (session.step === 'reschedule_confirm') return handleRescheduleConfirm(db, session, lower, clinicName)

  // Unknown step — reset
  console.warn('[bot] unknown step:', session.step, '— resetting to menu')
  session.step = 'menu'
  return msgMenu(clinicName, session.push_name)
}

// ── Webhook ───────────────────────────────────────────────────────────────────

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: 'whatsapp-webhook', ts: new Date().toISOString() })
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const event: string        = body.event ?? ''
    const instanceName: string = body.instance ?? ''

    console.log(`[bot] event=${event} instance=${instanceName}`)

    if (event !== 'messages.upsert') return NextResponse.json({ ok: true })

    const data = body.data
    if (!data?.key || data.key.fromMe) return NextResponse.json({ ok: true })

    const remoteJid: string = data.key.remoteJid ?? ''
    if (remoteJid.includes('@g.us')) return NextResponse.json({ ok: true }) // skip group messages

    const phone    = remoteJid.replace(/@.*$/, '')
    const pushName = (data.pushName as string | null) ?? null
    const msg      = data.message
    const text: string | null =
      msg?.conversation ??
      msg?.extendedTextMessage?.text ??
      msg?.buttonsResponseMessage?.selectedButtonId ??
      msg?.listResponseMessage?.singleSelectReply?.selectedRowId ??
      null

    if (!text) { console.log('[bot] no text content, skipping'); return NextResponse.json({ ok: true }) }
    if (!instanceName) { console.warn('[bot] missing instanceName'); return NextResponse.json({ ok: true }) }

    const db: DB = createServiceClient()

    // Resolve company from Evolution instance name
    const { data: integration, error: integErr } = await db
      .from('integrations').select('company_id, config')
      .eq('type', 'whatsapp')
      .filter('config->>instance_name', 'eq', instanceName)
      .maybeSingle()

    if (integErr) console.error('[bot] integration lookup:', integErr.message)
    if (!integration) {
      console.warn('[bot] no integration found for instance:', instanceName)
      return NextResponse.json({ ok: true })
    }

    const companyId: string = integration.company_id

    // Load or create session
    const { data: saved, error: sessErr } = await db
      .from('bot_sessions').select('*')
      .eq('phone', phone).eq('company_id', companyId).maybeSingle()
    if (sessErr) console.error('[bot] session load:', sessErr.message)

    const isExpired = saved && new Date(saved.expires_at) < new Date()

    const session: Session = (saved && !isExpired)
      ? {
          phone, company_id: companyId,
          step:           (saved.step ?? 'menu') as Step,
          flow:           (saved.flow ?? null) as ManageFlow,
          appointment_id: saved.appointment_id ?? null,
          procedure_id:   saved.procedure_id ?? null,
          professional_id: saved.professional_id ?? null,
          slot_start:     saved.slot_start ?? null,
          slot_end:       saved.slot_end ?? null,
          page:           saved.page ?? 0,
          push_name:      saved.push_name ?? pushName,
          expires_at:     saved.expires_at,
        }
      : {
          phone, company_id: companyId,
          step: 'menu', flow: null, appointment_id: null,
          procedure_id: null, professional_id: null,
          slot_start: null, slot_end: null,
          page: 0, push_name: pushName, expires_at: '',
        }

    if (pushName && !session.push_name) session.push_name = pushName

    // Get clinic info (name + address for booking confirmation)
    const { data: company } = await db.from('companies').select('name, address').eq('id', companyId).single()
    const clinicName    = (company?.name    as string | null) ?? 'Clínica'
    const clinicAddress = (company?.address as string | null) ?? null

    // Run state machine
    const reply = await processMessage(db, session, text, clinicName, clinicAddress)

    // Persist session
    const expires = new Date(Date.now() + SESSION_TTL_MIN * 60_000).toISOString()
    const { error: upsertErr } = await db.from('bot_sessions').upsert({
      phone, company_id: companyId,
      step:           session.step,
      flow:           session.flow,
      appointment_id: session.appointment_id,
      procedure_id:   session.procedure_id,
      professional_id: session.professional_id,
      slot_start:     session.slot_start,
      slot_end:       session.slot_end,
      page:           session.page,
      push_name:      session.push_name,
      updated_at:     new Date().toISOString(),
      expires_at:     expires,
    }, { onConflict: 'phone,company_id' })

    if (upsertErr) {
      console.error('[bot] session save failed:', upsertErr.message, upsertErr.details ?? '')
      if (upsertErr.message?.includes('flow') || upsertErr.message?.includes('appointment_id')) {
        console.error('[bot] MIGRATION NEEDED — run in Supabase SQL editor:\n  ALTER TABLE bot_sessions ADD COLUMN IF NOT EXISTS flow text, ADD COLUMN IF NOT EXISTS appointment_id uuid;')
      }
    }

    // Send reply (empty string = human mode, stay silent)
    if (reply) {
      await sendText(instanceName, phone, reply)
      console.log(`[bot] replied → phone=${phone} step=${session.step} flow=${session.flow}`)
    } else {
      console.log(`[bot] silent (human mode) → phone=${phone}`)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[whatsapp/webhook] uncaught error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ ok: false, error: 'internal' }, { status: 200 }) // 200 so Evolution doesn't retry
  }
}
