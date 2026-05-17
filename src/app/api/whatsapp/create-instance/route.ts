import { NextResponse } from 'next/server'
import { createRouteClient, getCompanyId } from '@/lib/supabase/route-client'
import { createInstance, deleteInstance, getQR, makeInstanceName } from '@/lib/evolution/client'

export async function POST() {
  try {
    const supabase = await createRouteClient()
    const identity = await getCompanyId(supabase)
    if (!identity) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    const { companyId, slug } = identity
    const instanceName = makeInstanceName(slug)
    const webhookUrl = process.env.N8N_WEBHOOK_URL!

    // Check if integration already exists
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase as any)
      .from('integrations')
      .select('id, config, is_active')
      .eq('company_id', companyId)
      .eq('type', 'whatsapp')
      .maybeSingle()

    // If already connected, return current state
    if (existing?.is_active) {
      return NextResponse.json({
        instanceName: (existing.config as { instance_name: string }).instance_name,
        status: 'already_connected',
      })
    }

    // Create instance on Evolution API — delete first if it already exists
    let result = await createInstance(instanceName, webhookUrl).catch(async (err: Error) => {
      if (err.message.includes('already')) {
        await deleteInstance(instanceName).catch(() => {})
        return createInstance(instanceName, webhookUrl)
      }
      throw err
    })

    // If create returned no QR (can happen), fetch it explicitly
    if (!result.qrcode?.base64) {
      const qrData = await getQR(instanceName).catch(() => null)
      if (qrData?.base64) {
        result = { ...result, qrcode: { code: qrData.code, base64: qrData.base64 } }
      }
    }

    const config = {
      instance_name: instanceName,
      instance_id: result.instance.instanceId,
      webhook_url: webhookUrl,
    }

    if (existing) {
      // Update existing integration
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('integrations')
        .update({ config, is_active: false, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
    } else {
      // Create new integration record
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('integrations')
        .insert({ company_id: companyId, type: 'whatsapp', name: 'Evolution API', config, is_active: false })
    }

    return NextResponse.json({
      instanceName,
      qr: result.qrcode?.base64 ?? null,
      status: 'connecting',
    })
  } catch (err) {
    console.error('[whatsapp/create-instance]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
