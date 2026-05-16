'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { createPipelineCard } from './actions'

interface Stage { id: string; name: string; color: string }
interface Patient { id: string; full_name: string }

interface LeadModalProps {
  open: boolean
  onClose: () => void
  stages: Stage[]
  patients: Patient[]
  defaultStageId?: string
  onCreated: (card: { id: string; stage_id: string; title: string; patient_id: string | null; value: number | null; due_date: string | null }) => void
}

export function LeadModal({ open, onClose, stages, patients, defaultStageId, onCreated }: LeadModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [title, setTitle] = useState('')
  const [stageId, setStageId] = useState(defaultStageId ?? stages[0]?.id ?? '')
  const [patientId, setPatientId] = useState('')
  const [value, setValue] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [description, setDescription] = useState('')

  function reset() {
    setTitle(''); setPatientId(''); setValue(''); setDueDate(''); setDescription(''); setError('')
    setStageId(defaultStageId ?? stages[0]?.id ?? '')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !stageId) return
    setLoading(true)
    setError('')
    const result = await createPipelineCard({
      stage_id: stageId, title: title.trim(),
      patient_id: patientId || undefined, value: value ? parseFloat(value) : undefined,
      due_date: dueDate || undefined, description: description || undefined,
    })
    setLoading(false)
    if (result?.error) { setError(result.error); return }
    toast.success('Lead criado!')
    onCreated({ id: crypto.randomUUID(), stage_id: stageId, title: title.trim(), patient_id: patientId || null, value: value ? parseFloat(value) : null, due_date: dueDate || null })
    reset()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose() } }}>
      <DialogContent className="bg-white border-gray-200 text-gray-900 sm:max-w-md shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-gray-900 font-semibold">Novo Lead</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label className="text-gray-700 text-sm">Título <span className="text-red-500">*</span></Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Ortodontia - João Silva"
              required className="bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 focus-visible:ring-blue-500" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-gray-700 text-sm">Etapa</Label>
            <Select value={stageId} onValueChange={(v) => v && setStageId(v)}>
              <SelectTrigger className="bg-white border-gray-200 text-gray-900 focus:ring-blue-500">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white border-gray-200">
                {stages.map((s) => (
                  <SelectItem key={s.id} value={s.id} className="text-gray-900 focus:bg-gray-50">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                      {s.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-gray-700 text-sm">Paciente <span className="text-gray-400 font-normal">(opcional)</span></Label>
            <Select value={patientId} onValueChange={(v) => v && setPatientId(v)}>
              <SelectTrigger className="bg-white border-gray-200 text-gray-900 focus:ring-blue-500">
                <SelectValue placeholder="Vincular paciente..." />
              </SelectTrigger>
              <SelectContent className="bg-white border-gray-200 max-h-48">
                {patients.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-gray-900 focus:bg-gray-50">{p.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-gray-700 text-sm">Valor (R$)</Label>
              <Input type="number" min="0" step="0.01" value={value} onChange={(e) => setValue(e.target.value)}
                placeholder="0,00" className="bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 focus-visible:ring-blue-500" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-gray-700 text-sm">Prazo</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                className="bg-white border-gray-200 text-gray-900 focus-visible:ring-blue-500" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-gray-700 text-sm">Descrição <span className="text-gray-400 font-normal">(opcional)</span></Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Detalhes do lead..."
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
            <Button type="submit" disabled={loading || !title.trim()} className="bg-blue-600 hover:bg-blue-700 shadow-sm">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar lead
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
