'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import {
  Plus, ChevronLeft, ChevronRight, Stethoscope, CalendarDays,
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
  const [viewMonth, setViewMonth] = useState(selected.getMonth())
  const [dotDays,   setDotDays]   = useState<number[]>([])
  const [loading,   setLoading]   = useState(false)
  const prevDateRef = useRef(selectedDate)

  // Sync view when selectedDate changes via header nav
  useEffect(() => {
    if (selectedDate !== prevDateRef.current) {
      const d = parseLocalDate(selectedDate)
      setViewYear(d.getFullYear())
      setViewMonth(d.getMonth())
      prevDateRef.current = selectedDate
    }
  }, [selectedDate])

  // Fetch dots for view month
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/appointments/dates?year=${viewYear}&month=${viewMonth + 1}`)
      .then(r => r.json())
      .then(json => { if (!cancelled) { setDotDays(json.dates ?? []); setLoading(false) } })
      .catch(() => { if (!cancelled) setLoading(false) })
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

  const firstDow  = new Date(viewYear, viewMonth, 1).getDay()
  const totalDays = new Date(viewYear, viewMonth + 1, 0).getDate()
  const cells: (number | null)[] = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= totalDays; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div>
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevMonth}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className={cn('text-sm font-bold text-gray-800 select-none', loading && 'opacity-40')}>
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>
        <button
          onClick={nextMonth}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Weekday labels */}
      <div className="grid grid-cols-7 mb-1.5">
        {DAY_LABELS.map((l, i) => (
          <div key={i} className="flex items-center justify-center h-6">
            <span className="text-[11px] font-semibold text-gray-400 uppercase">{l}</span>
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((day, idx) => {
          if (!day) return <div key={idx} className="h-9" />

          const isSelected =
            day === selected.getDate() &&
            viewMonth === selected.getMonth() &&
            viewYear  === selected.getFullYear()
          const isToday =
            day === today.getDate() &&
            viewMonth === today.getMonth() &&
            viewYear  === today.getFullYear()
          const hasDot  = dotDays.includes(day)
          const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

          return (
            <button
              key={idx}
              onClick={() => onSelect(dateStr)}
              className={cn(
                'relative flex flex-col items-center justify-center h-9 rounded-xl text-sm font-medium transition-all duration-150',
                isSelected && 'bg-blue-600 text-white shadow-sm hover:bg-blue-700',
                !isSelected && isToday && 'bg-blue-50 text-blue-600 font-bold hover:bg-blue-100',
                !isSelected && !isToday && 'text-gray-700 hover:bg-gray-100',
              )}
            >
              {day}
              {hasDot && (
                <span className={cn(
                  'absolute bottom-1 w-1 h-1 rounded-full',
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

// ── Large CRM-style appointment card ──────────────────────────────────────────

function BigApptCard({
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
    <div className="flex gap-5 items-stretch">
      {/* Time column */}
      <div className="w-14 flex-shrink-0 flex flex-col items-end pt-4 select-none">
        <span className="text-sm font-bold font-mono text-gray-700 tabular-nums leading-none">{startStr}</span>
        <span className="text-[11px] text-gray-400 mt-1.5">{duration}min</span>
      </div>

      {/* Card */}
      <div className="flex-1 relative rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden">
        {/* Professional color stripe */}
        <div
          className="absolute inset-y-0 left-0 w-1 rounded-l-2xl"
          style={{ backgroundColor: prof?.color ?? '#3B82F6' }}
        />

        <div className="pl-5 pr-4 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">

              {/* Status + time range */}
              <div className="flex items-center gap-2.5 mb-2.5 flex-wrap">
                <span className={cn(
                  'inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border',
                  st.pill,
                )}>
                  <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', st.dot)} />
                  {st.label}
                </span>
                <span className="text-xs text-gray-400 font-mono tabular-nums">{startStr} – {endStr}</span>
              </div>

              {/* Patient name */}
              <h3 className="text-[17px] font-bold text-gray-900 leading-tight truncate">
                {patient?.full_name ?? '—'}
              </h3>

              {/* Procedure + professional */}
              <div className="flex items-center gap-5 mt-2.5 flex-wrap">
                {procedure && (
                  <span className="flex items-center gap-1.5 text-sm text-gray-500">
                    <Stethoscope className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                    {procedure.name}
                  </span>
                )}
                {prof && (
                  <span className="flex items-center gap-1.5 text-sm text-gray-500">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: prof.color }}
                    />
                    {prof.name}
                  </span>
                )}
              </div>
            </div>

            {/* Action buttons — always visible (CRM style) */}
            <div className="flex-shrink-0 flex flex-col gap-1.5 pt-0.5">
              {appt.status === 'scheduled' && (
                <button
                  onClick={() => onStatusChange(appt.id, 'confirmed')}
                  disabled={isUpdating}
                  className="text-xs px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 font-semibold transition-colors whitespace-nowrap">
                  ✓ Confirmar
                </button>
              )}
              {(appt.status === 'scheduled' || appt.status === 'confirmed' || appt.status === 'in_progress') && (
                <button
                  onClick={() => onStatusChange(appt.id, 'completed')}
                  disabled={isUpdating}
                  className="text-xs px-3 py-1.5 rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200 font-semibold transition-colors whitespace-nowrap">
                  Concluir
                </button>
              )}
              {appt.status !== 'cancelled' && appt.status !== 'completed' && appt.status !== 'no_show' && (
                <button
                  onClick={() => onStatusChange(appt.id, 'cancelled')}
                  disabled={isUpdating}
                  className="text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 border border-red-200 font-semibold transition-colors whitespace-nowrap">
                  Cancelar
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function AgendaClient({ appointments, patients, professionals, procedures, selectedDate }: Props) {
  const router = useRouter()
  const [modalOpen,      setModalOpen]      = useState(false)
  const [selectedProfId, setSelectedProfId] = useState<string | undefined>()
  const [updatingId,     setUpdatingId]     = useState<string | null>(null)
  const now         = useNow()
  const currentDate = parseLocalDate(selectedDate)
  const isToday     = formatDateParam(currentDate) === formatDateParam(new Date())

  function navigate(offset: number) {
    const d = new Date(currentDate)
    d.setDate(d.getDate() + offset)
    router.push(`/agenda?date=${formatDateParam(d)}`)
  }

  function openModal(profId?: string) {
    setSelectedProfId(profId)
    setModalOpen(true)
  }

  async function handleStatusChange(id: string, status: string) {
    setUpdatingId(id)
    const result = await updateAppointmentStatus(id, status)
    setUpdatingId(null)
    if (result?.error) toast.error(result.error)
    else toast.success('Status atualizado')
  }

  // Sort appointments chronologically
  const sorted = [...appointments].sort(
    (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
  )

  // Build item list with optional "Agora" divider
  type Item = 'now-divider' | Appointment
  const items: Item[] = []
  let nowInserted = false
  for (const appt of sorted) {
    if (isToday && !nowInserted && new Date(appt.start_at) >= now) {
      items.push('now-divider')
      nowInserted = true
    }
    items.push(appt)
  }

  // Stats for header
  const total     = appointments.length
  const confirmed = appointments.filter(a => a.status === 'confirmed').length
  const active    = appointments.filter(a => a.status !== 'cancelled' && a.status !== 'no_show').length

  // Left sidebar: upcoming / day appointments
  const sidebarAppts = sorted.filter(a => {
    if (a.status === 'cancelled' || a.status === 'no_show') return false
    return !isToday || new Date(a.start_at) > now
  }).slice(0, 6)

  return (
    <>
      <div className="flex h-full overflow-hidden">

        {/* ══ LEFT SIDEBAR: Calendar + Upcoming ═══════════════════════════ */}
        <div className="w-[340px] flex-shrink-0 border-r border-gray-100 bg-white flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            <div className="p-6 space-y-6">

              {/* Brand header */}
              <div>
                <h1 className="text-xl font-bold text-gray-900 tracking-tight">Agenda</h1>
                <p className="text-xs text-gray-400 mt-0.5">Calendário da clínica</p>
              </div>

              {/* Mini calendar */}
              <MiniCalendar
                selectedDate={selectedDate}
                onSelect={date => router.push(`/agenda?date=${date}`)}
              />

              {/* Separator */}
              <div className="h-px bg-gray-100" />

              {/* Upcoming / day appointments */}
              {sidebarAppts.length > 0 ? (
                <div>
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-3">
                    {isToday ? 'Próximas consultas' : 'Consultas do dia'}
                  </p>
                  <div className="space-y-0.5">
                    {sidebarAppts.map(appt => {
                      const patient = appt.patients     as { full_name: string } | null
                      const prof    = appt.professionals as { name: string; color: string } | null
                      const proc    = appt.procedures   as { name: string } | null
                      const timeStr = new Date(appt.start_at).toLocaleTimeString('pt-BR', {
                        hour: '2-digit', minute: '2-digit',
                      })
                      const st = STATUS[appt.status]
                      return (
                        <div
                          key={appt.id}
                          className="flex items-center gap-3 px-2.5 py-2.5 rounded-xl hover:bg-gray-50 transition-colors cursor-default"
                        >
                          <div
                            className="w-[3px] h-10 rounded-full flex-shrink-0"
                            style={{ backgroundColor: prof?.color ?? '#3B82F6' }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-800 truncate leading-tight">
                              {patient?.full_name ?? '—'}
                            </p>
                            {proc && (
                              <p className="text-[11px] text-gray-400 truncate mt-0.5">{proc.name}</p>
                            )}
                            <p className="text-[11px] font-mono text-gray-400 mt-0.5">{timeStr}</p>
                          </div>
                          <span className={cn('w-2 h-2 rounded-full flex-shrink-0', st?.dot ?? 'bg-gray-300')} />
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-center py-3">
                  <p className="text-xs text-gray-400">
                    {isToday ? 'Sem consultas pendentes hoje' : 'Sem consultas neste dia'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ══ RIGHT: Day view ════════════════════════════════════════════════ */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* Day header */}
          <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-100 flex-shrink-0">
            <div className="flex items-center gap-3">
              {/* Prev / Next */}
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => navigate(-1)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => navigate(1)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              {/* Date + badge */}
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-lg font-bold text-gray-900 capitalize leading-tight">
                    {currentDate.toLocaleDateString('pt-BR', {
                      weekday: 'long', day: 'numeric', month: 'long',
                    })}
                  </h2>
                  {isToday && (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                      Hoje
                    </span>
                  )}
                </div>
                {total > 0 && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {total} {total === 1 ? 'consulta' : 'consultas'}
                    {active > 0 && ` · ${confirmed} confirmada${confirmed !== 1 ? 's' : ''}`}
                  </p>
                )}
              </div>
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-2">
              {/* Quick-book pills (visible on lg+) */}
              {professionals.length > 0 && (
                <div className="hidden lg:flex items-center gap-1.5">
                  {professionals.map(p => (
                    <button
                      key={p.id}
                      onClick={() => openModal(p.id)}
                      className="flex items-center gap-1.5 text-[11px] font-medium text-gray-600 hover:text-gray-900 px-2.5 py-1.5 rounded-full border border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm transition-all duration-150">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                      {p.name}
                    </button>
                  ))}
                </div>
              )}

              <Button
                onClick={() => openModal()}
                className="gap-2 bg-blue-600 hover:bg-blue-700 shadow-sm hover:shadow-md transition-all duration-150 hover:-translate-y-px active:translate-y-0">
                <Plus className="h-4 w-4" />
                Novo Evento
              </Button>
            </div>
          </div>

          {/* Appointment list */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3 bg-gray-50/40">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-28 text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center mb-5 shadow-sm">
                  <CalendarDays className="h-8 w-8 text-blue-400" />
                </div>
                <p className="text-base font-semibold text-gray-800 mb-1.5">
                  Nenhuma consulta agendada
                </p>
                <p className="text-sm text-gray-400 max-w-sm leading-relaxed">
                  Seu assistente virtual está ativo e disponível para receber novos agendamentos pelo WhatsApp.
                </p>
                <button
                  onClick={() => openModal()}
                  className="mt-5 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors border border-blue-100">
                  <Plus className="h-4 w-4" />
                  Criar agendamento
                </button>
              </div>
            ) : (
              items.map(item =>
                item === 'now-divider' ? (
                  <div key="now-divider" className="flex items-center gap-3 py-1">
                    <div className="flex-1 h-px bg-red-200" />
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-red-500 bg-red-50 border border-red-200 px-2.5 py-1 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                      Agora
                    </span>
                    <div className="flex-1 h-px bg-red-200" />
                  </div>
                ) : (
                  <BigApptCard
                    key={(item as Appointment).id}
                    appt={item as Appointment}
                    updatingId={updatingId}
                    onStatusChange={handleStatusChange}
                  />
                )
              )
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
