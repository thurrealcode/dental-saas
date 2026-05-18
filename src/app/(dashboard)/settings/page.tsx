import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Building2, Users, Puzzle, Zap, MessageSquare, Bot, Stethoscope, UserCog, Lock, CalendarClock } from 'lucide-react'
import { ProfessionalsManager } from './professionals-manager'
import { ProceduresManager } from './procedures-manager'
import { AvailabilityManager } from './availability-manager'
import { getSetupStatus } from '../setup/actions'
import Link from 'next/link'
import { WhatsAppConnectButton } from './whatsapp-connect-button'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: membership } = await supabase
    .from('company_members').select('company_id, role, companies(*)')
    .eq('user_id', user!.id).eq('is_active', true).single()

  const company = (membership?.companies as unknown as { name: string; slug: string; email: string | null; phone: string | null } | null)
  const companyId = membership?.company_id

  const setupStatus = await getSetupStatus()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: waIntegration } = await (supabase as any)
    .from('integrations')
    .select('is_active')
    .eq('company_id', companyId!)
    .eq('type', 'whatsapp')
    .maybeSingle()

  const [professionalsRes, proceduresRes, availabilityRes] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from('professionals').select('id, name, specialty, color')
      .eq('company_id', companyId!).order('name'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from('procedures').select('id, name, duration_minutes, price, color')
      .eq('company_id', companyId!).order('name'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from('professional_availability').select('professional_id, day_of_week, start_time, end_time')
      .eq('company_id', companyId!),
  ])

  type ProfRow = { id: string; name: string; color: string }
  type AvailRow = { professional_id: string; day_of_week: number; start_time: string; end_time: string }
  const professionals = (professionalsRes.data ?? []) as ProfRow[]
  const availability = (availabilityRes.data ?? []) as AvailRow[]
  const professionalsWithAvail = professionals.map(p => ({
    ...p,
    availability: availability.filter(a => a.professional_id === p.id),
  }))

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
        <p className="text-gray-500 text-sm mt-1">Gerencie sua clínica e integrações</p>
      </div>

      {/* Company */}
      <Card className="border-gray-200 bg-white shadow-sm">
        <CardHeader className="border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center">
              <Building2 className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-gray-900 text-base">Dados da Clínica</CardTitle>
              <CardDescription className="text-gray-400">Informações gerais da empresa</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-gray-700 text-sm">Nome da Clínica</Label>
              <Input defaultValue={company?.name} className="bg-white border-gray-200 text-gray-900 focus-visible:ring-blue-500" />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-700 text-sm">Slug (URL)</Label>
              <Input defaultValue={company?.slug} className="bg-white border-gray-200 text-gray-900 focus-visible:ring-blue-500" />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-700 text-sm">Email</Label>
              <Input defaultValue={company?.email ?? ''} type="email" className="bg-white border-gray-200 text-gray-900 focus-visible:ring-blue-500" />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-700 text-sm">Telefone</Label>
              <Input defaultValue={company?.phone ?? ''} className="bg-white border-gray-200 text-gray-900 focus-visible:ring-blue-500" />
            </div>
          </div>
          <Button className="bg-blue-600 hover:bg-blue-700 shadow-sm">Salvar alterações</Button>
        </CardContent>
      </Card>

      {/* Professionals */}
      <Card className="border-gray-200 bg-white shadow-sm">
        <CardHeader className="border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center">
              <UserCog className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-gray-900 text-base">Profissionais</CardTitle>
              <CardDescription className="text-gray-400">Dentistas e especialistas da clínica</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-5">
          <ProfessionalsManager professionals={professionals as { id: string; name: string; specialty: string | null; color: string }[]} />
        </CardContent>
      </Card>

      {/* Availability */}
      <Card className="border-gray-200 bg-white shadow-sm">
        <CardHeader className="border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center">
              <CalendarClock className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-gray-900 text-base">Disponibilidade</CardTitle>
              <CardDescription className="text-gray-400">Dias e horários de atendimento por profissional</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-5">
          <AvailabilityManager professionals={professionalsWithAvail} />
        </CardContent>
      </Card>

      {/* Procedures */}
      <Card className="border-gray-200 bg-white shadow-sm">
        <CardHeader className="border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Stethoscope className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <CardTitle className="text-gray-900 text-base">Procedimentos</CardTitle>
              <CardDescription className="text-gray-400">Serviços e tratamentos oferecidos</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-5">
          <ProceduresManager procedures={(proceduresRes.data ?? []) as { id: string; name: string; duration_minutes: number; price: number | null; color: string }[]} />
        </CardContent>
      </Card>

      {/* Integrations */}
      <Card className="border-gray-200 bg-white shadow-sm">
        <CardHeader className="border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-violet-50 flex items-center justify-center">
              <Puzzle className="h-4 w-4 text-violet-600" />
            </div>
            <div>
              <CardTitle className="text-gray-900 text-base">Integrações</CardTitle>
              <CardDescription className="text-gray-400">Conecte ferramentas externas</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-5">
          {/* WhatsApp / Evolution API */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg flex items-center justify-center text-emerald-600 bg-emerald-50">
                <MessageSquare className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Evolution API</p>
                <p className="text-xs text-gray-400">WhatsApp Business API</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {setupStatus?.is_ready ? (
                <WhatsAppConnectButton initialConnected={waIntegration?.is_active ?? false} />
              ) : (
                <>
                  <Lock className="h-3.5 w-3.5 text-gray-300" />
                  <Link href="/setup">
                    <Button size="sm" variant="outline" className="border-amber-200 text-amber-700 hover:bg-amber-50 bg-white text-xs shadow-sm gap-1.5">
                      Completar configuração
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
          {[
            { name: 'n8n', desc: 'Automação de fluxos', icon: Zap, iconClass: 'text-amber-600 bg-amber-50' },
            { name: 'IA (OpenAI / Claude)', desc: 'Respostas automáticas inteligentes', icon: Bot, iconClass: 'text-blue-600 bg-blue-50' },
          ].map((integration) => (
            <div key={integration.name} className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-200">
              <div className="flex items-center gap-3">
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${integration.iconClass}`}>
                  <integration.icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{integration.name}</p>
                  <p className="text-xs text-gray-400">{integration.desc}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="text-xs border-gray-200 text-gray-400 bg-white">Não conectado</Badge>
                <Button size="sm" variant="outline" className="border-gray-200 text-gray-600 hover:text-gray-900 bg-white hover:bg-gray-50 text-xs shadow-sm">
                  Configurar
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Team */}
      <Card className="border-gray-200 bg-white shadow-sm">
        <CardHeader className="border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-emerald-50 flex items-center justify-center">
                <Users className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <CardTitle className="text-gray-900 text-base">Equipe</CardTitle>
                <CardDescription className="text-gray-400">Gerencie membros da clínica</CardDescription>
              </div>
            </div>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-xs shadow-sm">Convidar membro</Button>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 text-xs font-bold">
                {user?.email?.[0].toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{user?.email}</p>
                <p className="text-xs text-gray-400">Você</p>
              </div>
            </div>
            <Badge variant="outline" className="border-amber-200 text-amber-700 bg-amber-50 text-xs">Owner</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
