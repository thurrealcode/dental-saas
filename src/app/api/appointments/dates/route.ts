import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const year = Number(searchParams.get('year'))
  const month = Number(searchParams.get('month')) // 1-indexed

  if (!year || !month || month < 1 || month > 12) {
    return NextResponse.json({ dates: [] })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!membership) return NextResponse.json({ dates: [] })

  const startOfMonth = new Date(year, month - 1, 1, 0, 0, 0).toISOString()
  const endOfMonth   = new Date(year, month, 0, 23, 59, 59).toISOString()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('appointments')
    .select('start_at')
    .eq('company_id', membership.company_id)
    .gte('start_at', startOfMonth)
    .lte('start_at', endOfMonth)
    .neq('status', 'cancelled')

  const days: number[] = [
    ...new Set((data ?? []).map((a: { start_at: string }) => new Date(a.start_at).getDate())),
  ] as number[]

  return NextResponse.json({ dates: days })
}
