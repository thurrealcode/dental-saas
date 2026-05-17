import { NextResponse } from 'next/server'
import { createRouteClient, getCompanyId } from '@/lib/supabase/route-client'
import { getQR, makeInstanceName } from '@/lib/evolution/client'

export async function GET() {
  try {
    const supabase = await createRouteClient()
    const identity = await getCompanyId(supabase)
    if (!identity) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    const instanceName = makeInstanceName(identity.slug)
    const data = await getQR(instanceName)
    return NextResponse.json({ qr: data.base64, code: data.code })
  } catch (err) {
    console.error('[whatsapp/qr]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao obter QR' },
      { status: 500 }
    )
  }
}
