import { NextResponse } from 'next/server'
import { createRouteClient, getCompanyId } from '@/lib/supabase/route-client'
import { setWebhook } from '@/lib/evolution/client'

export async function POST() {
  try {
    const supabase = await createRouteClient()
    const identity = await getCompanyId(supabase)
    if (!identity) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { companyId } = identity
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: integration } = await (supabase as any)
      .from('integrations')
      .select('config')
      .eq('company_id', companyId)
      .eq('type', 'whatsapp')
      .eq('is_active', true)
      .maybeSingle()

    if (!integration) return NextResponse.json({ error: 'Integração WhatsApp não encontrada' }, { status: 404 })

    const instanceName = (integration.config as { instance_name: string }).instance_name
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/whatsapp/webhook`

    await setWebhook(instanceName, webhookUrl)

    return NextResponse.json({ ok: true, webhookUrl })
  } catch (err) {
    console.error('[whatsapp/update-webhook]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro interno' }, { status: 500 })
  }
}
