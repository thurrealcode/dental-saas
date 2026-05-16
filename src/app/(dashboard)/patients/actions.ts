'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function getMembership() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()
  return data ? { companyId: data.company_id, userId: user.id } : null
}

export async function createPatient(form: {
  full_name: string
  phone?: string
  email?: string
  birth_date?: string
  status: 'active' | 'lead'
  notes?: string
}) {
  const supabase = await createClient()
  const member = await getMembership()
  if (!member) return { error: 'Não autenticado' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('patients').insert({
    company_id: member.companyId,
    created_by: member.userId,
    full_name: form.full_name.trim(),
    phone: form.phone?.trim() || null,
    email: form.email?.trim() || null,
    birth_date: form.birth_date || null,
    status: form.status,
    notes: form.notes?.trim() || null,
  })

  if (error) return { error: error.message }

  revalidatePath('/patients')
  revalidatePath('/pipeline')
  return { success: true }
}
