import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, CalendarDays, TrendingUp, MessageSquare, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { cn } from '@/lib/utils'

async function getDashboardStats(companyId: string) {
  const supabase = await createClient()

  const today = new Date()
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString()
  const startOfToday = new Date(today.setHours(0, 0, 0, 0)).toISOString()
  const endOfToday = new Date(today.setHours(23, 59, 59, 999)).toISOString()

  const [patients, todayAppointments, openConversations, pipelineCards] = await Promise.all([
    supabase.from('patients').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
    supabase.from('appointments').select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .gte('start_at', startOfToday)
      .lte('start_at', endOfToday),
    supabase.from('conversations').select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('status', 'open'),
    supabase.from('pipeline_cards').select('value')
      .eq('company_id', companyId)
      .gte('created_at', startOfMonth),
  ])

  const pipelineValue = pipelineCards.data?.reduce((sum, c) => sum + (c.value ?? 0), 0) ?? 0

  return {
    totalPatients: patients.count ?? 0,
    todayAppointments: todayAppointments.count ?? 0,
    openConversations: openConversations.count ?? 0,
    pipelineValue,
  }
}

const statCards = [
  {
    title: 'Total de Pacientes',
    key: 'totalPatients' as const,
    icon: Users,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    change: '+12%',
    positive: true,
  },
  {
    title: 'Consultas Hoje',
    key: 'todayAppointments' as const,
    icon: CalendarDays,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    change: '+3',
    positive: true,
  },
  {
    title: 'Conversas Abertas',
    key: 'openConversations' as const,
    icon: MessageSquare,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    change: '-5%',
    positive: false,
  },
  {
    title: 'Pipeline (mês)',
    key: 'pipelineValue' as const,
    icon: TrendingUp,
    color: 'text-violet-400',
    bgColor: 'bg-violet-500/10',
    change: '+28%',
    positive: true,
    isCurrency: true,
  },
]

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id, companies(name)')
    .eq('user_id', user!.id)
    .eq('is_active', true)
    .single()

  if (!membership) return null

  const stats = await getDashboardStats(membership.company_id)

  const { data: upcomingAppointments } = await supabase
    .from('appointments')
    .select('id, title, start_at, status, patients(full_name)')
    .eq('company_id', membership.company_id)
    .gte('start_at', new Date().toISOString())
    .order('start_at', { ascending: true })
    .limit(6)

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 text-sm mt-1">
          Visão geral da sua clínica — {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => {
          const value = stats[card.key]
          const displayValue = card.isCurrency
            ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
            : value.toLocaleString('pt-BR')

          return (
            <Card key={card.key} className="border-slate-800 bg-slate-900">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-400">{card.title}</CardTitle>
                <div className={cn('rounded-lg p-2', card.bgColor)}>
                  <card.icon className={cn('h-4 w-4', card.color)} />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-white">{displayValue}</p>
                <div className={cn('flex items-center gap-1 mt-1 text-xs font-medium', card.positive ? 'text-emerald-400' : 'text-red-400')}>
                  {card.positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  <span>{card.change} vs. mês anterior</span>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Upcoming Appointments */}
      <Card className="border-slate-800 bg-slate-900">
        <CardHeader>
          <CardTitle className="text-white text-base">Próximas Consultas</CardTitle>
        </CardHeader>
        <CardContent>
          {upcomingAppointments && upcomingAppointments.length > 0 ? (
            <div className="space-y-3">
              {upcomingAppointments.map((appt) => {
                const patient = appt.patients as unknown as { full_name: string } | null
                const startAt = new Date(appt.start_at)
                return (
                  <div key={appt.id} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-400 text-xs font-bold">
                        {patient?.full_name?.[0]?.toUpperCase() ?? '?'}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{patient?.full_name ?? 'Paciente'}</p>
                        <p className="text-xs text-slate-500">{appt.title}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-white">{startAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                      <p className="text-xs text-slate-500">{startAt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-slate-500 text-sm text-center py-8">Nenhuma consulta agendada</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
