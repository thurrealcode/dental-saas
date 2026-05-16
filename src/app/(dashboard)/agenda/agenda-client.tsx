'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, ChevronLeft, ChevronRight, Clock, User, Stethoscope } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import { BookingModal } from './booking-modal'
import { updateAppointmentStatus } from './actions'
import { toast } from 'sonner'

const statusMap = {
  scheduled:   { label: 'Agendado',      class: 'bg-blue-500/10 text-blue-400 border-blue-500/20',    bar: 'bg-blue-500' },
  confirmed:   { label: 'Confirmado',    class: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', bar: 'bg-emerald-500' },
  in_progress: { label: 'Em andamento',  class: 'bg-amber-500/10 text-amber-400 border-amber-500/20', bar: 'bg-amber-500' },
  completed:   { label: 'Concluído',     class: 'bg-slate-500/10 text-slate-400 border-slate-500/20', bar: 'bg-slate-500' },
  cancelled:   { label: 'Cancelado',     class: 'bg-red-500/10 text-red-400 border-red-500/20',       bar: 'bg-red-500' },
  no_show:     { label: 'Faltou',        class: 'bg-orange-500/10 text-orange-400 border-orange-500/20', bar: 'bg-orange-400' },
}

type StatusKey = keyof typeof statusMap

interface Patient { id: string; full_name: string }
interface Professional { id: string; name: string; specialty: string | null; color: string }
interface Procedure { id: string; name: string; duration_minutes: number; color: string }

interface Appointment {
  id: string
  title: string
  status: StatusKey
  start_at: string
  end_at: string
  notes: string | null
  patients: unknown
  professionals: unknown
  procedures: unknown
}

interface AgendaClientProps {
  appointments: Appointment[]
  patients: Patient[]
  professionals: Professional[]
  procedures: Procedure[]
  selectedDate: string
}

const HOURS = Array.from({ length: 13 }, (_, i) => i + 7) // 7h-19h

function formatDateParam(d: Date) {
  return d.toISOString().slice(0, 10)
}

function parseLocalDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function AgendaClient({ appointments, patients, professionals, procedures, selectedDate }: AgendaClientProps) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedProfId, setSelectedProfId] = useState<string | undefined>()
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const currentDate = parseLocalDate(selectedDate)

  function navigate(offset: number) {
    const d = new Date(currentDate)
    d.setDate(d.getDate() + offset)
    router.push(`/agenda?date=${formatDateParam(d)}`)
  }

  function goToday() {
    router.push(`/agenda?date=${formatDateParam(new Date())}`)
  }

  function openModal(professionalId?: string) {
    setSelectedProfId(professionalId)
    setModalOpen(true)
  }

  async function handleStatusChange(appointmentId: string, status: string) {
    setUpdatingId(appointmentId)
    const result = await updateAppointmentStatus(appointmentId, status)
    setUpdatingId(null)
    if (result?.error) {
      toast.error(result.error)
    } else {
      toast.success('Status atualizado')
    }
  }

  const isToday = formatDateParam(currentDate) === formatDateParam(new Date())

  return (
    <>
      <div className="flex flex-col gap-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Agenda</h1>
            <p className="text-slate-400 text-sm mt-1">
              {currentDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              {isToday && <span className="ml-2 text-blue-400">(hoje)</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate(-1)}
              className="border-slate-700 text-slate-400 hover:text-white bg-slate-800"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={goToday}
              className="border-slate-700 text-slate-300 bg-slate-800 hover:text-white"
            >
              Hoje
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate(1)}
              className="border-slate-700 text-slate-400 hover:text-white bg-slate-800"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button onClick={() => openModal()} className="bg-blue-600 hover:bg-blue-700 gap-2 ml-2">
              <Plus className="h-4 w-4" />
              Agendar
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Time grid */}
          <Card className="lg:col-span-2 border-slate-800 bg-slate-900">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-sm font-medium flex items-center justify-between">
                <span>{appointments.length} consulta{appointments.length !== 1 ? 's' : ''}</span>
                {professionals.length > 0 && (
                  <div className="flex items-center gap-2">
                    {professionals.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => openModal(p.id)}
                        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
                        title={`Agendar com ${p.name}`}
                      >
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                        {p.name}
                      </button>
                    ))}
                  </div>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {HOURS.map((hour) => {
                const hourAppts = appointments.filter((a) => {
                  return new Date(a.start_at).getHours() === hour
                })
                return (
                  <div key={hour} className="flex border-b border-slate-800/60 last:border-0">
                    <div className="w-14 flex-shrink-0 py-3 px-3 text-xs text-slate-600 text-right font-mono">
                      {String(hour).padStart(2, '0')}:00
                    </div>
                    <div className="flex-1 min-h-[60px] px-3 py-2 space-y-1.5">
                      {hourAppts.map((appt) => {
                        const patient = appt.patients as { full_name: string } | null
                        const professional = appt.professionals as { name: string; color: string } | null
                        const procedure = appt.procedures as { name: string } | null
                        const status = statusMap[appt.status] ?? statusMap.scheduled
                        const duration = Math.round(
                          (new Date(appt.end_at).getTime() - new Date(appt.start_at).getTime()) / 60000
                        )
                        const startStr = new Date(appt.start_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

                        return (
                          <div
                            key={appt.id}
                            className="rounded-lg border border-slate-700/60 bg-slate-800/60 overflow-hidden group"
                          >
                            <div
                              className="h-0.5 w-full"
                              style={{ backgroundColor: professional?.color ?? '#3B82F6' }}
                            />
                            <div className="px-3 py-2 flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-slate-500 font-mono">{startStr}</span>
                                  <Badge variant="outline" className={cn('text-[10px] py-0 h-4', status.class)}>
                                    {status.label}
                                  </Badge>
                                </div>
                                <p className="text-sm font-medium text-white mt-0.5 truncate">
                                  {patient?.full_name ?? '—'}
                                </p>
                                <div className="flex items-center gap-3 mt-0.5">
                                  {procedure && (
                                    <span className="flex items-center gap-1 text-xs text-slate-400">
                                      <Stethoscope className="h-3 w-3" />
                                      {procedure.name}
                                    </span>
                                  )}
                                  {professional && (
                                    <span className="flex items-center gap-1 text-xs text-slate-400">
                                      <User className="h-3 w-3" />
                                      {professional.name}
                                    </span>
                                  )}
                                  <span className="flex items-center gap-1 text-xs text-slate-500">
                                    <Clock className="h-3 w-3" />
                                    {duration}min
                                  </span>
                                </div>
                              </div>
                              {/* Quick status actions */}
                              <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                {appt.status === 'scheduled' && (
                                  <button
                                    onClick={() => handleStatusChange(appt.id, 'confirmed')}
                                    disabled={updatingId === appt.id}
                                    className="text-[10px] px-2 py-1 rounded bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/40 transition-colors border border-emerald-500/20"
                                  >
                                    Confirmar
                                  </button>
                                )}
                                {(appt.status === 'scheduled' || appt.status === 'confirmed') && (
                                  <button
                                    onClick={() => handleStatusChange(appt.id, 'completed')}
                                    disabled={updatingId === appt.id}
                                    className="text-[10px] px-2 py-1 rounded bg-slate-600/40 text-slate-300 hover:bg-slate-600/60 transition-colors border border-slate-600/40"
                                  >
                                    Concluir
                                  </button>
                                )}
                                {appt.status !== 'cancelled' && appt.status !== 'completed' && (
                                  <button
                                    onClick={() => handleStatusChange(appt.id, 'cancelled')}
                                    disabled={updatingId === appt.id}
                                    className="text-[10px] px-2 py-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors border border-red-500/20"
                                  >
                                    Cancelar
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>

          {/* Right panel */}
          <div className="space-y-4">
            {/* Status summary */}
            <Card className="border-slate-800 bg-slate-900">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-white">Resumo do dia</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {Object.entries(statusMap).map(([key, val]) => {
                  const count = appointments.filter((a) => a.status === key).length
                  if (count === 0) return null
                  return (
                    <div key={key} className="flex items-center justify-between">
                      <Badge variant="outline" className={cn('text-xs', val.class)}>{val.label}</Badge>
                      <span className="text-sm font-medium text-white">{count}</span>
                    </div>
                  )
                })}
                {appointments.length === 0 && (
                  <p className="text-sm text-slate-500 text-center py-2">Nenhuma consulta</p>
                )}
              </CardContent>
            </Card>

            {/* Professionals */}
            {professionals.length > 0 && (
              <Card className="border-slate-800 bg-slate-900">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-white">Profissionais</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {professionals.map((prof) => {
                    const count = appointments.filter(
                      (a) => (a.professionals as { name: string } | null) !== null &&
                        JSON.stringify(a.professionals).includes(prof.name)
                    ).length
                    return (
                      <div key={prof.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: prof.color }} />
                          <div>
                            <p className="text-sm text-white">{prof.name}</p>
                            {prof.specialty && <p className="text-xs text-slate-500">{prof.specialty}</p>}
                          </div>
                        </div>
                        <span className="text-xs text-slate-400">{count} consulta{count !== 1 ? 's' : ''}</span>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            )}

            {professionals.length === 0 && (
              <Card className="border-slate-800 bg-slate-900 border-dashed">
                <CardContent className="py-6 text-center space-y-2">
                  <p className="text-sm text-slate-400">Nenhum profissional cadastrado</p>
                  <p className="text-xs text-slate-500">Adicione profissionais em Configurações</p>
                </CardContent>
              </Card>
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
