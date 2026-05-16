'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { createAppointment } from './actions'

interface Patient { id: string; full_name: string }
interface Professional { id: string; name: string; specialty: string | null; color: string }
interface Procedure { id: string; name: string; duration_minutes: number; color: string }

interface BookingModalProps {
  open: boolean
  onClose: () => void
  patients: Patient[]
  professionals: Professional[]
  procedures: Procedure[]
  defaultDate?: string
  defaultProfessionalId?: string
}

export function BookingModal({
  open,
  onClose,
  patients,
  professionals,
  procedures,
  defaultDate,
  defaultProfessionalId,
}: BookingModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [patientId, setPatientId] = useState('')
  const [professionalId, setProfessionalId] = useState(defaultProfessionalId ?? '')
  const [procedureId, setProcedureId] = useState('')
  const [date, setDate] = useState(defaultDate ?? new Date().toISOString().slice(0, 10))
  const [startTime, setStartTime] = useState('08:00')
  const [endTime, setEndTime] = useState('08:30')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (defaultProfessionalId) setProfessionalId(defaultProfessionalId)
  }, [defaultProfessionalId])

  useEffect(() => {
    if (defaultDate) setDate(defaultDate)
  }, [defaultDate])

  // Auto-calculate end time from procedure duration
  function handleProcedureChange(id: string) {
    setProcedureId(id)
    const proc = procedures.find((p) => p.id === id)
    if (proc) {
      const [h, m] = startTime.split(':').map(Number)
      const totalMinutes = h * 60 + m + proc.duration_minutes
      const endH = Math.floor(totalMinutes / 60)
      const endM = totalMinutes % 60
      setEndTime(`${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`)
    }
  }

  function handleStartTimeChange(time: string) {
    setStartTime(time)
    const proc = procedures.find((p) => p.id === procedureId)
    const duration = proc ? proc.duration_minutes : 30
    const [h, m] = time.split(':').map(Number)
    const totalMinutes = h * 60 + m + duration
    const endH = Math.floor(totalMinutes / 60)
    const endM = totalMinutes % 60
    setEndTime(`${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`)
  }

  function reset() {
    setPatientId('')
    setProcedureId('')
    setNotes('')
    setError('')
    setStartTime('08:00')
    setEndTime('08:30')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!patientId || !professionalId || !date || !startTime || !endTime) return

    setLoading(true)
    setError('')

    const patient = patients.find((p) => p.id === patientId)
    const proc = procedures.find((p) => p.id === procedureId)
    const professional = professionals.find((p) => p.id === professionalId)

    const title = proc ? proc.name : `Consulta - ${professional?.name}`

    const result = await createAppointment({
      patient_id: patientId,
      professional_id: professionalId,
      procedure_id: procedureId || undefined,
      start_at: `${date}T${startTime}:00`,
      end_at: `${date}T${endTime}:00`,
      title,
      notes,
    })

    setLoading(false)

    if (result?.error) {
      setError(result.error)
      return
    }

    toast.success('Consulta agendada com sucesso!')
    reset()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose() } }}>
      <DialogContent className="bg-slate-900 border-slate-800 text-white sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white">Nova Consulta</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Patient */}
          <div className="space-y-1.5">
            <Label className="text-slate-300">Paciente</Label>
            <Select value={patientId} onValueChange={(v) => v && setPatientId(v)} required>
              <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                <SelectValue placeholder="Selecionar paciente..." />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {patients.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-white focus:bg-slate-700">
                    {p.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Professional */}
          <div className="space-y-1.5">
            <Label className="text-slate-300">Profissional</Label>
            <Select value={professionalId} onValueChange={(v) => v && setProfessionalId(v)} required>
              <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                <SelectValue placeholder="Selecionar profissional..." />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {professionals.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-white focus:bg-slate-700">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                      {p.name}
                      {p.specialty && <span className="text-slate-400 text-xs">· {p.specialty}</span>}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Procedure */}
          <div className="space-y-1.5">
            <Label className="text-slate-300">Procedimento <span className="text-slate-500">(opcional)</span></Label>
            <Select value={procedureId} onValueChange={(v) => v && handleProcedureChange(v)}>
              <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                <SelectValue placeholder="Selecionar procedimento..." />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {procedures.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-white focus:bg-slate-700">
                    {p.name} <span className="text-slate-400">· {p.duration_minutes}min</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5 col-span-1">
              <Label className="text-slate-300">Data</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="bg-slate-800 border-slate-700 text-white [color-scheme:dark]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Início</Label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => handleStartTimeChange(e.target.value)}
                required
                className="bg-slate-800 border-slate-700 text-white [color-scheme:dark]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Fim</Label>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
                className="bg-slate-800 border-slate-700 text-white [color-scheme:dark]"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-slate-300">Observações <span className="text-slate-500">(opcional)</span></Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anotações sobre a consulta..."
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 resize-none"
              rows={3}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm text-red-400">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => { reset(); onClose() }}
              className="border-slate-700 text-slate-300 hover:text-white bg-transparent hover:bg-slate-800"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading || !patientId || !professionalId}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Agendar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
