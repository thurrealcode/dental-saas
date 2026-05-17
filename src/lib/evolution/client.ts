// Evolution API client — server-side only, never import in client components

const BASE_URL = process.env.EVOLUTION_API_URL!
const API_KEY  = process.env.EVOLUTION_API_KEY!

if (!BASE_URL || !API_KEY) {
  // Only throws at runtime when the module is actually used
}

function headers() {
  return { 'Content-Type': 'application/json', apikey: API_KEY }
}

function stripDataUri(b64: string | null | undefined): string | null {
  if (!b64) return null
  return b64.replace(/^data:[^;]+;base64,/, '')
}

export async function createInstance(instanceName: string, webhookUrl: string) {
  const res = await fetch(`${BASE_URL}/instance/create`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      instanceName,
      integration: 'WHATSAPP-BAILEYS',
      qrcode: true,
      webhook: {
        url: webhookUrl,
        byEvents: false,
        base64: false,
        enabled: true,
        events: ['MESSAGES_UPSERT'],
      },
    }),
  })
  if (!res.ok) throw new Error(`Evolution create-instance failed: ${res.status}`)
  const data = await res.json() as {
    instance: { instanceName: string; instanceId: string; status: string }
    qrcode: { code: string; base64: string } | null
  }
  if (data.qrcode?.base64) {
    data.qrcode.base64 = stripDataUri(data.qrcode.base64) ?? data.qrcode.base64
  }
  return data
}

export async function getQR(instanceName: string) {
  const res = await fetch(`${BASE_URL}/instance/connect/${instanceName}`, {
    headers: headers(),
    next: { revalidate: 0 },
  })
  if (!res.ok) throw new Error(`Evolution connect failed: ${res.status}`)
  const data = await res.json() as { code: string; base64: string; count: number }
  data.base64 = stripDataUri(data.base64) ?? data.base64
  return data
}

export async function getConnectionState(instanceName: string) {
  const res = await fetch(`${BASE_URL}/instance/connectionState/${instanceName}`, {
    headers: headers(),
    next: { revalidate: 0 },
  })
  if (!res.ok) throw new Error(`Evolution state failed: ${res.status}`)
  const data = (await res.json()) as { instance: { instanceName: string; state: string } }
  return data.instance.state as 'open' | 'connecting' | 'close'
}

export async function deleteInstance(instanceName: string) {
  const res = await fetch(`${BASE_URL}/instance/delete/${instanceName}`, {
    method: 'DELETE',
    headers: headers(),
  })
  if (!res.ok) throw new Error(`Evolution delete failed: ${res.status}`)
  return res.json()
}

export function makeInstanceName(slug: string): string {
  // dental-{slug} — lowercase, alphanumeric + hyphens, max 50 chars
  const safe = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').slice(0, 43)
  return `dental-${safe}`
}
