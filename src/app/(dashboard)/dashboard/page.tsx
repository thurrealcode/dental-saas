import { createClient } from '@/lib/supabase/server'
import { getSetupStatus } from '../setup/actions'
import Link from 'next/link'
import {
  CalendarDays, Users, CheckCheck, XCircle, MessageSquare,
  Wifi, WifiOff, Bot, Stethoscope, TrendingUp, AlertCircle,
  CheckCircle2, Circle, Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

// ── Status palette ─────────────────────────────────────────────────────────────

const ST = {
  scheduled:   { label: 'Agendado',     bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-500' },
  confirmed:   { label: 'Confirmado',   bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  in_progress: { label: 'Em andamento', bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-500' },
  completed:   { label: 'Concluído',    bg: 'bg-slate-100',  text: 'text-slate-600',   dot: 'bg-slate-400' },
  cancelled:   { label: 'Cancelado',    bg: 'bg-red-50',     text: 'text-red-600',     dot: 'bg-red-400' },
  no_show:     { label: 'Faltou',       bg: 'bg-orange-50',  text: 'text-orange-600',  dot: 'bg-orange-400' },
} as const

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

// ── Data fetching ──────────────────────────────────────────────────────────────

async function fetchDashboardData(companyId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = await createClient() as any

  const now = new Date()
  const todayStr  = now.toISOString().slice(0, 10)
  const [yr, mo, dy] = todayStr.split('-').map(Number)
  const todayStart = new Date(yr, mo - 1, dy, 0, 0, 0).toISOString()
  const todayEnd   = new Date(yr, mo - 1, dy, 23, 59, 59).toISOString()
  const monthStart = new Date(yr, mo - 1, 1).toISOString()
  const weekAgoDate = new Date(now); weekAgoDate.setDate(weekAgoDate.getDate() - 6); weekAgoDate.setHours(0, 0, 0, 0)
  const weekAgoStr = weekAgoDate.toISOString()

  const [
    todayApptRes, weekApptRes, monthApptRes,
    patientsRes, professionalsRes,
    convoRes, waRes, botRes,
  ] = await Promise.all([
    supabase
      .from('appointments')
      .select('id, title, status, start_at, end_at, patients(full_name), professionals(name, color), procedures(name)')
      .eq('company_id', companyId)
      .gte('start_at', todayStart).lte('start_at', todayEnd)
      .order('start_at'),

    supabase
      .from('appointments')
      .select('start_at, status')
      .eq('company_id', companyId)
      .gte('start_at', weekAgoStr).lte('start_at', todayEnd),

    supabase
      .from('appointments')
      .select('professional_id, professionals(name, color)')
      .eq('company_id', companyId)
      .gte('start_at', monthStart)
      .not('status', 'eq', 'cancelled'),

    supabase.from('patients').select('id', { count: 'exact', head: true }).eq('company_id', companyId),

    supabase.from('professionals').select('id, name, color, specialty').eq('company_id', companyId),

    supabase.from('conversations').select('id', { count: 'exact', head: true })
      .eq('company_id', companyId).eq('status', 'open'),

    supabase.from('integrations').select('is_active, updated_at')
      .eq('company_id', companyId).eq('type', 'whatsapp').maybeSingle(),

    supabase.from('bot_sessions').select('step', { count: 'exact' })
      .eq('company_id', companyId).gte('updated_at', todayStart),
  ])

  type Appt = {
    id: string; title: string; status: string; start_at: string; end_at: string
    patients: { full_name: string } | null
    professionals: { name: string; color: string } | null
    procedures: { name: string } | null
  }
  type ProfEntry = {
    professional_id: string | null
    professionals: { name: string; color: string } | null
  }

  const todayAppts    = (todayApptRes.data ?? []) as Appt[]
  const weekAppts     = (weekApptRes.data ?? []) as Array<{ start_at: string; status: string }>
  const monthAppts    = (monthApptRes.data ?? []) as ProfEntry[]
  const totalPatients = patientsRes.count ?? 0
  const professionals = (professionalsRes.data ?? []) as Array<{ id: string; name: string; color: string; specialty: string | null }>
  const openConvos    = convoRes.count ?? 0
  const waIntegration = waRes.data as { is_active: boolean; updated_at: string } | null
  const botSessions   = botRes.count ?? 0
  const botHuman      = (botRes.data ?? []).filter((s: { step: string }) => s.step === 'human').length

  // Today's KPIs
  const todayTotal     = todayAppts.length
  const todayScheduled = todayAppts.filter(a => a.status === 'scheduled').length
  const todayConfirmed = todayAppts.filter(a => a.status === 'confirmed').length
  const todayInProg    = todayAppts.filter(a => a.status === 'in_progress').length
  const todayCompleted = todayAppts.filter(a => a.status === 'completed').length
  const todayCancelled = todayAppts.filter(a => a.status === 'cancelled').length
  const todayActive    = todayTotal - todayCancelled
  const confirmRate    = todayActive > 0 ? Math.round(((todayConfirmed + todayInProg + todayCompleted) / todayActive) * 100) : 0

  // 7-day chart
  const weekData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now); d.setDate(d.getDate() - (6 - i)); d.setHours(0, 0, 0, 0)
    const ds = d.toISOString().slice(0, 10)
    const dayAppts = weekAppts.filter(a => a.start_at.startsWith(ds))
    return {
      label: d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' }),
      dateStr: ds,
      total: dayAppts.length,
      cancelled: dayAppts.filter(a => a.status === 'cancelled').length,
    }
  })
  const maxWeekCount = Math.max(...weekData.map(d => d.total), 1)

  // Professional stats this month
  const profMap = new Map<string, { name: string; color: string; count: number }>()
  for (const a of monthAppts) {
    if (!a.professionals || !a.professional_id) continue
    if (!profMap.has(a.professional_id)) {
      profMap.set(a.professional_id, { name: a.professionals.name, color: a.professionals.color, count: 0 })
    }
    profMap.get(a.professional_id)!.count++
  }
  const profStats = [...profMap.values()].sort((a, b) => b.count - a.count).slice(0, 6)
  const maxProfCount = Math.max(...profStats.map(p => p.count), 1)

  return {
    now, todayStr,
    todayAppts, todayTotal, todayScheduled, todayConfirmed,
    todayInProg, todayCompleted, todayCancelled, todayActive, confirmRate,
    weekData, maxWeekCount, weekAppts,
    profStats, maxProfCount,
    totalPatients,
    professionals,
    openConvos,
    waIntegration,
    whatsappConnected: waIntegration?.is_active ?? false,
    botSessions, botHuman,
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id, companies(name)')
    .eq('user_id', user!.id)
    .eq('is_active', true)
    .single()

  if (!membership) return null

  const companyId   = membership.company_id
  const companyName = (membership.companies as unknown as { name: string } | null)?.name ?? 'Clínica'

  const [data, setupStatus] = await Promise.all([
    fetchDashboardData(companyId),
    getSetupStatus(),
  ])

  const {
    now, todayStr,
    todayAppts, todayTotal, todayScheduled, todayConfirmed,
    todayInProg, todayCompleted, todayCancelled, todayActive, confirmRate,
    weekData, maxWeekCount, weekAppts,
    profStats, maxProfCount,
    totalPatients, professionals, openConvos,
    waIntegration, whatsappConnected,
    botSessions, botHuman,
  } = data

  const hour     = now.getHours()
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'

  return (
    <div className="flex flex-col gap-5 p-6">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            {greeting}, <span className="text-blue-600">{companyName}</span> 👋
          </h1>
          <p className="text-sm text-gray-400 mt-0.5 capitalize">
            {now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <Link href="/agenda">
          <Button className="gap-2 bg-blue-600 hover:bg-blue-700 shadow-sm hover:shadow-md transition-all hover:-translate-y-px">
            <CalendarDays className="h-4 w-4" />
            Abrir Agenda
          </Button>
        </Link>
      </div>

      {/* ── Setup banner ────────────────────────────────────────────── */}
      {setupStatus && !setupStatus.is_ready && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-900">Configure sua clínica para ativar o bot</p>
              <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-2">
                {[
                  { label: 'Dados da clínica',     done: setupStatus.clinic_configured },
                  { label: 'Procedimentos',         done: setupStatus.procedures_configured },
                  { label: 'Profissionais',         done: setupStatus.professionals_configured },
                  { label: 'Vínculos',              done: setupStatus.procedures_linked },
                  { label: 'Disponibilidade',       done: setupStatus.availability_configured },
                  { label: 'WhatsApp',              done: setupStatus.whatsapp_connected },
                ].map(item => (
                  <span
                    key={item.label}
                    className={cn('flex items-center gap-1.5 text-xs font-medium', item.done ? 'text-gray-400 line-through' : 'text-amber-800')}
                  >
                    {item.done
                      ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                      : <Circle className="h-3.5 w-3.5 text-amber-300 flex-shrink-0" />}
                    {item.label}
                  </span>
                ))}
              </div>
            </div>
            <Link href="/setup" className="flex-shrink-0">
              <button className="text-xs font-semibold text-amber-700 hover:text-amber-900 bg-white border border-amber-200 px-3 py-1.5 rounded-lg hover:bg-amber-50 transition-colors whitespace-nowrap">
                Continuar →
              </button>
            </Link>
          </div>
        </div>
      )}

      {/* ── KPI row ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {([
          {
            label: 'Consultas hoje',  value: todayTotal,
            sub: `${todayScheduled} aguardando`,
            icon: CalendarDays, iconBg: 'bg-blue-50', iconColor: 'text-blue-600',
          },
          {
            label: 'Confirmadas',  value: todayConfirmed,
            sub: `${confirmRate}% de taxa`,
            icon: CheckCheck, iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600',
          },
          {
            label: 'Canceladas',   value: todayCancelled,
            sub: todayTotal > 0 ? `${Math.round((todayCancelled / todayTotal) * 100)}% do total` : '—',
            icon: XCircle, iconBg: 'bg-red-50', iconColor: 'text-red-500',
          },
          {
            label: 'Pacientes',    value: totalPatients,
            sub: 'na base de dados',
            icon: Users, iconBg: 'bg-violet-50', iconColor: 'text-violet-600',
          },
          {
            label: 'Profissionais', value: professionals.length,
            sub: 'cadastrados',
            icon: Stethoscope, iconBg: 'bg-amber-50', iconColor: 'text-amber-600',
          },
          {
            label: 'Conversas',   value: openConvos,
            sub: 'abertas no WhatsApp',
            icon: MessageSquare, iconBg: 'bg-slate-50', iconColor: 'text-slate-600',
          },
        ] as const).map(card => (
          <div
            key={card.label}
            className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4 flex flex-col gap-3 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
          >
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide leading-none">{card.label}</p>
              <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0', card.iconBg)}>
                <card.icon className={cn('h-3.5 w-3.5', card.iconColor)} />
              </div>
            </div>
            <div>
              <p className="text-3xl font-bold text-gray-900 tabular-nums leading-none">{card.value}</p>
              <p className="text-[11px] text-gray-400 mt-1.5">{card.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Main row: agenda + sidebar ───────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Agenda do dia */}
        <div className="lg:col-span-2 rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <div>
              <h2 className="text-sm font-bold text-gray-900">Agenda de hoje</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })} · {todayTotal} consulta{todayTotal !== 1 ? 's' : ''}
              </p>
            </div>
            <Link href="/agenda" className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors">
              Ver agenda completa →
            </Link>
          </div>

          {todayAppts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center mb-4 shadow-sm">
                <CalendarDays className="h-7 w-7 text-blue-400" />
              </div>
              <p className="text-sm font-semibold text-gray-700 mb-1">Nenhuma consulta hoje</p>
              <p className="text-xs text-gray-400 max-w-xs leading-relaxed">
                O bot está ativo e pronto para receber agendamentos pelo WhatsApp.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {todayAppts.map(appt => {
                const patient = appt.patients
                const prof    = appt.professionals
                const proc    = appt.procedures
                const st      = ST[appt.status as keyof typeof ST] ?? ST.scheduled
                const time    = new Date(appt.start_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                const timeEnd = new Date(appt.end_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                return (
                  <div key={appt.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50/60 transition-colors">
                    {/* Time */}
                    <div className="w-20 flex-shrink-0">
                      <span className="text-xs font-mono font-semibold text-gray-700 tabular-nums">{time}</span>
                      <span className="text-[10px] text-gray-400 ml-0.5">– {timeEnd}</span>
                    </div>
                    {/* Prof color bar */}
                    <div
                      className="w-[3px] h-9 rounded-full flex-shrink-0"
                      style={{ backgroundColor: prof?.color ?? '#3B82F6' }}
                    />
                    {/* Patient + procedure */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate leading-tight">
                        {patient?.full_name ?? '—'}
                      </p>
                      <p className="text-[11px] text-gray-400 truncate mt-0.5">
                        {proc?.name ?? appt.title}{prof ? ` · ${prof.name}` : ''}
                      </p>
                    </div>
                    {/* Status */}
                    <span className={cn(
                      'inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0',
                      st.bg, st.text,
                    )}>
                      <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', st.dot)} />
                      {st.label}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-3">

          {/* Status operacional */}
          <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4">
            <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-3.5">Status operacional</h3>
            <div className="space-y-3">
              {[
                {
                  label: 'WhatsApp',
                  ok: whatsappConnected,
                  okText: 'Conectado',
                  failText: 'Desconectado',
                  Icon: whatsappConnected ? Wifi : WifiOff,
                },
                {
                  label: 'Bot de atendimento',
                  ok: setupStatus?.is_ready ?? false,
                  okText: 'Ativo',
                  failText: 'Inativo',
                  Icon: Bot,
                },
                {
                  label: 'Integração',
                  ok: waIntegration !== null,
                  okText: 'Configurada',
                  failText: 'Não configurada',
                  Icon: TrendingUp,
                },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <item.Icon className={cn('h-3.5 w-3.5 flex-shrink-0', item.ok ? 'text-emerald-500' : 'text-gray-300')} />
                    <span className="text-xs text-gray-600">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className={cn('w-1.5 h-1.5 rounded-full', item.ok ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300')} />
                    <span className={cn('text-[11px] font-semibold', item.ok ? 'text-emerald-600' : 'text-gray-400')}>
                      {item.ok ? item.okText : item.failText}
                    </span>
                  </div>
                </div>
              ))}

              {waIntegration?.updated_at && (
                <p className="text-[10px] text-gray-300 flex items-center gap-1 pt-1 border-t border-gray-50">
                  <Clock className="h-3 w-3" />
                  Sync: {new Date(waIntegration.updated_at).toLocaleString('pt-BR', {
                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                  })}
                </p>
              )}
            </div>
          </div>

          {/* Distribuição de hoje */}
          {todayTotal > 0 && (
            <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4">
              <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-3.5">Hoje por status</h3>
              <div className="space-y-2.5">
                {([
                  { label: 'Agendadas',     count: todayScheduled, bar: 'bg-blue-500' },
                  { label: 'Confirmadas',   count: todayConfirmed, bar: 'bg-emerald-500' },
                  { label: 'Em andamento',  count: todayInProg,    bar: 'bg-amber-500' },
                  { label: 'Concluídas',    count: todayCompleted, bar: 'bg-slate-400' },
                  { label: 'Canceladas',    count: todayCancelled, bar: 'bg-red-400' },
                ] as const).map(row => row.count > 0 && (
                  <div key={row.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] text-gray-500">{row.label}</span>
                      <span className="text-[11px] font-bold text-gray-800 tabular-nums">{row.count}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full', row.bar)}
                        style={{ width: `${Math.round((row.count / todayTotal) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              {todayActive > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-50 flex items-center justify-between">
                  <span className="text-[11px] text-gray-400 flex items-center gap-1">
                    <CheckCheck className="h-3 w-3 text-emerald-500" />
                    Taxa de confirmação
                  </span>
                  <span className="text-xs font-bold text-gray-900">{confirmRate}%</span>
                </div>
              )}
            </div>
          )}

          {/* Bot hoje */}
          <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4">
            <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-3.5">Atividade do bot</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Sessões hoje', value: botSessions, color: 'text-blue-600', bg: 'bg-blue-50' },
                { label: 'Atend. humano', value: botHuman,  color: 'text-amber-600', bg: 'bg-amber-50' },
              ].map(item => (
                <div key={item.label} className={cn('rounded-xl p-3', item.bg)}>
                  <p className="text-[10px] text-gray-500 font-medium leading-tight">{item.label}</p>
                  <p className={cn('text-2xl font-bold tabular-nums mt-1 leading-none', item.color)}>{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── 7-day bar chart ──────────────────────────────────────────── */}
      <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Consultas — últimos 7 dias</h2>
            <p className="text-xs text-gray-400 mt-0.5">{weekAppts.length} consultas no período</p>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-gray-400">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-blue-500" /> Total
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-red-400" /> Canceladas
            </span>
          </div>
        </div>

        <div className="flex items-end gap-2" style={{ height: '128px' }}>
          {weekData.map(day => {
            const isToday  = day.dateStr === todayStr
            const barH     = maxWeekCount > 0 ? Math.max((day.total / maxWeekCount) * 100, day.total > 0 ? 8 : 0) : 0
            const canFrac  = day.total > 0 ? (day.cancelled / day.total) : 0
            return (
              <div key={day.dateStr} className="flex-1 flex flex-col items-center gap-1.5 group">
                {/* Hover value */}
                <div className={cn(
                  'text-[10px] font-bold tabular-nums transition-opacity duration-150',
                  day.total > 0 ? 'opacity-0 group-hover:opacity-100 text-gray-500' : 'opacity-0',
                )}>
                  {day.total}
                </div>
                {/* Bar area */}
                <div className="w-full flex-1 flex items-end">
                  <div
                    className={cn(
                      'w-full relative rounded-t-lg overflow-hidden transition-all duration-500 group-hover:opacity-80',
                      isToday ? 'bg-blue-500' : 'bg-blue-200',
                    )}
                    style={{ height: `${barH}%` }}
                  >
                    {canFrac > 0 && (
                      <div
                        className="absolute bottom-0 left-0 right-0 bg-red-400"
                        style={{ height: `${canFrac * 100}%` }}
                      />
                    )}
                  </div>
                </div>
                {/* Day label */}
                <p className={cn(
                  'text-[10px] font-medium whitespace-nowrap capitalize',
                  isToday ? 'text-blue-600 font-bold' : 'text-gray-400',
                )}>
                  {day.label}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Bottom row: professionals + professionals list ────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Professional workload */}
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5">
          <div className="mb-4">
            <h2 className="text-sm font-bold text-gray-900">Profissionais mais agendados</h2>
            <p className="text-xs text-gray-400 mt-0.5">Este mês (excl. cancelamentos)</p>
          </div>
          {profStats.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Stethoscope className="h-8 w-8 text-gray-200 mb-2" />
              <p className="text-xs text-gray-400">Nenhuma consulta este mês</p>
            </div>
          ) : (
            <div className="space-y-4">
              {profStats.map((prof, idx) => (
                <div key={prof.name} className="flex items-center gap-3">
                  <span className="text-[11px] font-mono text-gray-300 w-4 flex-shrink-0">{idx + 1}</span>
                  <div
                    className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[10px] font-bold shadow-sm"
                    style={{ backgroundColor: prof.color }}
                  >
                    {initials(prof.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold text-gray-700 truncate">{prof.name}</span>
                      <span className="text-xs font-bold text-gray-900 tabular-nums ml-2 flex-shrink-0">
                        {prof.count} consulta{prof.count !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${Math.round((prof.count / maxProfCount) * 100)}%`,
                          backgroundColor: prof.color,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Professionals directory */}
        <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-gray-900">Equipe</h2>
              <p className="text-xs text-gray-400 mt-0.5">{professionals.length} profissional{professionals.length !== 1 ? 'is' : ''} cadastrado{professionals.length !== 1 ? 's' : ''}</p>
            </div>
            <Link href="/settings" className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors">
              Gerenciar →
            </Link>
          </div>
          {professionals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Users className="h-8 w-8 text-gray-200 mb-2" />
              <p className="text-xs text-gray-400 mb-2">Nenhum profissional cadastrado</p>
              <Link href="/settings" className="text-xs text-blue-500 hover:underline">Adicionar em Configurações →</Link>
            </div>
          ) : (
            <div className="space-y-2.5">
              {professionals.map(prof => {
                const monthCount = profStats.find(p => p.name === prof.name)?.count ?? 0
                return (
                  <div key={prof.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 transition-colors">
                    <div
                      className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold shadow-sm"
                      style={{ backgroundColor: prof.color }}
                    >
                      {initials(prof.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{prof.name}</p>
                      {prof.specialty && (
                        <p className="text-[11px] text-gray-400 truncate">{prof.specialty}</p>
                      )}
                    </div>
                    {monthCount > 0 && (
                      <span className="text-[11px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full tabular-nums flex-shrink-0">
                        {monthCount} mês
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
