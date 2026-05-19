import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Building2, Users, Puzzle, Zap, MessageSquare, Bot, Stethoscope, UserCog, Lock, CalendarClock, ShieldCheck } from 'lucide-react'
import { ProfessionalsManager } from './professionals-manager'
import { ProceduresManager } from './procedures-manager'
import { AvailabilityManager } from './availability-manager'
import { getSetupStatus } from '../setup/actions'
import Link from 'next/link'
import { WhatsAppConnectButton } from './whatsapp-connect-button'
import { ClinicSettingsForm } from './clinic-settings-form'
import { InviteButton } from './invite-button'

// Role display config — maps DB enum to Portuguese label + badge style
const ROLE_PT: Record<string, { label: string; cls: string }> = {
  owner:        { label: 'Proprietário',  cls: 'border-amber-200  text-amber-700  bg-amber-50' },
  admin:        { label: 'Administrador', cls: 'border-blue-200   text-blue-700   bg-blue-50' },
  dentist:      { label: 'Profissional',  cls: 'border-emerald-200 text-emerald-700 bg-emerald-50' },
  receptionist: { label: 'Atendente',    cls: 'border-violet-200 text-violet-700 bg-violet-50' },
  viewer:       { label: 'Visualizador', cls: 'border-gray-200   text-gray-500   bg-gray-50' },
}

// One-line permission description per role
const ROLE_PERMS: Record<string, string> = {
  owner:        'Acesso total ao sistema',
  admin:        'Acesso total ao sistema',
  dentist:      'Agenda própria · Consultas vinculadas',
  receptionist: 'Dashboard · Agenda · Pacientes · WhatsApp',
  viewer:       'Acesso somente leitura',
}

export default async function SettingsPage() {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = createServiceClient() as any

  const { data: { user } } = await supabase.auth.getUser()

  const { data: membership } = await supabase
    .from('company_members').select('company_id, role, companies(*)')
    .eq('user_id', user!.id).eq('is_active', true).single()

  const company = (membership?.companies as unknown as { name: string; slug: string; email: string | null; phone: string | null; address: string | null } | null)
  const companyId = membership?.company_id

  const [setupStatus, waIntegration, membersRes, professionalsRes, proceduresRes, availabilityRes] = await Promise.all([
    getSetupStatus(),

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from('integrations').select('is_active')
      .eq('company_id', companyId!).eq('type', 'whatsapp').maybeSingle(),

    // Service client to avoid RLS blocking cross-member reads
    svc.from('company_members')
      .select('id, user_id, role, created_at')
      .eq('company_id', companyId!)
      .eq('is_active', true)
      .order('created_at'),

    svc.from('professionals').select('id, name, specialty, color')
      .eq('company_id', companyId!).order('name'),

    svc.from('procedures').select('id, name, duration_minutes, price, color')
      .eq('company_id', companyId!).order('name'),

    svc.from('professional_availability').select('professional_id, day_of_week, start_time, end_time')
      .eq('company_id', companyId!),
  ])

  type MemberRow = { id: string; user_id: string; role: string; created_at: string }
  const rawMembers = (membersRes.data ?? []) as MemberRow[]

  // Fetch profile names for all members (service client avoids potential RLS on profiles)
  const memberIds = rawMembers.map(m => m.user_id)
  const { data: profilesData } = await svc.from('profiles').select('id, full_name').in('id', memberIds)
  const profileMap = new Map((profilesData ?? []).map(p => [p.id, p.full_name as string | null]))

  const teamMembers = rawMembers.map(m => ({
    ...m,
    fullName: profileMap.get(m.user_id) ?? null,
    isCurrentUser: m.user_id === user!.id,
  }))

  type ProfRow = { id: string; name: string; color: string }
  type AvailRow = { professional_id: string; day_of_week: number; start_time: string; end_time: string }
  const professionals = (professionalsRes.data ?? []) as ProfRow[]
  const availability  = (availabilityRes.data ?? []) as AvailRow[]
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
        <CardContent className="pt-5">
          <ClinicSettingsForm
            name={company?.name ?? ''}
            slug={company?.slug ?? ''}
            email={company?.email ?? ''}
            phone={company?.phone ?? ''}
            address={company?.address ?? ''}
          />
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
                <WhatsAppConnectButton initialConnected={waIntegration?.data?.is_active ?? false} />
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
                <CardDescription className="text-gray-400">
                  {teamMembers.length} membro{teamMembers.length !== 1 ? 's' : ''} ativo{teamMembers.length !== 1 ? 's' : ''}
                </CardDescription>
              </div>
            </div>
            <InviteButton />
          </div>
        </CardHeader>

        <CardContent className="pt-2 pb-0">
          {/* Member list */}
          <div className="divide-y divide-gray-50">
            {teamMembers.map(member => {
              const rp = ROLE_PT[member.role] ?? { label: member.role, cls: 'border-gray-200 text-gray-500 bg-gray-50' }
              const displayName = member.isCurrentUser
                ? (member.fullName || user?.email || 'Você')
                : (member.fullName || 'Usuário')
              const subLine = member.isCurrentUser
                ? user?.email ?? ''
                : (ROLE_PERMS[member.role] ?? '')
              const avatarInitial = displayName[0].toUpperCase()

              return (
                <div key={member.id} className="flex items-center justify-between py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 text-xs font-bold flex-shrink-0">
                      {avatarInitial}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900">{displayName}</p>
                        {member.isCurrentUser && (
                          <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">Você</span>
                        )}
                      </div>
                      {subLine && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{subLine}</p>
                      )}
                    </div>
                  </div>
                  <Badge variant="outline" className={`text-xs ${rp.cls}`}>{rp.label}</Badge>
                </div>
              )
            })}
          </div>

          {/* Permissions legend */}
          <div className="mt-3 mb-4 rounded-xl border border-gray-100 bg-gray-50 p-4">
            <div className="flex items-center gap-1.5 mb-3">
              <ShieldCheck className="h-3.5 w-3.5 text-gray-400" />
              <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Permissões por função</h4>
            </div>
            <div className="space-y-2">
              {[
                { roles: ['Proprietário', 'Administrador'], perms: 'Acesso total ao sistema' },
                { roles: ['Atendente'],                     perms: 'Dashboard · Agenda · Pacientes · WhatsApp ao vivo' },
                { roles: ['Profissional'],                  perms: 'Agenda própria · Consultas vinculadas' },
              ].map(row => (
                <div key={row.roles[0]} className="flex items-start gap-3">
                  <div className="flex gap-1 flex-shrink-0 w-52">
                    {row.roles.map(r => (
                      <span key={r} className="text-[11px] font-semibold text-gray-600">{r}{row.roles.indexOf(r) < row.roles.length - 1 ? ' ·' : ''}</span>
                    ))}
                  </div>
                  <span className="text-[11px] text-gray-400 leading-relaxed">{row.perms}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
