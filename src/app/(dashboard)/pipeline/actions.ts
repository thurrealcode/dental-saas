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

export async function createPipelineCard(form: {
  stage_id: string
  title: string
  patient_id?: string
  value?: number
  due_date?: string
  description?: string
}) {
  const supabase = await createClient()
  const member = await getMembership()
  if (!member) return { error: 'Não autenticado' }

  const { data: maxPos } = await supabase
    .from('pipeline_cards')
    .select('position')
    .eq('stage_id', form.stage_id)
    .order('position', { ascending: false })
    .limit(1)
    .single()

  const position = ((maxPos?.position ?? -1) as number) + 1

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('pipeline_cards').insert({
    company_id: member.companyId,
    created_by: member.userId,
    stage_id: form.stage_id,
    title: form.title.trim(),
    patient_id: form.patient_id || null,
    value: form.value || null,
    due_date: form.due_date || null,
    description: form.description?.trim() || null,
    position,
  })

  if (error) return { error: error.message }

  revalidatePath('/pipeline')
  return { success: true }
}

export async function moveCard(cardId: string, newStageId: string) {
  const supabase = await createClient()
  const member = await getMembership()
  if (!member) return { error: 'Não autenticado' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('pipeline_cards')
    .update({ stage_id: newStageId, updated_at: new Date().toISOString() })
    .eq('id', cardId)
    .eq('company_id', member.companyId)

  if (error) return { error: error.message }

  revalidatePath('/pipeline')
  return { success: true }
}
