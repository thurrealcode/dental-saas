import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Plus, MoreHorizontal } from 'lucide-react'

export default async function PipelinePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user!.id)
    .eq('is_active', true)
    .single()

  if (!membership) return null

  const { data: stages } = await supabase
    .from('pipeline_stages')
    .select('*')
    .eq('company_id', membership.company_id)
    .order('position', { ascending: true })

  const { data: cards } = await supabase
    .from('pipeline_cards')
    .select('*, patients(full_name)')
    .eq('company_id', membership.company_id)
    .order('position', { ascending: true })

  const cardsByStage = stages?.reduce<Record<string, typeof cards>>((acc, stage) => {
    acc[stage.id] = cards?.filter((c) => c.stage_id === stage.id) ?? []
    return acc
  }, {})

  return (
    <div className="flex flex-col gap-6 p-6 h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Pipeline</h1>
          <p className="text-slate-400 text-sm mt-1">Gerencie seus leads e oportunidades</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700 gap-2">
          <Plus className="h-4 w-4" />
          Novo Lead
        </Button>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 flex-1">
        {stages?.map((stage) => {
          const stageCards = cardsByStage?.[stage.id] ?? []
          const stageValue = stageCards.reduce((sum, c) => sum + (c.value ?? 0), 0)

          return (
            <div key={stage.id} className="flex flex-col gap-3 w-72 flex-shrink-0">
              {/* Stage header */}
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: stage.color }} />
                  <span className="text-sm font-medium text-white">{stage.name}</span>
                  <Badge variant="outline" className="border-slate-700 text-slate-400 text-xs h-5 px-1.5">
                    {stageCards.length}
                  </Badge>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-500 hover:text-white">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Column */}
              <div className="flex flex-col gap-2 rounded-xl bg-slate-800/40 border border-slate-800 p-2 min-h-[400px]">
                {stageCards.map((card) => {
                  const patient = card.patients as unknown as { full_name: string } | null
                  return (
                    <Card key={card.id} className="border-slate-700 bg-slate-900 hover:border-slate-600 cursor-pointer transition-colors group">
                      <CardHeader className="pb-2 pt-3 px-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-white leading-snug">{card.title}</p>
                          <Button variant="ghost" size="icon" className="h-5 w-5 text-slate-600 group-hover:text-slate-400 flex-shrink-0 -mt-0.5">
                            <MoreHorizontal className="h-3 w-3" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="px-3 pb-3 space-y-2">
                        {patient && (
                          <div className="flex items-center gap-1.5">
                            <div className="h-5 w-5 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-400 text-[10px] font-bold flex-shrink-0">
                              {patient.full_name[0].toUpperCase()}
                            </div>
                            <span className="text-xs text-slate-400 truncate">{patient.full_name}</span>
                          </div>
                        )}
                        {card.value && (
                          <p className="text-xs font-semibold text-emerald-400">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(card.value)}
                          </p>
                        )}
                        {card.due_date && (
                          <p className="text-[11px] text-slate-500">
                            Prazo: {new Date(card.due_date).toLocaleDateString('pt-BR')}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}

                <Button variant="ghost" className="w-full text-slate-600 hover:text-slate-400 hover:bg-slate-800/60 gap-2 mt-auto text-xs h-8">
                  <Plus className="h-3.5 w-3.5" />
                  Adicionar card
                </Button>
              </div>

              {stageValue > 0 && (
                <p className="text-xs text-slate-500 text-center px-1">
                  Total: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stageValue)}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
