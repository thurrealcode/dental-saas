'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function getCompanyId() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  return data?.company_id ?? null
}

export async function createAppointment(formData: {
  patient_id: string
  professional_id?: string
  procedure_id?: string
  start_at: string
  end_at: string
  title: string
  notes?: string
}) {
  const supabase = await createClient()
  const companyId = await getCompanyId()
  if (!companyId) return { error: 'Não autenticado' }

  // Only check conflicts when a professional is assigned
  if (formData.professional_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: conflicts } = await (supabase as any).rpc('check_appointment_conflict', {
      p_company_id: companyId,
      p_professional_id: formData.professional_id,
      p_start_time: formData.start_at,
      p_end_time: formData.end_at,
    })
    const conflict = (conflicts as Array<{ has_conflict: boolean; conflict_reason: string | null }>)?.[0]
    if (conflict?.has_conflict) {
      return { error: conflict.conflict_reason ?? 'Conflito de horário' }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('appointments').insert({
    company_id: companyId,
    patient_id: formData.patient_id,
    professional_id: formData.professional_id || null,
    procedure_id: formData.procedure_id || null,
    start_at: formData.start_at,
    end_at: formData.end_at,
    title: formData.title,
    notes: formData.notes || null,
    status: 'scheduled',
  })

  if (error) return { error: error.message }

  revalidatePath('/agenda')
  return { success: true }
}

export async function updateAppointmentStatus(appointmentId: string, status: string) {
  const supabase = await createClient()
  const companyId = await getCompanyId()
  if (!companyId) return { error: 'Não autenticado' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('appointments')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', appointmentId)
    .eq('company_id', companyId)

  if (error) return { error: error.message }

  revalidatePath('/agenda')
  return { success: true }
}

export async function createProfessional(data: { name: string; specialty?: string; color?: string }) {
  const supabase = await createClient()
  const companyId = await getCompanyId()
  if (!companyId) return { error: 'Não autenticado' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('professionals').insert({
    company_id: companyId,
    name: data.name,
    specialty: data.specialty || null,
    color: data.color || '#3B82F6',
  })

  if (error) return { error: error.message }

  revalidatePath('/agenda')
  revalidatePath('/settings')
  return { success: true }
}

export async function createProcedure(data: { name: string; duration_minutes: number; price?: number; color?: string }) {
  const supabase = await createClient()
  const companyId = await getCompanyId()
  if (!companyId) return { error: 'Não autenticado' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('procedures').insert({
    company_id: companyId,
    name: data.name,
    duration_minutes: data.duration_minutes,
    price: data.price || null,
    color: data.color || '#10B981',
  })

  if (error) return { error: error.message }

  revalidatePath('/agenda')
  revalidatePath('/settings')
  return { success: true }
}

export async function saveAvailability(
  professionalId: string,
  slots: { day_of_week: number; start_time: string; end_time: string }[]
) {
  const supabase = await createClient()
  const companyId = await getCompanyId()
  if (!companyId) return { error: 'Não autenticado' }

  // Delete existing and insert new
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from('professional_availability')
    .delete()
    .eq('professional_id', professionalId)
    .eq('company_id', companyId)

  if (slots.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from('professional_availability').insert(
      slots.map((s) => ({
        professional_id: professionalId,
        company_id: companyId,
        day_of_week: s.day_of_week,
        start_time: s.start_time,
        end_time: s.end_time,
      }))
    )
    if (error) return { error: error.message }
  }

  revalidatePath('/agenda')
  return { success: true }
}
