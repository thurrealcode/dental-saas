import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SetupWizard } from './setup-wizard'

export default async function SetupPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: membership } = await supabase
    .from('company_members').select('company_id, companies(*)')
    .eq('user_id', user!.id).eq('is_active', true).single()

  if (!membership) redirect('/onboarding')

  const companyId = membership.company_id
  const company = membership.companies as unknown as { name: string; phone: string | null; email: string | null } | null

  const [procsRes, profsRes, availRes, profProcsRes] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from('procedures').select('id, name, duration_minutes, price, color')
      .eq('company_id', companyId).eq('active', true).order('name'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from('professionals').select('id, name, specialty, color')
      .eq('company_id', companyId).eq('active', true).order('name'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from('professional_availability')
      .select('professional_id, day_of_week, start_time, end_time')
      .eq('company_id', companyId).eq('active', true),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from('professional_procedures')
      .select('professional_id, procedure_id')
      .eq('company_id', companyId),
  ])

  return (
    <SetupWizard
      company={{ name: company?.name ?? '', phone: company?.phone ?? '', email: company?.email ?? '' }}
      procedures={(procsRes.data ?? []) as Procedure[]}
      professionals={(profsRes.data ?? []) as Professional[]}
      availability={(availRes.data ?? []) as AvailabilitySlot[]}
      professionalProcedures={(profProcsRes.data ?? []) as ProfProc[]}
    />
  )
}

export interface Procedure { id: string; name: string; duration_minutes: number; price: number | null; color: string }
export interface Professional { id: string; name: string; specialty: string | null; color: string }
export interface AvailabilitySlot { professional_id: string; day_of_week: number; start_time: string; end_time: string }
export interface ProfProc { professional_id: string; procedure_id: string }
