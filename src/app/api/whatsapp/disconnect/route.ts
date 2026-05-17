import { NextResponse } from 'next/server'
import { createRouteClient, getCompanyId } from '@/lib/supabase/route-client'
import { deleteInstance, makeInstanceName } from '@/lib/evolution/client'

export async function DELETE() {
  try {
    const supabase = await createRouteClient()
    const identity = await getCompanyId(supabase)
    if (!identity) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    const { companyId, slug } = identity
    const instanceName = makeInstanceName(slug)

    // Delete from Evolution API (ignore 404 — instance may not exist)
    try {
      await deleteInstance(instanceName)
    } catch (e) {
      console.warn('[whatsapp/disconnect] Evolution delete failed (ignored):', e)
    }

    // Mark integration as inactive in Supabase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('integrations')
      .update({ is_active: false })
      .eq('company_id', companyId)
      .eq('type', 'whatsapp')

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[whatsapp/disconnect]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao desconectar' },
      { status: 500 }
    )
  }
}
