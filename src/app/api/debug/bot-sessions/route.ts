import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

// GET /api/debug/bot-sessions
// Diagnostic: checks what's actually in bot_sessions for this company
// Uses service client (bypasses RLS) so you see the real DB state.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!membership) return NextResponse.json({ error: 'No company membership' }, { status: 403 })

  const companyId = membership.company_id
  const now = new Date().toISOString()

  // Use service client to bypass RLS
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceClient() as any

  const { data: allSessions, error: allErr } = await db
    .from('bot_sessions')
    .select('phone, push_name, step, flow, updated_at, expires_at, company_id')
    .eq('company_id', companyId)
    .order('updated_at', { ascending: false })
    .limit(20)

  const { data: activeSessions, error: activeErr } = await db
    .from('bot_sessions')
    .select('phone, push_name, step, flow, updated_at, expires_at')
    .eq('company_id', companyId)
    .gt('expires_at', now)
    .order('updated_at', { ascending: false })

  // Also try reading via user client (to detect RLS issues)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userDb = supabase as any
  const { data: userRead, error: userErr } = await userDb
    .from('bot_sessions')
    .select('phone, step, updated_at, expires_at')
    .eq('company_id', companyId)
    .order('updated_at', { ascending: false })
    .limit(5)

  const hasFlowColumn = allSessions?.length > 0
    ? 'flow' in (allSessions[0] ?? {})
    : 'unknown (no rows yet)'

  return NextResponse.json({
    companyId,
    now,
    diagnosis: {
      totalSessions:  allSessions?.length ?? 0,
      activeSessions: activeSessions?.length ?? 0,
      hasFlowColumn,
      rlsBlocking: !userErr && (userRead?.length ?? 0) < (allSessions?.length ?? 0)
        ? 'POSSIBLE — service sees more rows than user client'
        : 'OK',
    },
    migration: {
      needed: allErr?.message?.includes('flow') || allErr?.message?.includes('appointment_id')
        ? 'YES — run: ALTER TABLE bot_sessions ADD COLUMN IF NOT EXISTS flow text, ADD COLUMN IF NOT EXISTS appointment_id uuid;'
        : allSessions?.length > 0 && !('flow' in (allSessions[0] ?? {}))
          ? 'YES — flow column missing'
          : 'OK (or no rows to inspect)',
    },
    recentSessions: allSessions ?? [],
    errors: {
      serviceClient: allErr?.message ?? null,
      userClient:    userErr?.message ?? null,
    },
    userClientSample: userRead ?? [],
  })
}
