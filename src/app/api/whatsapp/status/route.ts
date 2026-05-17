import { NextResponse } from 'next/server'
import { createRouteClient, getCompanyId } from '@/lib/supabase/route-client'
import { getConnectionState, makeInstanceName } from '@/lib/evolution/client'

export async function GET() {
  try {
    const supabase = await createRouteClient()
    const identity = await getCompanyId(supabase)
    if (!identity) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    const { companyId, slug } = identity
    const instanceName = makeInstanceName(slug)

    const state = await getConnectionState(instanceName)

    // When WhatsApp connects, mark integration as active in Supabase
    if (state === 'open') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('integrations')
        .update({ is_active: true, last_connected_at: new Date().toISOString() })
        .eq('company_id', companyId)
        .eq('type', 'whatsapp')
    }

    return NextResponse.json({ state, instanceName })
  } catch (err) {
    console.error('[whatsapp/status]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao verificar status' },
      { status: 500 }
    )
  }
}
