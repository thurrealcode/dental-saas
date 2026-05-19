'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

type InviteRole = 'admin' | 'dentist' | 'receptionist'

export async function generateInvite(role: InviteRole) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!membership) return { error: 'Sem empresa associada' }
  if (!['owner', 'admin'].includes(membership.role)) return { error: 'Sem permissão para convidar membros' }

  const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = createServiceClient() as any
  const { error } = await svc.from('team_invites').insert({
    company_id: membership.company_id,
    role,
    token,
    created_by: user.id,
    expires_at: expiresAt,
  })

  if (error) return { error: error.message }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  return { token, url: `${appUrl}/invite/${token}` }
}
