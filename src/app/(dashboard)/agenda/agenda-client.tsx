'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import {
  Plus, ChevronLeft, ChevronRight, Clock, Stethoscope,
  CalendarDays, Users, CheckCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { BookingModal } from './booking-modal'
import { updateAppointmentStatus } from './actions'
import { toast } from 'sonner'

// ── Status config ──────────────────────────────────────────────────────────────

const STATUS = {
  scheduled:   { label: 'Agendado',     dot: 'bg-blue-500',    pill: 'bg-blue-50 text-blue-700 border-blue-200' },
  confirmed:   { label: 'Confirmado',   dot: 'bg-emerald-500', pill: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  in_progress: { label: 'Em andamento', dot: 'bg-amber-500',   pill: 'bg-amber-50 text-amber-700 border-amber-200' },
  completed:   { label: 'Concluído',    dot: 'bg-slate-400',   pill: 'bg-slate-100 text-slate-600 border-slate-200' },
  cancelled:   { label: 'Cancelado',    dot: 'bg-red-400',     pill: 'bg-red-50 text-red-600 border-red-200' },
  no_show:     { label: 'Faltou',       dot: 'bg-orange-400',  pill: 'bg-orange-50 text-orange-600 border-orange-200' },
} as const

type StatusKey = keyof typeof STATUS

// ── Types ──────────────────────────────────────────────────────────────────────

interface Patient      { id: string; full_name: string }
interface Professional { id: string; name: string; specialty: string | null; color: string }
interface Procedure    { id: string; name: string; duration_minutes: number; color: string }
interface Appointment  {
  id: string; title: string; status: StatusKey
  start_at: string; end_at: string; notes: string | null
  patients: unknown; professionals: unknown; procedures: unknown
}

interface Props {
  appointments: Appointment[]
  patients: Patient[]
  professionals: Professional[]
  procedures: Procedure[]
  selectedDate: string
}

// ── Constants ──────────────────────────────────────────────────────────────────

const HOURS = Array.from({ length: 13 }, (_, i) => i + 7) // 07 → 19
const HOUR_H = 80 // px per hour row

const MONTH_NAMES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
]
const DAY_LABELS = ['D','S','T','Q','Q','S','S']

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDateParam(d: Date) { return d.toISOString().slice(0, 10) }

function parseLocalDate(s: string) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

function useNow() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])
  return now
}

// ── Mini Calendar ──────────────────────────────────────────────────────────────

function MiniCalendar({
  selectedDate,
  onSelect,
}: {
  selectedDate: string
  onSelect: (date: string) => void
}) {
  const selected = parseLocalDate(selectedDate)
  const today    = new Date()

  const [viewYear,  setViewYear]  = useState(selected.getFullYear())
  const [viewMonth, setViewMonth] = useState(selected.getMonth()) // 0-indexed
  const [dotDays,   setDotDays]   = useState<number[]>([])
  const [dotLoading, setDotLoading] = useState(false)
  const prevDateRef = useRef(selectedDate)

  // Sync view month/year when selectedDate changes from outside (header prev/next)
  useEffect(() => {
    if (selectedDate !== prevDateRef.current) {
      const d = parseLocalDate(selectedDate)
      setViewYear(d.getFullYear())
      setViewMonth(d.getMonth())
      prevDateRef.current = selectedDate
    }
  }, [selectedDate])

  // Fetch appointment dots for the current view month
  useEffect(() => {
    let cancelled = false
    setDotLoading(true)
    fetch(`/api/appointments/dates?year=${viewYear}&month=${viewMonth + 1}`)
      .then(r => r.json())
      .then(json => { if (!cancelled) { setDotDays(json.dates ?? []); setDotLoading(false) } })
      .catch(() => { if (!cancelled) setDotLoading(false) })
    return () => { cancelled = true }
  }, [viewYear, viewMonth])

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  // Build day grid
  const firstDow  = new Date(viewYear, viewMonth, 1).getDay()
  const totalDays = new Date(viewYear, viewMonth + 1, 0).getDate()
  const cells: (number | null)[] = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= totalDays; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div className="rounded-xl bg-white border border-gray-100 shadow-sm overflow-hidden">
      {/* Month nav */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
        <button
          onClick={prevMonth}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <span className={cn(
          'text-sm font-semibold text-gray-800 select-none transition-opacity',
          dotLoading && 'opacity-50',
        )}>
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>
        <button
          onClick={nextMonth}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Weekday labels */}
      <div className="grid grid-cols-7 px-3 pt-2.5 pb-1">
        {DAY_LABELS.map((l, i) => (
          <div key={i} className="flex items-center justify-center h-5">
            <span className="text-[10px] font-semibold text-gray-400 uppercase">{l}</span>
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 px-3 pb-3 gap-y-0.5">
        {cells.map((day, idx) => {
          if (!day) return <div key={idx} className="h-8" />

          const isSelected =
            day === selected.getDate() &&
            viewMonth === selected.getMonth() &&
            viewYear  === selected.getFullYear()

          const isToday =
            day === today.getDate() &&
            viewMonth === today.getMonth() &&
            viewYear  === today.getFullYear()

          const hasDot = dotDays.includes(day)
          const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

          return (
            <button
              key={idx}
              onClick={() => onSelect(dateStr)}
              className={cn(
                'relative flex flex-col items-center justify-center h-8 rounded-lg text-xs font-medium transition-all duration-150',
                isSelected
                  ? 'bg-blue-600 text-white shadow-sm hover:bg-blue-700'
                  : isToday
                    ? 'bg-blue-50 text-blue-600 font-bold hover:bg-blue-100'
                    : 'text-gray-700 hover:bg-gray-100',
              )}
            >
              {day}
              {hasDot && (
                <span className={cn(
                  'absolute bottom-0.5 w-1 h-1 rounded-full',
                  isSelected ? 'bg-white/60' : 'bg-emerald-500',
                )} />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Day summary ────────────────────────────────────────────────────────────────

function DaySummary({
  appointments,
  selectedDate,
}: {
  appointments: Appointment[]
  selectedDate: string
}) {
  const total     = appointments.length
  const confirmed = appointments.filter(a => a.status === 'confirmed').length
  const completed = appointments.filter(a => a.status === 'completed').length
  const cancelled = appointments.filter(a => a.status === 'cancelled').length
  const active    = appointments.filter(a => a.status !== 'cancelled' && a.status !== 'no_show').length
  const confirmRate = active > 0 ? Math.round((confirmed / active) * 100) : 0

  const date = parseLocalDate(selectedDate)
  const dateLabel = date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })

  if (total === 0) {
    return (
      <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-4 text-center">
        <CalendarDays className="h-5 w-5 text-gray-300 mx-auto mb-2" />
        <p className="text-xs text-gray-400">Sem consultas neste dia</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Resumo do dia</p>
        <span className="text-[11px] text-gray-400 tabular-nums">{dateLabel}</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {([
          { label: 'Total',        value: total,     color: 'text-gray-900' },
          { label: 'Confirmadas',  value: confirmed, color: 'text-emerald-600' },
          { label: 'Concluídas',   value: completed, color: 'text-slate-500' },
          { label: 'Canceladas',   value: cancelled, color: 'text-red-500' },
        ] as const).map(({ label, value, color }) => (
          <div key={label} className="bg-gray-50 rounded-lg p-2.5">
            <p className="text-[10px] text-gray-400 font-medium">{label}</p>
            <p className={cn('text-xl font-bold tabular-nums leading-none mt-0.5', color)}>{value}</p>
          </div>
        ))}
      </div>

      {active > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="flex items-center gap-1.5 text-[11px] text-gray-500">
              <CheckCheck className="h-3 w-3 text-emerald-500" />
              Taxa de confirmação
            </span>
            <span className="text-xs font-bold text-gray-900">{confirmRate}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-700"
              style={{ width: `${confirmRate}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Appointment card ───────────────────────────────────────────────────────────

function ApptCard({
  appt, updatingId, onStatusChange,
}: {
  appt: Appointment
  updatingId: string | null
  onStatusChange: (id: string, status: string) => void
}) {
  const patient   = appt.patients     as { full_name: string } | null
  const prof      = appt.professionals as { name: string; color: string } | null
  const procedure = appt.procedures   as { name: string } | null
  const st        = STATUS[appt.status] ?? STATUS.scheduled
  const duration  = Math.round((new Date(appt.end_at).getTime() - new Date(appt.start_at).getTime()) / 60_000)
  const startStr  = new Date(appt.start_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const endStr    = new Date(appt.end_at).toLocaleTimeString('pt-BR',   { hour: '2-digit', minute: '2-digit' })
  const isUpdating = updatingId === appt.id

  return (
    <div className="group relative rounded-xl border border-gray-100 bg-white shadow-sm hover:shadow-md hover:-translate-y-px transition-all duration-200 overflow-hidden">
      {/* Professional color bar */}
      <div className="absolute inset-y-0 left-0 w-[3px]" style={{ backgroundColor: prof?.color ?? '#3B82F6' }} />

      <div className="pl-4 pr-3 py-3">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            {/* Time + status pill */}
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="text-[11px] font-mono text-gray-400 tabular-nums tracking-tight">
                {startStr} – {endStr}
              </span>
              <span className={cn(
                'inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border',
                st.pill,
              )}>
                <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', st.dot)} />
                {st.label}
              </span>
            </div>

            {/* Patient */}
            <p className="text-sm font-semibold text-gray-900 truncate leading-snug">
              {patient?.full_name ?? '—'}
            </p>

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-3 mt-1.5">
              {procedure && (
                <span className="flex items-center gap-1 text-[11px] text-gray-500">
                  <Stethoscope className="h-3 w-3 text-gray-400" />
                  {procedure.name}
                </span>
              )}
              {prof && (
                <span className="flex items-center gap-1 text-[11px] text-gray-500">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: prof.color }} />
                  {prof.name}
                </span>
              )}
              <span className="flex items-center gap-1 text-[11px] text-gray-400">
                <Clock className="h-3 w-3" />{duration}min
              </span>
            </div>
          </div>

          {/* Hover actions */}
          <div className="flex-shrink-0 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            {appt.status === 'scheduled' && (
              <button
                onClick={() => onStatusChange(appt.id, 'confirmed')} disabled={isUpdating}
                className="text-[10px] px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors font-medium whitespace-nowrap">
                ✓ Confirmar
              </button>
            )}
            {(appt.status === 'scheduled' || appt.status === 'confirmed' || appt.status === 'in_progress') && (
              <button
                onClick={() => onStatusChange(appt.id, 'completed')} disabled={isUpdating}
                className="text-[10px] px-2 py-1 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200 transition-colors font-medium whitespace-nowrap">
                Concluir
              </button>
            )}
            {appt.status !== 'cancelled' && appt.status !== 'completed' && appt.status !== 'no_show' && (
              <button
                onClick={() => onStatusChange(appt.id, 'cancelled')} disabled={isUpdating}
                className="text-[10px] px-2 py-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-colors font-medium whitespace-nowrap">
                Cancelar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function AgendaClient({ appointments, patients, professionals, procedures, selectedDate }: Props) {
  const router = useRouter()
  const [modalOpen,       setModalOpen]       = useState(false)
  const [selectedProfId,  setSelectedProfId]  = useState<string | undefined>()
  const [updatingId,      setUpdatingId]      = useState<string | null>(null)
  const now         = useNow()
  const currentDate = parseLocalDate(selectedDate)
  const isToday     = formatDateParam(currentDate) === formatDateParam(new Date())

  function navigate(offset: number) {
    const d = new Date(currentDate)
    d.setDate(d.getDate() + offset)
    router.push(`/agenda?date=${formatDateParam(d)}`)
  }

  function handleDaySelect(date: string) {
    router.push(`/agenda?date=${date}`)
  }

  function openModal(profId?: string) {
    setSelectedProfId(profId)
    setModalOpen(true)
  }

  async function handleStatusChange(appointmentId: string, status: string) {
    setUpdatingId(appointmentId)
    const result = await updateAppointmentStatus(appointmentId, status)
    setUpdatingId(null)
    if (result?.error) toast.error(result.error)
    else toast.success('Status atualizado')
  }

  const upcoming = appointments
    .filter(a => new Date(a.start_at) > now && a.status !== 'cancelled' && a.status !== 'no_show')
    .slice(0, 4)

  // Current time line position
  const nowHour      = now.getHours()
  const nowMinutes   = now.getMinutes()
  const showTimeLine = isToday && nowHour >= HOURS[0] && nowHour <= HOURS[HOURS.length - 1]

  return (
    <>
      <div className="flex flex-col" style={{ height: '100%' }}>

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-100 flex-shrink-0">
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Agenda</h1>
            <p className="text-sm text-gray-400 mt-0.5 capitalize">
              {currentDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              {isToday && (
                <span className="ml-2.5 inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                  Hoje
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Day navigation */}
            <div className="flex items-center rounded-lg border border-gray-200 overflow-hidden bg-white shadow-sm">
              <button
                onClick={() => navigate(-1)}
                className="px-2.5 py-2 hover:bg-gray-50 text-gray-500 hover:text-gray-900 transition-colors border-r border-gray-100">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => router.push(`/agenda?date=${formatDateParam(new Date())}`)}
                className="px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                Hoje
              </button>
              <button
                onClick={() => navigate(1)}
                className="px-2.5 py-2 hover:bg-gray-50 text-gray-500 hover:text-gray-900 transition-colors border-l border-gray-100">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <Button
              onClick={() => openModal()}
              className="gap-2 bg-blue-600 hover:bg-blue-700 shadow-sm hover:shadow-md transition-all duration-150 hover:-translate-y-px active:translate-y-0">
              <Plus className="h-4 w-4" />
              Agendar
            </Button>
          </div>
        </div>

        {/* ── Body ────────────────────────────────────────────────────── */}
        <div className="flex flex-1 overflow-hidden">

          {/* ── Timeline ─────────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto bg-white">

            {/* Professional quick-book pills */}
            {professionals.length > 0 && (
              <div className="sticky top-0 z-10 flex items-center gap-2 px-4 py-2.5 bg-white/95 border-b border-gray-50 backdrop-blur-sm">
                <span className="text-[11px] text-gray-400 font-medium flex-shrink-0">Agendar com</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {professionals.map(p => (
                    <button
                      key={p.id}
                      onClick={() => openModal(p.id)}
                      className="flex items-center gap-1.5 text-[11px] font-medium text-gray-600 hover:text-gray-900 px-2.5 py-1 rounded-full border border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm transition-all duration-150">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Hour rows */}
            {HOURS.map(hour => {
              const hourAppts  = appointments.filter(a => new Date(a.start_at).getHours() === hour)
              const isCurrent  = showTimeLine && nowHour === hour
              const lineOffset = (nowMinutes / 60) * HOUR_H

              return (
                <div key={hour}
                  className={cn('flex border-b border-gray-50 last:border-0 relative', isCurrent && 'bg-blue-50/30')}>
                  {/* Hour label */}
                  <div className="w-16 flex-shrink-0 text-right px-3 pt-3 select-none">
                    <span className={cn('text-[11px] font-mono', isCurrent ? 'text-blue-500 font-semibold' : 'text-gray-300')}>
                      {String(hour).padStart(2, '0')}:00
                    </span>
                  </div>

                  {/* Appointments + time indicator */}
                  <div className="flex-1 px-3 py-2 space-y-2 relative" style={{ minHeight: `${HOUR_H}px` }}>
                    {isCurrent && (
                      <div
                        className="absolute left-0 right-3 flex items-center pointer-events-none z-10"
                        style={{ top: `${Math.max(lineOffset - 4, 0)}px` }}>
                        <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 shadow-sm" />
                        <div className="flex-1 h-px bg-red-400 opacity-70" />
                      </div>
                    )}
                    {hourAppts.map(appt => (
                      <ApptCard key={appt.id} appt={appt} updatingId={updatingId} onStatusChange={handleStatusChange} />
                    ))}
                  </div>
                </div>
              )
            })}

            {/* Empty state */}
            {appointments.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 px-8 text-center pointer-events-none">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center mb-5 shadow-sm">
                  <CalendarDays className="h-8 w-8 text-blue-400" />
                </div>
                <p className="text-base font-semibold text-gray-800 mb-1.5">
                  Nenhuma consulta agendada
                </p>
                <p className="text-sm text-gray-400 max-w-xs leading-relaxed">
                  Seu assistente virtual está ativo e disponível para receber novos agendamentos pelo WhatsApp.
                </p>
                <button
                  onClick={() => openModal()}
                  className="pointer-events-auto mt-5 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors border border-blue-100">
                  <Plus className="h-4 w-4" />
                  Criar agendamento
                </button>
              </div>
            )}
          </div>

          {/* ── Right sidebar ─────────────────────────────────────────── */}
          <div className="w-72 flex-shrink-0 overflow-y-auto border-l border-gray-100 bg-gray-50/40 p-4 space-y-3">

            {/* Mini calendar */}
            <MiniCalendar selectedDate={selectedDate} onSelect={handleDaySelect} />

            {/* Day summary */}
            <DaySummary appointments={appointments} selectedDate={selectedDate} />

            {/* Professionals */}
            {professionals.length > 0 ? (
              <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-3.5">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="h-3.5 w-3.5 text-gray-400" />
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Profissionais</p>
                </div>
                <div className="space-y-2.5">
                  {professionals.map(prof => {
                    const count = appointments.filter(a => {
                      const p = a.professionals as { name: string } | null
                      return p?.name === prof.name
                    }).length
                    return (
                      <div key={prof.id} className="flex items-center gap-2.5">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 shadow-sm"
                          style={{ backgroundColor: prof.color }}>
                          {initials(prof.name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-800 truncate">{prof.name}</p>
                          {prof.specialty && (
                            <p className="text-[10px] text-gray-400 truncate">{prof.specialty}</p>
                          )}
                        </div>
                        <span className={cn(
                          'text-[10px] font-semibold px-1.5 py-0.5 rounded-full tabular-nums',
                          count > 0 ? 'bg-gray-100 text-gray-600' : 'text-gray-300',
                        )}>
                          {count > 0 ? count : '—'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-gray-200 bg-white p-5 text-center">
                <Users className="h-6 w-6 text-gray-300 mx-auto mb-2" />
                <p className="text-xs text-gray-400 mb-1.5">Nenhum profissional</p>
                <a href="/settings" className="text-xs text-blue-500 hover:text-blue-700 hover:underline transition-colors">
                  Adicionar em Configurações →
                </a>
              </div>
            )}

            {/* Upcoming appointments */}
            {upcoming.length > 0 && (
              <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-3.5">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="h-3.5 w-3.5 text-gray-400" />
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Próximas</p>
                </div>
                <div className="space-y-2.5">
                  {upcoming.map(appt => {
                    const patient = appt.patients     as { full_name: string } | null
                    const prof    = appt.professionals as { name: string; color: string } | null
                    const proc    = appt.procedures   as { name: string } | null
                    const timeStr = new Date(appt.start_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                    return (
                      <div key={appt.id} className="flex items-start gap-2.5">
                        <div
                          className="w-1 h-10 rounded-full flex-shrink-0 mt-0.5"
                          style={{ backgroundColor: prof?.color ?? '#3B82F6' }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-800 truncate">{patient?.full_name ?? '—'}</p>
                          {proc && <p className="text-[10px] text-gray-400 truncate">{proc.name}</p>}
                          <p className="text-[10px] text-gray-400 tabular-nums font-mono mt-0.5">{timeStr}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <BookingModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        patients={patients}
        professionals={professionals}
        procedures={procedures}
        defaultDate={selectedDate}
        defaultProfessionalId={selectedProfId}
      />
    </>
  )
}
