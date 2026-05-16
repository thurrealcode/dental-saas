'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Loader2, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { createProcedure } from '../agenda/actions'

const COLORS = ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#EC4899', '#06B6D4']

interface Procedure { id: string; name: string; duration_minutes: number; price: number | null; color: string }

export function ProceduresManager({ procedures: initial }: { procedures: Procedure[] }) {
  const [procedures, setProcedures] = useState(initial)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState('')
  const [duration, setDuration] = useState('30')
  const [price, setPrice] = useState('')
  const [color, setColor] = useState(COLORS[0])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    const result = await createProcedure({ name: name.trim(), duration_minutes: parseInt(duration), price: price ? parseFloat(price) : undefined, color })
    setLoading(false)
    if (result?.error) { toast.error(result.error); return }
    toast.success('Procedimento adicionado')
    setProcedures((prev) => [...prev, { id: crypto.randomUUID(), name: name.trim(), duration_minutes: parseInt(duration), price: price ? parseFloat(price) : null, color }])
    setName(''); setDuration('30'); setPrice(''); setColor(COLORS[0]); setShowForm(false)
  }

  return (
    <div className="space-y-3">
      {procedures.length === 0 && !showForm && (
        <p className="text-sm text-gray-400 py-1">Nenhum procedimento cadastrado ainda.</p>
      )}

      {procedures.map((proc) => (
        <div key={proc.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-200">
          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: proc.color }} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900">{proc.name}</p>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <Clock className="h-3 w-3" />{proc.duration_minutes}min
              </span>
              {proc.price != null && (
                <span className="text-xs text-gray-400">
                  R$ {proc.price.toFixed(2).replace('.', ',')}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}

      {showForm ? (
        <form onSubmit={handleAdd} className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-gray-700 text-xs">Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Limpeza" required
                className="bg-white border-gray-200 text-gray-900 h-8 text-sm focus-visible:ring-blue-500" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-gray-700 text-xs">Duração (min)</Label>
              <Input type="number" min="5" max="480" step="5" value={duration} onChange={(e) => setDuration(e.target.value)} required
                className="bg-white border-gray-200 text-gray-900 h-8 text-sm focus-visible:ring-blue-500" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-gray-700 text-xs">Preço (R$)</Label>
              <Input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0,00"
                className="bg-white border-gray-200 text-gray-900 h-8 text-sm focus-visible:ring-blue-500" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-gray-700 text-xs">Cor</Label>
            <div className="flex items-center gap-2">
              {COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className="w-6 h-6 rounded-full transition-transform hover:scale-110"
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
          Adicionar procedimento
        </Button>
      )}
    </div>
  )
}
