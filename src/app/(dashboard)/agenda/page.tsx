import { createClient } from '@/lib/supabase/server'
import { AgendaClient } from './agenda-client'

export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const params = await searchParams

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user!.id)
    .eq('is_active', true)
    .single()

  if (!membership) return null

  const companyId = membership.company_id

  // Resolve selected date
  const selectedDate = params.date ?? new Date().toISOString().slice(0, 10)
  const [y, m, d] = selectedDate.split('-').map(Number)
  const startOfDay = new Date(y, m - 1, d, 0, 0, 0).toISOString()
  const endOfDay = new Date(y, m - 1, d, 23, 59, 59).toISOString()

  const [appointmentsRes, patientsRes, professionalsRes, proceduresRes] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('appointments')
      .select('*, patients(full_name), professionals(name, color), procedures(name)')
      .eq('company_id', companyId)
      .gte('start_at', startOfDay)
      .lte('start_at', endOfDay)
      .order('start_at', { ascending: true }),

    supabase
      .from('patients')
      .select('id, full_name')
      .eq('company_id', companyId)
      .order('full_name'),

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('professionals')
      .select('id, name, specialty, color')
      .eq('company_id', companyId)
      .eq('active', true)
      .order('name'),

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('procedures')
      .select('id, name, duration_minutes, color')
      .eq('company_id', companyId)
      .eq('active', true)
      .order('name'),
  ])

  type Appt = {
    id: string; title: string; status: 'scheduled'|'confirmed'|'in_progress'|'completed'|'cancelled'|'no_show'
    start_at: string; end_at: string; notes: string | null
    patients: unknown; professionals: unknown; procedures: unknown
  }

  return (
    <AgendaClient
      appointments={(appointmentsRes.data ?? []) as Appt[]}
      patients={(patientsRes.data ?? []) as { id: string; full_name: string }[]}
      professionals={(professionalsRes.data ?? []) as { id: string; name: string; specialty: string | null; color: string }[]}
      procedures={(proceduresRes.data ?? []) as { id: string; name: string; duration_minutes: number; color: string }[]}
      selectedDate={selectedDate}
    />
  )
}
