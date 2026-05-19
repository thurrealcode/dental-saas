import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Stethoscope, UserCheck, AlertCircle, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const ROLE_LABEL: Record<string, { label: string; color: string }> = {
  admin:        { label: 'Administrador', color: 'border-blue-200 text-blue-700 bg-blue-50' },
  dentist:      { label: 'Profissional',  color: 'border-emerald-200 text-emerald-700 bg-emerald-50' },
  receptionist: { label: 'Atendente',    color: 'border-violet-200 text-violet-700 bg-violet-50' },
}

function ErrorScreen({ title, message }: { title: string; message: string }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <Card className="border-slate-800 bg-slate-900/50 w-full max-w-md text-center">
        <CardContent className="p-8">
          <div className="h-12 w-12 rounded-full bg-red-600/20 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-6 w-6 text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">{title}</h2>
          <p className="text-slate-400 text-sm mb-6">{message}</p>
          <Link href="/auth/login">
            <Button className="bg-blue-600 hover:bg-blue-700 w-full">Ir para o login</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}

function LoginPrompt({ token, companyName, role }: { token: string; companyName: string; role: string }) {
  const rp = ROLE_LABEL[role] ?? { label: role, color: 'border-gray-200 text-gray-500 bg-gray-50' }
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-600 mb-4">
            <Stethoscope className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">DentalFlow</h1>
        </div>

        <Card className="border-slate-800 bg-slate-900/50 backdrop-blur">
          <CardContent className="p-6 space-y-5">
            <div className="text-center space-y-2">
              <div className="h-12 w-12 rounded-full bg-emerald-600/20 flex items-center justify-center mx-auto">
                <UserCheck className="h-6 w-6 text-emerald-400" />
              </div>
              <h2 className="text-lg font-bold text-white">Você foi convidado!</h2>
              <p className="text-slate-400 text-sm">
                Para entrar na clínica <strong className="text-white">{companyName}</strong>
              </p>
              <div className="flex items-center justify-center gap-2">
                <span className="text-slate-400 text-xs">como</span>
                <Badge variant="outline" className={`text-xs ${rp.color}`}>{rp.label}</Badge>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
              <Clock className="h-3.5 w-3.5 flex-shrink-0" />
              <span>Este link expira em 7 dias</span>
            </div>

            <div className="space-y-2">
              <Link href={`/auth/login?next=/invite/${token}`} className="block">
                <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                  Entrar com conta existente
                </Button>
              </Link>
              <Link href={`/auth/register?next=/invite/${token}`} className="block">
                <Button variant="outline" className="w-full border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white">
                  Criar nova conta
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = createServiceClient() as any

  const { data: invite } = await svc
    .from('team_invites')
    .select('*, companies(name)')
    .eq('token', token)
    .single()

  if (!invite) {
    return <ErrorScreen title="Convite inválido" message="Este link de convite não existe ou foi removido." />
  }

  if (invite.used_at) {
    return <ErrorScreen title="Convite já usado" message="Este link de convite já foi utilizado." />
  }

  if (new Date(invite.expires_at) < new Date()) {
    return <ErrorScreen title="Convite expirado" message="Este link de convite expirou. Peça um novo link ao administrador." />
  }

  const companyName = (invite.companies as { name: string } | null)?.name ?? 'a clínica'

  // Check if user is authenticated
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return <LoginPrompt token={token} companyName={companyName} role={invite.role} />
  }

  // User is authenticated — accept the invite
  const { data: existing } = await svc
    .from('company_members')
    .select('id')
    .eq('company_id', invite.company_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!existing) {
    await svc.from('company_members').insert({
      company_id: invite.company_id,
      user_id: user.id,
      role: invite.role,
      invited_by: invite.created_by,
      is_active: true,
    })
  }

  await svc
    .from('team_invites')
    .update({ used_at: new Date().toISOString() })
    .eq('id', invite.id)

  redirect('/dashboard')
}
