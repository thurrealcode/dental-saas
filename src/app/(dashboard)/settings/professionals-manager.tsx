'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Loader2, User2 } from 'lucide-react'
import { toast } from 'sonner'
import { createProfessional } from '../agenda/actions'

const COLORS = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#EC4899', '#06B6D4']

interface Professional { id: string; name: string; specialty: string | null; color: string }

export function ProfessionalsManager({ professionals: initial }: { professionals: Professional[] }) {
  const [professionals, setProfessionals] = useState(initial)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [color, setColor] = useState(COLORS[0])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    const result = await createProfessional({ name: name.trim(), specialty: specialty.trim() || undefined, color })
    setLoading(false)
    if (result?.error) { toast.error(result.error); return }
    toast.success('Profissional adicionado')
    setProfessionals((prev) => [...prev, { id: crypto.randomUUID(), name: name.trim(), specialty: specialty.trim() || null, color }])
    setName(''); setSpecialty(''); setColor(COLORS[0]); setShowForm(false)
  }

  return (
    <div className="space-y-3">
      {professionals.length === 0 && !showForm && (
        <p className="text-sm text-gray-400 py-1">Nenhum profissional cadastrado ainda.</p>
      )}

      {professionals.map((prof) => (
        <div key={prof.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-200">
          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: prof.color }} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900">{prof.name}</p>
            {prof.specialty && <p className="text-xs text-gray-400">{prof.specialty}</p>}
          </div>
          <User2 className="h-4 w-4 text-gray-300" />
        </div>
      ))}

      {showForm ? (
        <form onSubmit={handleAdd} className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-gray-700 text-xs">Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Dr. Silva" required
                className="bg-white border-gray-200 text-gray-900 h-8 text-sm focus-visible:ring-blue-500" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-gray-700 text-xs">Especialidade</Label>
              <Input value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="Ortodontia"
                className="bg-white border-gray-200 text-gray-900 h-8 text-sm focus-visible:ring-blue-500" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-gray-700 text-xs">Cor</Label>
            <div className="flex items-center gap-2">
              {COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className="w-6 h-6 rounded-full transition-transform hover:scale-110 ring-offset-2"
                  style={{ backgroundColor: c, outline: color === c ? `2px solid ${c}` : 'none', outlineOffset: '2px' }} />
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={loading || !name.trim()} size="sm" className="bg-blue-600 hover:bg-blue-700 shadow-sm">
              {loading && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
              Salvar
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setShowForm(false)}
              className="border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-white">Cancelar</Button>
          </div>
        </form>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setShowForm(true)}
          className="border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50 gap-1.5 text-xs shadow-sm">
          <Plus className="h-3.5 w-3.5" />
          Adicionar profissional
        </Button>
      )}
    </div>
  )
}
