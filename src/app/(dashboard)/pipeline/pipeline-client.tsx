'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Plus, MoreHorizontal, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { LeadModal } from './lead-modal'
import { moveCard } from './actions'

interface Stage { id: string; name: string; color: string; position: number }
interface PipelineCard {
  id: string
  stage_id: string
  title: string
  description: string | null
  value: number | null
  due_date: string | null
  patient_id: string | null
  patients: unknown
}
interface Patient { id: string; full_name: string }

interface PipelineClientProps {
  stages: Stage[]
  initialCards: PipelineCard[]
  patients: Patient[]
}

export function PipelineClient({ stages, initialCards, patients }: PipelineClientProps) {
  const [cards, setCards] = useState(initialCards)
  const [modalOpen, setModalOpen] = useState(false)
  const [defaultStageId, setDefaultStageId] = useState<string | undefined>()
  const [movingId, setMovingId] = useState<string | null>(null)

  const cardsByStage = stages.reduce<Record<string, PipelineCard[]>>((acc, s) => {
    acc[s.id] = cards.filter((c) => c.stage_id === s.id)
    return acc
  }, {})

  function openModal(stageId?: string) {
    setDefaultStageId(stageId)
    setModalOpen(true)
  }

  function handleCreated(card: { id: string; stage_id: string; title: string; patient_id: string | null; value: number | null; due_date: string | null }) {
    setCards((prev) => [...prev, { ...card, description: null, patients: null }])
  }

  async function handleMove(cardId: string, newStageId: string) {
    setMovingId(cardId)
    setCards((prev) => prev.map((c) => c.id === cardId ? { ...c, stage_id: newStageId } : c))
    const result = await moveCard(cardId, newStageId)
    setMovingId(null)
    if (result?.error) {
      toast.error(result.error)
      setCards(initialCards)
    }
  }

  const totalValue = cards.reduce((sum, c) => sum + (c.value ?? 0), 0)

  return (
    <>
      <div className="flex flex-col gap-6 p-6 h-full">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Pipeline</h1>
            <p className="text-slate-400 text-sm mt-1">
              {cards.length} lead{cards.length !== 1 ? 's' : ''}
              {totalValue > 0 && (
                <span className="ml-2 text-emerald-400">
                  · {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalValue)}
                </span>
              )}
            </p>
          </div>
          <Button onClick={() => openModal()} className="bg-blue-600 hover:bg-blue-700 gap-2">
            <Plus className="h-4 w-4" />
            Novo Lead
          </Button>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-4 flex-1">
          {stages.map((stage, stageIndex) => {
            const stageCards = cardsByStage[stage.id] ?? []
            const stageValue = stageCards.reduce((sum, c) => sum + (c.value ?? 0), 0)
            const nextStage = stages[stageIndex + 1]

            return (
              <div key={stage.id} className="flex flex-col gap-3 w-72 flex-shrink-0">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: stage.color }} />
                    <span className="text-sm font-medium text-white">{stage.name}</span>
                    <Badge variant="outline" className="border-slate-700 text-slate-400 text-xs h-5 px-1.5">
                      {stageCards.length}
                    </Badge>
                  </div>
                  {stageValue > 0 && (
                    <span className="text-xs text-emerald-400 font-medium">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stageValue)}
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-2 rounded-xl bg-slate-800/40 border border-slate-800 p-2 min-h-[400px]">
                  {stageCards.map((card) => {
                    const patient = card.patients as { full_name: string } | null
                    const patientData = patients.find((p) => p.id === card.patient_id)
                    const patientName = patient?.full_name ?? patientData?.full_name
                    const isOverdue = card.due_date && new Date(card.due_date) < new Date()

                    return (
                      <Card
                        key={card.id}
                        className={`border-slate-700 bg-slate-900 hover:border-slate-600 cursor-pointer transition-colors group ${movingId === card.id ? 'opacity-50' : ''}`}
                      >
                        <CardHeader className="pb-2 pt-3 px-3">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium text-white leading-snug">{card.title}</p>
                            {nextStage && (
                              <button
                                onClick={() => handleMove(card.id, nextStage.id)}
                                disabled={movingId === card.id}
                                title={`Mover para ${nextStage.name}`}
                                className="opacity-0 group-hover:opacity-100 flex-shrink-0 text-slate-500 hover:text-blue-400 transition-all"
                              >
                                <ChevronRight className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent className="px-3 pb-3 space-y-1.5">
                          {patientName && (
                            <div className="flex items-center gap-1.5">
                              <div className="h-5 w-5 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-400 text-[10px] font-bold flex-shrink-0">
                                {patientName[0].toUpperCase()}
                              </div>
                              <span className="text-xs text-slate-400 truncate">{patientName}</span>
                            </div>
                          )}
                          {card.value != null && card.value > 0 && (
                            <p className="text-xs font-semibold text-emerald-400">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(card.value)}
                            </p>
                          )}
                          {card.due_date && (
                            <p className={`text-[11px] ${isOverdue ? 'text-red-400' : 'text-slate-500'}`}>
                              Prazo: {new Date(card.due_date).toLocaleDateString('pt-BR')}
                              {isOverdue && ' · Atrasado'}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    )
                  })}

                  <Button
                    variant="ghost"
                    onClick={() => openModal(stage.id)}
                    className="w-full text-slate-600 hover:text-slate-300 hover:bg-slate-800/60 gap-2 mt-auto text-xs h-8"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Adicionar card
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <LeadModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        stages={stages}
        patients={patients}
        defaultStageId={defaultStageId}
        onCreated={handleCreated}
      />
    </>
  )
}
