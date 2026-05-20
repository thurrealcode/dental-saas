'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { revalidatePath } from 'next/cache'

const ALLOWED_ROLES = ['admin', 'dentist', 'receptionist', 'viewer'] as const
type AssignableRole = typeof ALLOWED_ROLES[number]

export async function changeMemberRole(memberId: string, newRole: string) {
  if (!ALLOWED_ROLES.includes(newRole as AssignableRole)) {
    return { error: 'Função inválida' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  // Verify current user is owner or admin
  const { data: myMembership } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!myMembership || !['owner', 'admin'].includes(myMembership.role)) {
    return { error: 'Sem permissão para alterar funções' }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = createServiceClient() as any

  // Fetch the target member
  const { data: target } = await svc
    .from('company_members')
    .select('id, user_id, role, company_id')
    .eq('id', memberId)
    .eq('company_id', myMembership.company_id)
    .eq('is_active', true)
    .single()

  if (!target) return { error: 'Membro não encontrado' }

  // Non-owners cannot touch owner accounts
  if (target.role === 'owner' && myMembership.role !== 'owner') {
    return { error: 'Apenas o proprietário pode alterar a função de outro proprietário' }
  }

  // Guard: can't leave the company without at least one owner/admin
  if (target.user_id === user.id && ['owner', 'admin'].includes(target.role)) {
    const { data: admins } = await svc
      .from('company_members')
      .select('id')
      .eq('company_id', myMembership.company_id)
      .eq('is_active', true)
      .in('role', ['owner', 'admin'])

    const adminCount = (admins ?? []).length
    if (adminCount <= 1 && !['owner', 'admin'].includes(newRole)) {
      return { error: 'Você é o único administrador. Promova outro membro antes de alterar sua própria função.' }
    }
  }

  const { error } = await svc
    .from('company_members')
    .update({ role: newRole })
    .eq('id', memberId)

  if (error) return { error: error.message }

  revalidatePath('/settings')
  return { success: true }
}
