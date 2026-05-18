'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ChevronDown, ChevronUp, Clock, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { saveAvailability } from '../agenda/actions'

const DAYS = [
  { value: 1, label: 'Segunda' },
  { value: 2, label: 'Terça' },
  { value: 3, label: 'Quarta' },
  { value: 4, label: 'Quinta' },
  { value: 5, label: 'Sexta' },
  { value: 6, label: 'Sábado' },
  { value: 0, label: 'Domingo' },
]

interface Avail { day_of_week: number; start_time: string; end_time: string }
interface Professional { id: string; name: string; color: string; availability: Avail[] }
type DaySlot = { enabled: boolean; start: string; end: string }

function initSlots(avail: Avail[]): Record<number, DaySlot> {
  return Object.fromEntries(
    DAYS.map(d => {
      const existing = avail.find(a => a.day_of_week === d.value)
      return [d.value, {
        enabled: !!existing,
        start: existing?.start_time?.substring(0, 5) ?? '08:00',
        end: existing?.end_time?.substring(0, 5) ?? '18:00',
      }]
    })
  )
}

function ProfRow({ prof }: { prof: Professional }) {
  const [open, setOpen] = useState(false)
  const [slots, setSlots] = useState<Record<number, DaySlot>>(() => initSlots(prof.availability))
  const [loading, setLoading] = useState(false)

  function toggle(dow: number, val: boolean) {
    setSlots(p => ({ ...p, [dow]: { ...p[dow], enabled: val } }))
  }
  function setTime(dow: number, field: 'start' | 'end', val: string) {
    setSlots(p => ({ ...p, [dow]: { ...p[dow], [field]: val } }))
  }

  async function handleSave() {
    setLoading(true)
    const toSave = DAYS.filter(d => slots[d.value].enabled).map(d => ({
      day_of_week: d.value,
      start_time: slots[d.value].start,
      end_time: slots[d.value].end,
    }))
    const res = await saveAvailability(prof.id, toSave)
    setLoading(false)
    if (res?.error) { toast.error(res.error); return }
    toast.success(`Disponibilidade de ${prof.name} salva`)
    setOpen(false)
  }

  const activeDays = DAYS.filter(d => slots[d.value].enabled)
  const summary = activeDays.length === 0
    ? 'Sem horários'
    : activeDays.map(d => d.label.substring(0, 3)).join(', ')

  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 p-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: prof.color }} />
        <span className="flex-1 text-sm font-medium text-gray-900">{prof.name}</span>
        <span className="flex items-center gap-1.5 text-xs text-gray-400">
          <Clock className="h-3 w-3" />
          {summary}
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />}
      </button>

      {open && (
        <div className="p-4 space-y-4 bg-white border-t border-gray-100">
          <div className="space-y-2.5">
            {DAYS.map(day => (
              <div key={day.value} className="flex items-center gap-4">
                <label className="flex items-center gap-2 w-28 flex-shrink-0 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={slots[day.value].enabled}
                    onChange={e => toggle(day.value, e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className={`text-sm font-medium ${slots[day.value].enabled ? 'text-gray-900' : 'text-gray-400'}`}>
                    {day.label}
                  </span>
                </label>

                {slots[day.value].enabled ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={slots[day.value].start}
                      onChange={e => setTime(day.value, 'start', e.target.value)}
                      className="h-8 w-28 text-sm bg-white border-gray-200 focus-visible:ring-blue-500"
                    />
                    <span className="text-xs text-gray-400">às</span>
                    <Input
                      type="time"
                      value={slots[day.value].end}
                      onChange={e => setTime(day.value, 'end', e.target.value)}
                      className="h-8 w-28 text-sm bg-white border-gray-200 focus-visible:ring-blue-500"
                    />
                  </div>
                ) : (
                  <span className="text-xs text-gray-300">Indisponível</span>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-1 border-t border-gray-100">
            <Button onClick={handleSave} disabled={loading} size="sm" className="bg-blue-600 hover:bg-blue-700 shadow-sm">
              {loading && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
              Salvar
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}
              className="border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-white">
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export function AvailabilityManager({ professionals }: { professionals: Professional[] }) {
  if (professionals.length === 0) {
    return <p className="text-sm text-gray-400 py-1">Nenhum profissional cadastrado ainda.</p>
  }
  return (
    <div className="space-y-2">
      {professionals.map(prof => <ProfRow key={prof.id} prof={prof} />)}
    </div>
  )
}
