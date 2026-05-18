'use client'

import { useState, useEffect } from 'react'
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

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS = {
  scheduled:   { label: 'Agendado',     dot: 'bg-blue-500',    pill: 'bg-blue-50 text-blue-700 border-blue-200' },
  confirmed:   { label: 'Confirmado',   dot: 'bg-emerald-500', pill: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  in_progress: { label: 'Em andamento', dot: 'bg-amber-500',   pill: 'bg-amber-50 text-amber-700 border-amber-200' },
  completed:   { label: 'Concluído',    dot: 'bg-slate-400',   pill: 'bg-slate-100 text-slate-600 border-slate-200' },
  cancelled:   { label: 'Cancelado',    dot: 'bg-red-400',     pill: 'bg-red-50 text-red-600 border-red-200' },
  no_show:     { label: 'Faltou',       dot: 'bg-orange-400',  pill: 'bg-orange-50 text-orange-600 border-orange-200' },
} as const

type StatusKey = keyof typeof STATUS

// ── Types ─────────────────────────────────────────────────────────────────────

interface Patient     { id: string; full_name: string }
interface Professional { id: string; name: string; specialty: string | null; color: string }
interface Procedure   { id: string; name: string; duration_minutes: number; color: string }
interface Appointment {
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

// ── Constants ─────────────────────────────────────────────────────────────────

const HOURS = Array.from({ length: 13 }, (_, i) => i + 7) // 7 → 19
const HOUR_H = 80 // px per hour row

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── Appointment card ──────────────────────────────────────────────────────────

function ApptCard({
  appt, updatingId, onStatusChange,
}: {
  appt: Appointment
  updatingId: string | null
  onStatusChange: (id: string, status: string) => void
}) {
  const patient    = appt.patients    as { full_name: string } | null
  const prof       = appt.professionals as { name: string; color: string } | null
  const procedure  = appt.procedures  as { name: string } | null
  const st         = STATUS[appt.status] ?? STATUS.scheduled
  const duration   = Math.round((new Date(appt.end_at).getTime() - new Date(appt.start_at).getTime()) / 60_000)
  const startStr   = new Date(appt.start_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const endStr     = new Date(appt.end_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const isUpdating = updatingId === appt.id

  return (
    <div className="group relative rounded-xl border border-gray-100 bg-white shadow-sm hover:shadow-md hover:-translate-y-px transition-all duration-200 overflow-hidden">
      {/* Professional color bar */}
      <div className="absolute inset-y-0 left-0 w-[3px]" style={{ backgroundColor: prof?.color ?? '#3B82F6' }} />

      <div className="pl-4 pr-3 py-3">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            {/* Time + status */}
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

            {/* Patient name */}
            <p className="text-sm font-semibold text-gray-900 truncate leading-snug">
              {patient?.full_name ?? '—'}
            </p>

            {/* Meta */}
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

          {/* Actions — appear on hover */}
          <div className="flex-shrink-0 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            {appt.status === 'scheduled' && (
              <button onClick={() => onStatusChange(appt.id, 'confirmed')} disabled={isUpdating}
                className="text-[10px] px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors font-medium whitespace-nowrap">
                ✓ Confirmar
              </button>
            )}
            {(appt.status === 'scheduled' || appt.status === 'confirmed' || appt.status === 'in_progress') && (
              <button onClick={() => onStatusChange(appt.id, 'completed')} disabled={isUpdating}
                className="text-[10px] px-2 py-1 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200 transition-colors font-medium whitespace-nowrap">
                Concluir
              </button>
            )}
            {appt.status !== 'cancelled' && appt.status !== 'completed' && appt.status !== 'no_show' && (
              <button onClick={() => onStatusChange(appt.id, 'cancelled')} disabled={isUpdating}
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

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-3.5">
      <p className="text-[11px] text-gray-400 font-medium mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900 tabular-nums leading-none">{value}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function AgendaClient({ appointments, patients, professionals, procedures, selectedDate }: Props) {
  const router       = useRouter()
  const [modalOpen, setModalOpen]     = useState(false)
  const [selectedProfId, setSelectedProfId] = useState<string | undefined>()
  const [updatingId, setUpdatingId]   = useState<string | null>(null)
  const now          = useNow()
  const currentDate  = parseLocalDate(selectedDate)
  const isToday      = formatDateParam(currentDate) === formatDateParam(new Date())

  function navigate(offset: number) {
    const d = new Date(currentDate)
    d.setDate(d.getDate() + offset)
    router.push(`/agenda?date=${formatDateParam(d)}`)
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

  // Stats
  const total       = appointments.length
  const confirmed   = appointments.filter(a => a.status === 'confirmed').length
  const active      = appointments.filter(a => a.status !== 'cancelled' && a.status !== 'no_show').length
  const confirmRate = active > 0 ? Math.round((confirmed / active) * 100) : 0

  const upcoming = appointments
    .filter(a => new Date(a.start_at) > now && a.status !== 'cancelled' && a.status !== 'no_show')
    .slice(0, 4)

  // Current time line
  const nowHour    = now.getHours()
  const nowMinutes = now.getMinutes()
  const showTimeLine = isToday && nowHour >= HOURS[0] && nowHour <= HOURS[HOURS.length - 1]

  return (
    <>
      <div className="flex flex-col" style={{ height: '100%' }}>

        {/* ── Header ───────────────────────────────────────────────── */}
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
            {/* Date nav */}
            <div className="flex items-center rounded-lg border border-gray-200 overflow-hidden bg-white shadow-sm">
              <button onClick={() => navigate(-1)}
                className="px-2.5 py-2 hover:bg-gray-50 text-gray-500 hover:text-gray-900 transition-colors border-r border-gray-100">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button onClick={() => router.push(`/agenda?date=${formatDateParam(new Date())}`)}
                className="px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                Hoje
              </button>
              <button onClick={() => navigate(1)}
                className="px-2.5 py-2 hover:bg-gray-50 text-gray-500 hover:text-gray-900 transition-colors border-l border-gray-100">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* CTA */}
            <Button
              onClick={() => openModal()}
              className="gap-2 bg-blue-600 hover:bg-blue-700 shadow-sm hover:shadow-md transition-all duration-150 hover:-translate-y-px active:translate-y-0">
              <Plus className="h-4 w-4" />
              Agendar
            </Button>
          </div>
        </div>

        {/* ── Body ─────────────────────────────────────────────────── */}
        <div className="flex flex-1 overflow-hidden">

          {/* ── Timeline ─────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto bg-white">

            {/* Professional pills */}
            {professionals.length > 0 && (
              <div className="sticky top-0 z-10 flex items-center gap-2 px-4 py-2.5 bg-white/95 border-b border-gray-50 backdrop-blur-sm">
                <span className="text-[11px] text-gray-400 font-medium flex-shrink-0">Agendar com</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {professionals.map(p => (
                    <button key={p.id} onClick={() => openModal(p.id)}
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
                  className={cn('flex border-b border-gray-50 last:border-0 relative transition-colors', isCurrent && 'bg-blue-50/30')}>
                  {/* Hour label */}
                  <div className="w-16 flex-shrink-0 text-right px-3 pt-3 select-none">
                    <span className={cn('text-[11px] font-mono', isCurrent ? 'text-blue-500 font-semibold' : 'text-gray-300')}>
                      {String(hour).padStart(2, '0')}:00
                    </span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 px-3 py-2 space-y-2 relative" style={{ minHeight: `${HOUR_H}px` }}>
                    {/* Current time indicator */}
                    {isCurrent && (
                      <div className="absolute left-0 right-3 flex items-center pointer-events-none z-10"
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
                <button onClick={() => openModal()}
                  className="pointer-events-auto mt-5 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors border border-blue-100">
                  <Plus className="h-4 w-4" />
                  Criar agendamento
                </button>
              </div>
            )}
          </div>

          {/* ── Right sidebar ─────────────────────────────────────── */}
          <div className="w-72 flex-shrink-0 overflow-y-auto border-l border-gray-100 bg-gray-50/40 p-4 space-y-3">

            {/* Stats */}
            <div className="grid grid-cols-2 gap-2">
              <StatCard label="Total hoje" value={total} sub={total === 1 ? 'consulta' : 'consultas'} />
              <StatCard label="Confirmados" value={confirmed} sub={`de ${active} ativos`} />
            </div>

            {/* Confirmation rate */}
            {active > 0 && (
              <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-gray-500">
                    <CheckCheck className="h-3.5 w-3.5 text-emerald-500" />
                    Taxa de confirmação
                  </div>
                  <span className="text-sm font-bold text-gray-900">{confirmRate}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                    style={{ width: `${confirmRate}%` }} />
                </div>
              </div>
            )}

            {/* Status breakdown */}
            {total > 0 && (
              <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-3.5">
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-3">Por status</p>
                <div className="space-y-2">
                  {(Object.entries(STATUS) as [StatusKey, typeof STATUS[StatusKey]][]).map(([key, val]) => {
                    const count = appointments.filter(a => a.status === key).length
                    if (!count) return null
                    const pct = Math.round((count / total) * 100)
                    return (
                      <div key={key} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-2 text-xs text-gray-600">
                            <span className={cn('w-2 h-2 rounded-full flex-shrink-0', val.dot)} />
                            {val.label}
                          </span>
                          <span className="text-xs font-semibold text-gray-900 tabular-nums">{count}</span>
                        </div>
                        <div className="h-1 rounded-full bg-gray-100 overflow-hidden">
                          <div className={cn('h-full rounded-full transition-all duration-500', val.dot)}
                            style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

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
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 shadow-sm"
                          style={{ backgroundColor: prof.color }}>
                          {initials(prof.name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-800 truncate">{prof.name}</p>
                          {prof.specialty && <p className="text-[10px] text-gray-400 truncate">{prof.specialty}</p>}
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
                    const patient = appt.patients as { full_name: string } | null
                    const prof    = appt.professionals as { name: string; color: string } | null
                    const proc    = appt.procedures as { name: string } | null
                    const timeStr = new Date(appt.start_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                    return (
                      <div key={appt.id} className="flex items-start gap-2.5">
                        <div className="w-1 h-10 rounded-full flex-shrink-0 mt-0.5"
                          style={{ backgroundColor: prof?.color ?? '#3B82F6' }} />
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
