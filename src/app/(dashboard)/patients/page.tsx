import { createClient } from '@/lib/supabase/server'
import { PatientsClient } from './patients-client'

export default async function PatientsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user!.id)
    .eq('is_active', true)
    .single()

  if (!membership) return null

  const { data: patients, count } = await supabase
    .from('patients')
    .select('id, full_name, email, phone, status, created_at', { count: 'exact' })
    .eq('company_id', membership.company_id)
    .order('created_at', { ascending: false })
    .limit(200)

  return (
    <PatientsClient
      initialPatients={(patients ?? []) as Parameters<typeof PatientsClient>[0]['initialPatients']}
      totalCount={count ?? 0}
    />
  )
}
