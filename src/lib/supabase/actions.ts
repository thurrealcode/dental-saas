'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function signIn(email: string, password: string) {
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function signUp(email: string, password: string, fullName: string) {
  const supabase = await createClient()

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  })

  if (error) return { error: error.message }

  return { success: true }
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/auth/login')
}

export async function createCompany(name: string, slug: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Não autenticado' }

  const { data: company, error } = await supabase
    .from('companies')
    .insert({ name, slug })
    .select()
    .single()

  if (error) return { error: error.message }

  const { error: memberError } = await supabase
    .from('company_members')
    .insert({ company_id: company.id, user_id: user.id, role: 'owner' })

  if (memberError) return { error: memberError.message }

  await supabase.rpc('create_default_pipeline_stages', { p_company_id: company.id })
  await supabase.rpc('create_default_appointment_types', { p_company_id: company.id })

  revalidatePath('/', 'layout')
  return { success: true }
}
