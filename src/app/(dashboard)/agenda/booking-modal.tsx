'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, AlertCircle, UserCog, Stethoscope } from 'lucide-react'
import { toast } from 'sonner'
import { createAppointment } from './actions'

interface Patient { id: string; full_name: string }
interface Professional { id: string; name: string; specialty: string | null; color: string }
interface Procedure { id: string; name: string; duration_minutes: number; color: string }

interface BookingModalProps {
  open: boolean; onClose: () => void
  patients: Patient[]; professionals: Professional[]; procedures: Procedure[]
  defaultDate?: string; defaultProfessionalId?: string
}

export function BookingModal({ open, onClose, patients, professionals, procedures, defaultDate, defaultProfessionalId }: BookingModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [patientId, setPatientId] = useState('')
  const [professionalId, setProfessionalId] = useState(defaultProfessionalId ?? '')
  const [procedureId, setProcedureId] = useState('')
  const [customTitle, setCustomTitle] = useState('')
  const [date, setDate] = useState(defaultDate ?? new Date().toISOString().slice(0, 10))
  const [startTime, setStartTime] = useState('08:00')
  const [endTime, setEndTime] = useState('08:30')
  const [notes, setNotes] = useState('')

  useEffect(() => { if (defaultProfessionalId) setProfessionalId(defaultProfessionalId) }, [defaultProfessionalId])
  useEffect(() => { if (defaultDate) setDate(defaultDate) }, [defaultDate])

  function calcEnd(start: string, dur: number) {
    const [h, m] = start.split(':').map(Number)
    const t = h * 60 + m + dur
    return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
  }

  function handleProcedureChange(id: string) {
    setProcedureId(id)
    const proc = procedures.find((p) => p.id === id)
    if (proc) setEndTime(calcEnd(startTime, proc.duration_minutes))
  }

  function handleStartTimeChange(time: string) {
    setStartTime(time)
    const proc = procedures.find((p) => p.id === procedureId)
    setEndTime(calcEnd(time, proc?.duration_minutes ?? 30))
  }

  function reset() {
    setPatientId(''); setProcedureId(''); setCustomTitle(''); setNotes(''); setError('')
    setStartTime('08:00'); setEndTime('08:30'); setProfessionalId(defaultProfessionalId ?? '')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!patientId || !date || !startTime || !endTime) return
    setLoading(true)
    setError('')

    const proc = procedures.find((p) => p.id === procedureId)
    const prof = professionals.find((p) => p.id === professionalId)
    const patient = patients.find((p) => p.id === patientId)
    const title = customTitle.trim() || proc?.name || (prof ? `Consulta - ${prof.name}` : `Consulta - ${patient?.full_name}`)

    const result = await createAppointment({
      patient_id: patientId, professional_id: professionalId || undefined,
      procedure_id: procedureId || undefined,
      start_at: `${date}T${startTime}:00`, end_at: `${date}T${endTime}:00`,
      title, notes,
    })

    setLoading(false)
    if (result?.error) { setError(result.error); return }
    toast.success('Consulta agendada!')
    reset(); onClose()
  }

  const canSubmit = !!patientId && !!date && !!startTime && !!endTime && startTime < endTime

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose() } }}>
      <DialogContent className="bg-white border-gray-200 text-gray-900 sm:max-w-lg shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-gray-900 font-semibold">Nova Consulta</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Patient */}
          <div className="space-y-1.5">
            <Label className="text-gray-700 text-sm">Paciente <span className="text-red-500">*</span></Label>
            {patients.length === 0 ? (
              <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-700">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                Nenhum paciente.{' '}
                <a href="/patients" className="underline hover:text-amber-900">Cadastrar agora</a>
              </div>
            ) : (
              <Select value={patientId} onValueChange={(v) => v && setPatientId(v)}>
                <SelectTrigger className="bg-white border-gray-200 text-gray-900 focus:ring-blue-500">
                  <SelectValue placeholder="Selecionar paciente..." />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-200 max-h-48">
                  {patients.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-gray-900 focus:bg-gray-50">{p.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Professional */}
          <div className="space-y-1.5">
            <Label className="text-gray-700 text-sm flex items-center gap-1.5">
              <UserCog className="h-3.5 w-3.5 text-gray-400" />
              Profissional <span className="text-gray-400 font-normal">(opcional)</span>
            </Label>
            {professionals.length === 0 ? (
              <p className="text-xs text-gray-400 py-1">
                <a href="/settings" className="text-blue-500 hover:underline">Adicionar profissionais em Configurações</a>
              </p>
            ) : (
              <Select value={professionalId} onValueChange={(v) => v && setProfessionalId(v)}>
                <SelectTrigger className="bg-white border-gray-200 text-gray-900 focus:ring-blue-500">
                  <SelectValue placeholder="Sem profissional definido" />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-200">
                  {professionals.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-gray-900 focus:bg-gray-50">
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                        {p.name}{p.specialty && <span className="text-gray-400 text-xs">· {p.specialty}</span>}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Procedure */}
          <div className="space-y-1.5">
            <Label className="text-gray-700 text-sm flex items-center gap-1.5">
              <Stethoscope className="h-3.5 w-3.5 text-gray-400" />
              Procedimento <span className="text-gray-400 font-normal">(opcional)</span>
            </Label>
            {procedures.length === 0 ? (
              <p className="text-xs text-gray-400 py-1">
                <a href="/settings" className="text-blue-500 hover:underline">Adicionar procedimentos em Configurações</a>
              </p>
            ) : (
              <Select value={procedureId} onValueChange={(v) => v && handleProcedureChange(v)}>
                <SelectTrigger className="bg-white border-gray-200 text-gray-900 focus:ring-blue-500">
                  <SelectValue placeholder="Sem procedimento definido" />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-200">
                  {procedures.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-gray-900 focus:bg-gray-50">
                      {p.name}<span className="text-gray-400 ml-1">· {p.duration_minutes}min</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label className="text-gray-700 text-sm">Título <span className="text-gray-400 font-normal">(opcional — gerado automaticamente)</span></Label>
            <Input value={customTitle} onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="Ex: Avaliação inicial"
              className="bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 focus-visible:ring-blue-500" />
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-gray-700 text-sm">Data</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required
                className="bg-white border-gray-200 text-gray-900 focus-visible:ring-blue-500" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-gray-700 text-sm">Início</Label>
              <Input type="time" value={startTime} onChange={(e) => handleStartTimeChange(e.target.value)} required
                className="bg-white border-gray-200 text-gray-900 focus-visible:ring-blue-500" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-gray-700 text-sm">Fim</Label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required
                className="bg-white border-gray-200 text-gray-900 focus-visible:ring-blue-500" />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-gray-700 text-sm">Observações <span className="text-gray-400 font-normal">(opcional)</span></Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anotações sobre a consulta..."
              className="bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 resize-none focus-visible:ring-blue-500" rows={2} />
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />{error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => { reset(); onClose() }}
              className="border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50">Cancelar</Button>
            <Button type="submit" disabled={loading || !canSubmit || patients.length === 0} className="bg-blue-600 hover:bg-blue-700 shadow-sm">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Agendar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
