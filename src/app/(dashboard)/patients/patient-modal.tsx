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
import { createPatient } from './actions'

interface PatientModalProps {
  open: boolean
  onClose: () => void
  onCreated: (patient: { id: string; full_name: string; phone: string | null; email: string | null; status: string }) => void
  defaultStatus?: 'active' | 'lead'
}

export function PatientModal({ open, onClose, onCreated, defaultStatus = 'active' }: PatientModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [status, setStatus] = useState<'active' | 'lead'>(defaultStatus)
  const [notes, setNotes] = useState('')

  function reset() {
    setFullName(''); setPhone(''); setEmail(''); setBirthDate('')
    setStatus(defaultStatus); setNotes(''); setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!fullName.trim()) return
    setLoading(true)
    setError('')

    const result = await createPatient({ full_name: fullName, phone, email, birth_date: birthDate, status, notes })

    setLoading(false)
    if (result?.error) { setError(result.error); return }

    toast.success('Paciente cadastrado com sucesso!')
    onCreated({ id: crypto.randomUUID(), full_name: fullName.trim(), phone: phone || null, email: email || null, status })
    reset()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose() } }}>
      <DialogContent className="bg-slate-900 border-slate-800 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">Novo Paciente</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label className="text-slate-300">Nome completo <span className="text-red-400">*</span></Label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Maria Silva"
              required
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-slate-300">Telefone / WhatsApp</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(11) 99999-9999"
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Data de nascimento</Label>
              <Input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white [color-scheme:dark]"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-slate-300">Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="maria@email.com"
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-slate-300">Status</Label>
            <Select value={status} onValueChange={(v) => v && setStatus(v as 'active' | 'lead')}>
              <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="active" className="text-white focus:bg-slate-700">Paciente ativo</SelectItem>
                <SelectItem value="lead" className="text-white focus:bg-slate-700">Lead</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-slate-300">Observações <span className="text-slate-500">(opcional)</span></Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Informações adicionais..."
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
            <Button type="submit" disabled={loading || !fullName.trim()} className="bg-blue-600 hover:bg-blue-700">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Cadastrar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
