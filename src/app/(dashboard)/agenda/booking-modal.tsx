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
  open: boolean
  onClose: () => void
  patients: Patient[]
  professionals: Professional[]
  procedures: Procedure[]
  defaultDate?: string
  defaultProfessionalId?: string
}

export function BookingModal({
  open, onClose, patients, professionals, procedures, defaultDate, defaultProfessionalId,
}: BookingModalProps) {
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

  function calcEndTime(start: string, durationMin: number) {
    const [h, m] = start.split(':').map(Number)
    const total = h * 60 + m + durationMin
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
  }

  function handleProcedureChange(id: string) {
    setProcedureId(id)
    const proc = procedures.find((p) => p.id === id)
    if (proc) setEndTime(calcEndTime(startTime, proc.duration_minutes))
  }

  function handleStartTimeChange(time: string) {
    setStartTime(time)
    const proc = procedures.find((p) => p.id === procedureId)
    setEndTime(calcEndTime(time, proc?.duration_minutes ?? 30))
  }

  function reset() {
    setPatientId(''); setProcedureId(''); setCustomTitle(''); setNotes(''); setError('')
    setStartTime('08:00'); setEndTime('08:30')
    setProfessionalId(defaultProfessionalId ?? '')
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
      patient_id: patientId,
      professional_id: professionalId || undefined,
      procedure_id: procedureId || undefined,
      start_at: `${date}T${startTime}:00`,
      end_at: `${date}T${endTime}:00`,
      title,
      notes,
    })

    setLoading(false)
    if (result?.error) { setError(result.error); return }

    toast.success('Consulta agendada!')
    reset()
    onClose()
  }

  const canSubmit = !!patientId && !!date && !!startTime && !!endTime && startTime < endTime

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose() } }}>
      <DialogContent className="bg-slate-900 border-slate-800 text-white sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white">Nova Consulta</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">

          {/* Patient */}
          <div className="space-y-1.5">
            <Label className="text-slate-300">Paciente <span className="text-red-400">*</span></Label>
            {patients.length === 0 ? (
              <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-sm text-amber-400">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                Nenhum paciente cadastrado.{' '}
                <a href="/patients" className="underline hover:text-amber-300">Cadastrar agora</a>
              </div>
            ) : (
              <Select value={patientId} onValueChange={(v) => v && setPatientId(v)}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue placeholder="Selecionar paciente..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 max-h-48">
                  {patients.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-white focus:bg-slate-700">
                      {p.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Professional (optional) */}
          <div className="space-y-1.5">
            <Label className="text-slate-300 flex items-center gap-1.5">
              <UserCog className="h-3.5 w-3.5 text-slate-500" />
              Profissional <span className="text-slate-500 text-xs">(opcional)</span>
            </Label>
            {professionals.length === 0 ? (
              <p className="text-xs text-slate-500 py-1">
                Sem profissionais cadastrados.{' '}
                <a href="/settings" className="text-blue-400 hover:underline">Adicionar em Configurações</a>
              </p>
            ) : (
              <Select value={professionalId} onValueChange={(v) => v && setProfessionalId(v)}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue placeholder="Sem profissional definido" />
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
            )}
          </div>

          {/* Procedure (optional) */}
          <div className="space-y-1.5">
            <Label className="text-slate-300 flex items-center gap-1.5">
              <Stethoscope className="h-3.5 w-3.5 text-slate-500" />
              Procedimento <span className="text-slate-500 text-xs">(opcional)</span>
            </Label>
            {procedures.length === 0 ? (
              <p className="text-xs text-slate-500 py-1">
                Sem procedimentos.{' '}
                <a href="/settings" className="text-blue-400 hover:underline">Adicionar em Configurações</a>
              </p>
            ) : (
              <Select value={procedureId} onValueChange={(v) => v && handleProcedureChange(v)}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue placeholder="Sem procedimento definido" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {procedures.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-white focus:bg-slate-700">
                      {p.name}
                      <span className="text-slate-400 ml-1">· {p.duration_minutes}min</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Title override */}
          <div className="space-y-1.5">
            <Label className="text-slate-300">Título da consulta <span className="text-slate-500 text-xs">(opcional — gerado automaticamente)</span></Label>
            <Input
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder={procedureId ? procedures.find(p => p.id === procedureId)?.name : 'Ex: Avaliação inicial'}
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-600"
            />
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
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
            <Label className="text-slate-300">Observações <span className="text-slate-500 text-xs">(opcional)</span></Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anotações sobre a consulta..."
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 resize-none"
              rows={2}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm text-red-400">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="outline" onClick={() => { reset(); onClose() }}
              className="border-slate-700 text-slate-300 hover:text-white bg-transparent hover:bg-slate-800">
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !canSubmit || patients.length === 0} className="bg-blue-600 hover:bg-blue-700">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Agendar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
