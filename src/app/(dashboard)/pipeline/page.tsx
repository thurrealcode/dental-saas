import { createClient } from '@/lib/supabase/server'
import { PipelineClient } from './pipeline-client'

export default async function PipelinePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user!.id)
    .eq('is_active', true)
    .single()

  if (!membership) return null

  const companyId = membership.company_id

  const [stagesRes, cardsRes, patientsRes] = await Promise.all([
    supabase
      .from('pipeline_stages')
      .select('id, name, color, position')
      .eq('company_id', companyId)
      .order('position', { ascending: true }),

    supabase
      .from('pipeline_cards')
      .select('id, stage_id, title, description, value, due_date, patient_id, patients(full_name)')
      .eq('company_id', companyId)
      .order('position', { ascending: true }),

    supabase
      .from('patients')
      .select('id, full_name')
      .eq('company_id', companyId)
      .order('full_name'),
  ])

  return (
    <PipelineClient
      stages={(stagesRes.data ?? []) as Parameters<typeof PipelineClient>[0]['stages']}
      initialCards={(cardsRes.data ?? []) as Parameters<typeof PipelineClient>[0]['initialCards']}
      patients={patientsRes.data ?? []}
    />
  )
}
