import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, ChevronLeft, ChevronRight, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

const statusMap = {
  scheduled: { label: 'Agendado', class: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  confirmed: { label: 'Confirmado', class: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  in_progress: { label: 'Em andamento', class: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  completed: { label: 'Concluído', class: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
  cancelled: { label: 'Cancelado', class: 'bg-red-500/10 text-red-400 border-red-500/20' },
  no_show: { label: 'Faltou', class: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
}

export default async function AgendaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user!.id)
    .eq('is_active', true)
    .single()

  if (!membership) return null

  const today = new Date()
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()
  const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59).toISOString()

  const { data: appointments } = await supabase
    .from('appointments')
    .select('*, patients(full_name, phone)')
    .eq('company_id', membership.company_id)
    .gte('start_at', startOfToday)
    .lte('start_at', endOfToday)
    .order('start_at', { ascending: true })

  const hours = Array.from({ length: 13 }, (_, i) => i + 7) // 7h to 19h

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Agenda</h1>
          <p className="text-slate-400 text-sm mt-1">
            {today.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="border-slate-700 text-slate-400 hover:text-white bg-slate-800">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="border-slate-700 text-slate-300 bg-slate-800 hover:text-white">
            Hoje
          </Button>
          <Button variant="outline" size="icon" className="border-slate-700 text-slate-400 hover:text-white bg-slate-800">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700 gap-2 ml-2">
            <Plus className="h-4 w-4" />
            Agendar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Day view */}
        <Card className="lg:col-span-2 border-slate-800 bg-slate-900">
          <CardHeader>
            <CardTitle className="text-white text-sm font-medium">
              {appointments?.length ?? 0} consultas hoje
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="relative">
              {hours.map((hour) => {
                const hourAppointments = appointments?.filter((a) => {
                  const startHour = new Date(a.start_at).getHours()
                  return startHour === hour
                })

                return (
                  <div key={hour} className="flex border-b border-slate-800/60 last:border-0">
                    <div className="w-16 flex-shrink-0 py-3 px-4 text-xs text-slate-600 text-right">
                      {`${String(hour).padStart(2, '0')}:00`}
                    </div>
                    <div className="flex-1 min-h-[56px] px-3 py-2 space-y-1">
                      {hourAppointments?.map((appt) => {
                        const patient = appt.patients as unknown as { full_name: string; phone: string } | null
                        const status = statusMap[appt.status]
                        const duration = Math.round((new Date(appt.end_at).getTime() - new Date(appt.start_at).getTime()) / 60000)
                        return (
                          <div key={appt.id} className="rounded-lg bg-blue-600/20 border border-blue-500/30 px-3 py-2 cursor-pointer hover:bg-blue-600/30 transition-colors">
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <p className="text-sm font-medium text-white">{patient?.full_name}</p>
                                <p className="text-xs text-blue-300">{appt.title}</p>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="flex items-center gap-1 text-xs text-slate-400">
                                  <Clock className="h-3 w-3" />{duration}min
                                </span>
                                <Badge variant="outline" className={cn('text-[10px] py-0', status.class)}>
                                  {status.label}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Sidebar stats */}
        <div className="space-y-4">
          <Card className="border-slate-800 bg-slate-900">
            <CardHeader>
              <CardTitle className="text-sm text-white">Resumo do dia</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(statusMap).map(([key, val]) => {
                const count = appointments?.filter((a) => a.status === key).length ?? 0
                return (
                  <div key={key} className="flex items-center justify-between">
                    <Badge variant="outline" className={cn('text-xs', val.class)}>{val.label}</Badge>
                    <span className="text-sm font-medium text-white">{count}</span>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
