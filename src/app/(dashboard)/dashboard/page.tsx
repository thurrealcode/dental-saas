import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, CalendarDays, TrendingUp, MessageSquare, ArrowUpRight, ArrowDownRight, CheckCircle2, Circle, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getSetupStatus } from '../setup/actions'
import Link from 'next/link'

async function getDashboardStats(companyId: string) {
  const supabase = await createClient()

  const today = new Date()
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString()
  const startOfToday = new Date(today.setHours(0, 0, 0, 0)).toISOString()
  const endOfToday = new Date(today.setHours(23, 59, 59, 999)).toISOString()

  const [patients, todayAppointments, openConversations, pipelineCards] = await Promise.all([
    supabase.from('patients').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
    supabase.from('appointments').select('id', { count: 'exact', head: true })
      .eq('company_id', companyId).gte('start_at', startOfToday).lte('start_at', endOfToday),
    supabase.from('conversations').select('id', { count: 'exact', head: true })
      .eq('company_id', companyId).eq('status', 'open'),
    supabase.from('pipeline_cards').select('value').eq('company_id', companyId).gte('created_at', startOfMonth),
  ])

  return {
    totalPatients: patients.count ?? 0,
    todayAppointments: todayAppointments.count ?? 0,
    openConversations: openConversations.count ?? 0,
    pipelineValue: pipelineCards.data?.reduce((sum, c) => sum + (c.value ?? 0), 0) ?? 0,
  }
}

const statCards = [
  { title: 'Total de Pacientes', key: 'totalPatients' as const, icon: Users, iconColor: 'text-blue-600', iconBg: 'bg-blue-50', change: '+12%', positive: true },
  { title: 'Consultas Hoje', key: 'todayAppointments' as const, icon: CalendarDays, iconColor: 'text-emerald-600', iconBg: 'bg-emerald-50', change: '+3', positive: true },
  { title: 'Conversas Abertas', key: 'openConversations' as const, icon: MessageSquare, iconColor: 'text-amber-600', iconBg: 'bg-amber-50', change: '-5%', positive: false },
  { title: 'Pipeline (mês)', key: 'pipelineValue' as const, icon: TrendingUp, iconColor: 'text-violet-600', iconBg: 'bg-violet-50', change: '+28%', positive: true, isCurrency: true },
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

  const [stats, setupStatus] = await Promise.all([
    getDashboardStats(membership.company_id),
    getSetupStatus(),
  ])

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
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
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
            <Card key={card.key} className="border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">{card.title}</CardTitle>
                <div className={cn('rounded-lg p-2', card.iconBg)}>
                  <card.icon className={cn('h-4 w-4', card.iconColor)} />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-gray-900">{displayValue}</p>
                <div className={cn('flex items-center gap-1 mt-1 text-xs font-medium', card.positive ? 'text-emerald-600' : 'text-red-500')}>
                  {card.positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  <span>{card.change} vs. mês anterior</span>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Setup Checklist */}
      {setupStatus && !setupStatus.is_ready && (
        <Card className="border-amber-200 bg-amber-50 shadow-sm">
          <CardHeader className="border-b border-amber-100 pb-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0" />
              <div>
                <CardTitle className="text-amber-900 text-base font-semibold">Configure sua clínica</CardTitle>
                <p className="text-amber-700 text-xs mt-0.5">Complete os passos abaixo para ativar o bot de atendimento</p>
              </div>
              <Link href="/setup" className="ml-auto text-xs font-medium text-amber-700 hover:text-amber-900 underline underline-offset-2 flex-shrink-0">
                Continuar configuração →
              </Link>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { label: 'Dados da clínica', done: setupStatus.clinic_configured },
                { label: 'Procedimentos cadastrados', done: setupStatus.procedures_configured },
                { label: 'Profissionais cadastrados', done: setupStatus.professionals_configured },
                { label: 'Procedimentos vinculados', done: setupStatus.procedures_linked },
                { label: 'Disponibilidade configurada', done: setupStatus.availability_configured },
                { label: 'WhatsApp conectado', done: setupStatus.whatsapp_connected },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2.5">
                  {item.done
                    ? <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                    : <Circle className="h-4 w-4 text-amber-300 flex-shrink-0" />}
                  <span className={cn('text-sm', item.done ? 'text-gray-500 line-through' : 'text-amber-900')}>{item.label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      {setupStatus?.is_ready && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200">
          <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
          <span className="text-sm font-medium text-emerald-800">Bot pronto para ativar — todas as configurações estão completas!</span>
        </div>
      )}

      {/* Upcoming Appointments */}
      <Card className="border-gray-200 bg-white shadow-sm">
        <CardHeader className="border-b border-gray-100 pb-4">
          <CardTitle className="text-gray-900 text-base font-semibold">Próximas Consultas</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {upcomingAppointments && upcomingAppointments.length > 0 ? (
            <div className="space-y-1">
              {upcomingAppointments.map((appt) => {
                const patient = appt.patients as unknown as { full_name: string } | null
                const startAt = new Date(appt.start_at)
                return (
                  <div key={appt.id} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0 hover:bg-gray-50 rounded-lg px-2 transition-colors cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 text-xs font-bold flex-shrink-0">
                        {patient?.full_name?.[0]?.toUpperCase() ?? '?'}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{patient?.full_name ?? 'Paciente'}</p>
                        <p className="text-xs text-gray-400">{appt.title}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">{startAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                      <p className="text-xs text-gray-400">{startAt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-10">
              <CalendarDays className="h-10 w-10 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">Nenhuma consulta agendada</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
