import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Building2, Users, Puzzle, Bell, Zap, MessageSquare, Bot } from 'lucide-react'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id, role, companies(*)')
    .eq('user_id', user!.id)
    .eq('is_active', true)
    .single()

  const company = (membership?.companies as unknown as { name: string; slug: string; email: string | null; phone: string | null } | null)

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Configurações</h1>
        <p className="text-slate-400 text-sm mt-1">Gerencie sua clínica e integrações</p>
      </div>

      {/* Company */}
      <Card className="border-slate-800 bg-slate-900">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-blue-600/20 flex items-center justify-center">
              <Building2 className="h-4 w-4 text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-white text-base">Dados da Clínica</CardTitle>
              <CardDescription className="text-slate-500">Informações gerais da empresa</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Nome da Clínica</Label>
              <Input defaultValue={company?.name} className="bg-slate-800 border-slate-700 text-white" />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Slug (URL)</Label>
              <Input defaultValue={company?.slug} className="bg-slate-800 border-slate-700 text-white" />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Email</Label>
              <Input defaultValue={company?.email ?? ''} type="email" className="bg-slate-800 border-slate-700 text-white" />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Telefone</Label>
              <Input defaultValue={company?.phone ?? ''} className="bg-slate-800 border-slate-700 text-white" />
            </div>
          </div>
          <Button className="bg-blue-600 hover:bg-blue-700">Salvar alterações</Button>
        </CardContent>
      </Card>

      {/* Integrations */}
      <Card className="border-slate-800 bg-slate-900">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-violet-600/20 flex items-center justify-center">
              <Puzzle className="h-4 w-4 text-violet-400" />
            </div>
            <div>
              <CardTitle className="text-white text-base">Integrações</CardTitle>
              <CardDescription className="text-slate-500">Conecte ferramentas externas</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            {
              name: 'Evolution API',
              desc: 'WhatsApp Business API',
              icon: MessageSquare,
              color: 'text-emerald-400 bg-emerald-500/10',
              status: 'not_connected',
            },
            {
              name: 'n8n',
              desc: 'Automação de fluxos',
              icon: Zap,
              color: 'text-amber-400 bg-amber-500/10',
              status: 'not_connected',
            },
            {
              name: 'IA (OpenAI / Claude)',
              desc: 'Respostas automáticas inteligentes',
              icon: Bot,
              color: 'text-blue-400 bg-blue-500/10',
              status: 'not_connected',
            },
          ].map((integration) => (
            <div key={integration.name} className="flex items-center justify-between p-4 rounded-lg bg-slate-800/60 border border-slate-700/60">
              <div className="flex items-center gap-3">
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${integration.color}`}>
                  <integration.icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{integration.name}</p>
                  <p className="text-xs text-slate-500">{integration.desc}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="text-xs border-slate-700 text-slate-500">
                  Não conectado
                </Badge>
                <Button size="sm" variant="outline" className="border-slate-700 text-slate-300 hover:text-white bg-slate-800 text-xs">
                  Configurar
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Team */}
      <Card className="border-slate-800 bg-slate-900">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-emerald-600/20 flex items-center justify-center">
                <Users className="h-4 w-4 text-emerald-400" />
              </div>
              <div>
                <CardTitle className="text-white text-base">Equipe</CardTitle>
                <CardDescription className="text-slate-500">Gerencie membros da clínica</CardDescription>
              </div>
            </div>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-xs">Convidar membro</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between py-3 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-400 text-xs font-bold">
                {user?.email?.[0].toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-white">{user?.email}</p>
                <p className="text-xs text-slate-500">Você</p>
              </div>
            </div>
            <Badge variant="outline" className="border-amber-500/40 text-amber-400 bg-amber-500/10 text-xs">
              Owner
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
