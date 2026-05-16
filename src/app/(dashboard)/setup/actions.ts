'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function getMembership() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('company_members').select('company_id').eq('user_id', user.id).eq('is_active', true).single()
  return data ? { companyId: data.company_id, userId: user.id, supabase } : null
}

export async function saveClinicData(form: { name: string; phone: string; email: string }) {
  const m = await getMembership()
  if (!m) return { error: 'Não autenticado' }
  const { error } = await m.supabase.from('companies')
    .update({ name: form.name.trim(), phone: form.phone.trim() || null, email: form.email.trim() || null })
    .eq('id', m.companyId)
  if (error) return { error: error.message }
  revalidatePath('/', 'layout')
  return { success: true }
}

export async function saveProcedure(data: { name: string; duration_minutes: number; price?: number; color?: string }) {
  const m = await getMembership()
  if (!m) return { error: 'Não autenticado' }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: proc, error } = await (m.supabase as any).from('procedures').insert({
    company_id: m.companyId,
    name: data.name.trim(),
    duration_minutes: data.duration_minutes,
    price: data.price ?? null,
    color: data.color ?? '#10B981',
  }).select('id, name, duration_minutes, price, color').single()
  if (error) return { error: error.message }
  revalidatePath('/setup')
  return { success: true, procedure: proc }
}

export async function saveProfessional(data: { name: string; specialty?: string; color?: string }) {
  const m = await getMembership()
  if (!m) return { error: 'Não autenticado' }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: prof, error } = await (m.supabase as any).from('professionals').insert({
    company_id: m.companyId,
    name: data.name.trim(),
    specialty: data.specialty?.trim() || null,
    color: data.color ?? '#3B82F6',
  }).select('id, name, specialty, color').single()
  if (error) return { error: error.message }
  revalidatePath('/setup')
  return { success: true, professional: prof }
}

export async function saveProfessionalProcedures(professionalId: string, procedureIds: string[]) {
  const m = await getMembership()
  if (!m) return { error: 'Não autenticado' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (m.supabase as any).from('professional_procedures')
    .delete().eq('professional_id', professionalId).eq('company_id', m.companyId)

  if (procedureIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (m.supabase as any).from('professional_procedures').insert(
      procedureIds.map((pid) => ({ professional_id: professionalId, procedure_id: pid, company_id: m.companyId }))
    )
    if (error) return { error: error.message }
  }
  revalidatePath('/setup')
  return { success: true }
}

export async function saveProfessionalAvailability(
  professionalId: string,
  slots: { day_of_week: number; start_time: string; end_time: string }[]
) {
  const m = await getMembership()
  if (!m) return { error: 'Não autenticado' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (m.supabase as any).from('professional_availability')
    .delete().eq('professional_id', professionalId).eq('company_id', m.companyId)

  if (slots.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (m.supabase as any).from('professional_availability').insert(
      slots.map((s) => ({ professional_id: professionalId, company_id: m.companyId, ...s }))
    )
    if (error) return { error: error.message }
  }
  revalidatePath('/setup')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function getSetupStatus() {
  const m = await getMembership()
  if (!m) return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (m.supabase as any).rpc('get_setup_status', { p_company_id: m.companyId })
  return data as {
    clinic_configured: boolean; procedures_configured: boolean
    professionals_configured: boolean; procedures_linked: boolean
    availability_configured: boolean; whatsapp_connected: boolean; is_ready: boolean
  } | null
}
