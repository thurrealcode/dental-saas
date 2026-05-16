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
  scheduled:   { label: 'Agendado',     class: 'bg-blue-50 text-blue-700 border-blue-200',       bar: 'bg-blue-500' },
  confirmed:   { label: 'Confirmado',   class: 'bg-emerald-50 text-emerald-700 border-emerald-200', bar: 'bg-emerald-500' },
  in_progress: { label: 'Em andamento', class: 'bg-amber-50 text-amber-700 border-amber-200',     bar: 'bg-amber-400' },
  completed:   { label: 'Concluído',    class: 'bg-gray-100 text-gray-500 border-gray-200',       bar: 'bg-gray-400' },
  cancelled:   { label: 'Cancelado',    class: 'bg-red-50 text-red-600 border-red-200',           bar: 'bg-red-400' },
  no_show:     { label: 'Faltou',       class: 'bg-orange-50 text-orange-600 border-orange-200',  bar: 'bg-orange-400' },
}

type StatusKey = keyof typeof statusMap

interface Patient { id: string; full_name: string }
interface Professional { id: string; name: string; specialty: string | null; color: string }
interface Procedure { id: string; name: string; duration_minutes: number; color: string }
interface Appointment {
  id: string; title: string; status: StatusKey
  start_at: string; end_at: string; notes: string | null
  patients: unknown; professionals: unknown; procedures: unknown
}

interface AgendaClientProps {
  appointments: Appointment[]
  patients: Patient[]
  professionals: Professional[]
  procedures: Procedure[]
  selectedDate: string
}

const HOURS = Array.from({ length: 13 }, (_, i) => i + 7)

function formatDateParam(d: Date) { return d.toISOString().slice(0, 10) }
function parseLocalDate(s: string) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }

export function AgendaClient({ appointments, patients, professionals, procedures, selectedDate }: AgendaClientProps) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedProfId, setSelectedProfId] = useState<string | undefined>()
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const currentDate = parseLocalDate(selectedDate)

  function navigate(offset: number) {
    const d = new Date(currentDate); d.setDate(d.getDate() + offset)
    router.push(`/agenda?date=${formatDateParam(d)}`)
  }

  function openModal(profId?: string) { setSelectedProfId(profId); setModalOpen(true) }

  async function handleStatusChange(appointmentId: string, status: string) {
    setUpdatingId(appointmentId)
    const result = await updateAppointmentStatus(appointmentId, status)
    setUpdatingId(null)
    if (result?.error) toast.error(result.error)
    else toast.success('Status atualizado')
  }

  const isToday = formatDateParam(currentDate) === formatDateParam(new Date())

  return (
    <>
      <div className="flex flex-col gap-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Agenda</h1>
            <p className="text-gray-500 text-sm mt-1">
              {currentDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              {isToday && <span className="ml-2 text-blue-600 font-medium">(hoje)</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => navigate(-1)}
              className="border-gray-200 text-gray-500 hover:text-gray-900 hover:bg-gray-50 bg-white shadow-sm">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => router.push(`/agenda?date=${formatDateParam(new Date())}`)}
              className="border-gray-200 text-gray-600 bg-white hover:bg-gray-50 shadow-sm">
              Hoje
            </Button>
            <Button variant="outline" size="icon" onClick={() => navigate(1)}
              className="border-gray-200 text-gray-500 hover:text-gray-900 hover:bg-gray-50 bg-white shadow-sm">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button onClick={() => openModal()} className="bg-blue-600 hover:bg-blue-700 gap-2 ml-2 shadow-sm">
              <Plus className="h-4 w-4" />
              Agendar
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Time grid */}
          <Card className="lg:col-span-2 border-gray-200 bg-white shadow-sm">
            <CardHeader className="pb-3 border-b border-gray-100">
              <CardTitle className="text-gray-900 text-sm font-semibold flex items-center justify-between">
                <span>{appointments.length} consulta{appointments.length !== 1 ? 's' : ''}</span>
                {professionals.length > 0 && (
                  <div className="flex items-center gap-3">
                    {professionals.map((p) => (
                      <button key={p.id} onClick={() => openModal(p.id)}
                        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors"
                        title={`Agendar com ${p.name}`}>
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
                const hourAppts = appointments.filter((a) => new Date(a.start_at).getHours() === hour)
                return (
                  <div key={hour} className="flex border-b border-gray-50 last:border-0">
                    <div className="w-14 flex-shrink-0 py-3 px-3 text-xs text-gray-300 text-right font-mono">
                      {String(hour).padStart(2, '0')}:00
                    </div>
                    <div className="flex-1 min-h-[60px] px-3 py-2 space-y-1.5">
                      {hourAppts.map((appt) => {
                        const patient = appt.patients as { full_name: string } | null
                        const professional = appt.professionals as { name: string; color: string } | null
                        const procedure = appt.procedures as { name: string } | null
                        const status = statusMap[appt.status] ?? statusMap.scheduled
                        const duration = Math.round((new Date(appt.end_at).getTime() - new Date(appt.start_at).getTime()) / 60000)
                        const startStr = new Date(appt.start_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

                        return (
                          <div key={appt.id} className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden group hover:shadow-md transition-shadow">
                            <div className="h-0.5 w-full" style={{ backgroundColor: professional?.color ?? '#3B82F6' }} />
                            <div className="px-3 py-2 flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-gray-400 font-mono">{startStr}</span>
                                  <Badge variant="outline" className={cn('text-[10px] py-0 h-4', status.class)}>
                                    {status.label}
                                  </Badge>
                                </div>
                                <p className="text-sm font-semibold text-gray-900 mt-0.5 truncate">{patient?.full_name ?? '—'}</p>
                                <div className="flex items-center gap-3 mt-0.5">
                                  {procedure && (
                                    <span className="flex items-center gap-1 text-xs text-gray-400">
                                      <Stethoscope className="h-3 w-3" />{procedure.name}
                                    </span>
                                  )}
                                  {professional && (
                                    <span className="flex items-center gap-1 text-xs text-gray-400">
                                      <User className="h-3 w-3" />{professional.name}
                                    </span>
                                  )}
                                  <span className="flex items-center gap-1 text-xs text-gray-300">
                                    <Clock className="h-3 w-3" />{duration}min
                                  </span>
                                </div>
                              </div>
                              <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                {appt.status === 'scheduled' && (
                                  <button onClick={() => handleStatusChange(appt.id, 'confirmed')} disabled={updatingId === appt.id}
                                    className="text-[10px] px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors">
                                    Confirmar
                                  </button>
                                )}
                                {(appt.status === 'scheduled' || appt.status === 'confirmed') && (
                                  <button onClick={() => handleStatusChange(appt.id, 'completed')} disabled={updatingId === appt.id}
                                    className="text-[10px] px-2 py-1 rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200 transition-colors">
                                    Concluir
                                  </button>
                                )}
                                {appt.status !== 'cancelled' && appt.status !== 'completed' && (
                                  <button onClick={() => handleStatusChange(appt.id, 'cancelled')} disabled={updatingId === appt.id}
                                    className="text-[10px] px-2 py-1 rounded-md bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-colors">
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
            <Card className="border-gray-200 bg-white shadow-sm">
              <CardHeader className="pb-3 border-b border-gray-100">
                <CardTitle className="text-sm text-gray-900 font-semibold">Resumo do dia</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-3">
                {Object.entries(statusMap).map(([key, val]) => {
                  const count = appointments.filter((a) => a.status === key).length
                  if (count === 0) return null
                  return (
                    <div key={key} className="flex items-center justify-between">
                      <Badge variant="outline" className={cn('text-xs', val.class)}>{val.label}</Badge>
                      <span className="text-sm font-semibold text-gray-900">{count}</span>
                    </div>
                  )
                })}
                {appointments.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-3">Nenhuma consulta</p>
                )}
              </CardContent>
            </Card>

            {professionals.length > 0 && (
              <Card className="border-gray-200 bg-white shadow-sm">
                <CardHeader className="pb-3 border-b border-gray-100">
                  <CardTitle className="text-sm text-gray-900 font-semibold">Profissionais</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2.5 pt-3">
                  {professionals.map((prof) => (
                    <div key={prof.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: prof.color }} />
                        <div>
                          <p className="text-sm text-gray-800 font-medium">{prof.name}</p>
                          {prof.specialty && <p className="text-xs text-gray-400">{prof.specialty}</p>}
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {professionals.length === 0 && (
              <Card className="border-gray-200 border-dashed bg-white">
                <CardContent className="py-6 text-center space-y-1">
                  <p className="text-sm text-gray-400">Nenhum profissional</p>
                  <a href="/settings" className="text-xs text-blue-500 hover:underline">Adicionar em Configurações</a>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      <BookingModal open={modalOpen} onClose={() => setModalOpen(false)}
        patients={patients} professionals={professionals} procedures={procedures}
        defaultDate={selectedDate} defaultProfessionalId={selectedProfId} />
    </>
  )
}
