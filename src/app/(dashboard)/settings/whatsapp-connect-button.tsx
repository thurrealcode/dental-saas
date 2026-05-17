'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { CheckCircle2, Loader2, RefreshCw, Wifi, WifiOff } from 'lucide-react'

type WaState = 'idle' | 'connecting' | 'qr' | 'connected' | 'error' | 'disconnecting'

export function WhatsAppConnectButton({ initialConnected }: { initialConnected: boolean }) {
  const [open, setOpen] = useState(false)
  const [waState, setWaState] = useState<WaState>(initialConnected ? 'connected' : 'idle')
  const [qrBase64, setQrBase64] = useState<string | null>(null)
  const [waError, setWaError] = useState<string | null>(null)
  const statusPollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const qrRefreshRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const stopTimers = useCallback(() => {
    if (statusPollRef.current) { clearInterval(statusPollRef.current); statusPollRef.current = null }
    if (qrRefreshRef.current) { clearTimeout(qrRefreshRef.current); qrRefreshRef.current = null }
  }, [])

  useEffect(() => () => stopTimers(), [stopTimers])

  const scheduleQrRefresh = useCallback(() => {
    qrRefreshRef.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/whatsapp/qr')
        if (res.ok) {
          const data = await res.json()
          if (data.qr) setQrBase64(data.qr)
        }
      } catch { /* ignore */ }
      scheduleQrRefresh()
    }, 40_000)
  }, [])

  const startStatusPoll = useCallback(() => {
    statusPollRef.current = setInterval(async () => {
      try {
        const res = await fetch('/api/whatsapp/status')
        if (!res.ok) return
        const data = await res.json()
        if (data.state === 'open') {
          stopTimers()
          setWaState('connected')
        }
      } catch { /* ignore */ }
    }, 3_000)
  }, [stopTimers])

  async function handleConnect() {
    setWaState('connecting')
    setWaError(null)
    try {
      const res = await fetch('/api/whatsapp/create-instance', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao criar instância')
      if (data.status === 'already_connected') {
        setWaState('connected')
        return
      }
      setQrBase64(data.qr ?? null)
      setWaState('qr')
      startStatusPoll()
      scheduleQrRefresh()
    } catch (e) {
      setWaError(e instanceof Error ? e.message : 'Erro desconhecido')
      setWaState('error')
    }
  }

  async function handleRefreshQr() {
    try {
      const res = await fetch('/api/whatsapp/qr')
      if (res.ok) {
        const data = await res.json()
        if (data.qr) setQrBase64(data.qr)
      }
    } catch { /* ignore */ }
  }

  async function handleDisconnect() {
    setWaState('disconnecting')
    stopTimers()
    try {
      await fetch('/api/whatsapp/disconnect', { method: 'DELETE' })
    } catch { /* ignore */ }
    setWaState('idle')
    setQrBase64(null)
  }

  function handleOpenChange(next: boolean) {
    if (!next) stopTimers()
    setOpen(next)
  }

  const isConnected = waState === 'connected'

  return (
    <>
      <Badge
        variant="outline"
        className={`text-xs ${isConnected
          ? 'border-emerald-200 text-emerald-700 bg-emerald-50'
          : 'border-gray-200 text-gray-400 bg-white'}`}
      >
        {isConnected ? 'Conectado' : 'Não conectado'}
      </Badge>

      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        className="border-gray-200 text-gray-600 hover:text-gray-900 bg-white hover:bg-gray-50 text-xs shadow-sm"
      >
        Configurar
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>WhatsApp Business</DialogTitle>
            <DialogDescription>Conecte seu número via Evolution API</DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-4">
            {waState === 'idle' && (
              <div className="text-center space-y-4">
                <div className="h-14 w-14 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto">
                  <Wifi className="h-7 w-7 text-emerald-600" />
                </div>
                <p className="text-sm text-gray-500">
                  Conecte seu número para ativar o bot de agendamento automático via WhatsApp.
                </p>
                <Button onClick={handleConnect} className="w-full bg-emerald-600 hover:bg-emerald-700 gap-2">
                  <Wifi className="h-4 w-4" />
                  Conectar WhatsApp
                </Button>
              </div>
            )}

            {waState === 'connecting' && (
              <div className="text-center space-y-3 py-4">
                <Loader2 className="h-10 w-10 animate-spin text-emerald-600 mx-auto" />
                <p className="text-sm text-gray-500">Criando instância...</p>
              </div>
            )}

            {waState === 'qr' && (
              <div className="text-center space-y-3">
                <p className="text-sm font-medium text-gray-700">Escaneie com o WhatsApp Business</p>
                {qrBase64 ? (
                  <img
                    src={`data:image/png;base64,${qrBase64}`}
                    alt="QR Code WhatsApp"
                    className="mx-auto rounded-lg border border-gray-200"
                    width={220}
                    height={220}
                  />
                ) : (
                  <div className="h-[220px] w-[220px] mx-auto rounded-lg bg-gray-100 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                  </div>
                )}
                <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Aguardando conexão...
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefreshQr}
                  className="gap-1.5 text-xs"
                >
                  <RefreshCw className="h-3 w-3" />
                  Atualizar QR
                </Button>
              </div>
            )}

            {waState === 'connected' && (
              <div className="text-center space-y-4">
                <CheckCircle2 className="h-12 w-12 text-emerald-600 mx-auto" />
                <div>
                  <p className="font-semibold text-gray-900">Bot ativo!</p>
                  <p className="text-sm text-gray-500 mt-1">
                    WhatsApp conectado. O bot de agendamento está funcionando.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDisconnect}
                  className="gap-1.5 text-xs border-red-200 text-red-600 hover:bg-red-50"
                >
                  <WifiOff className="h-3 w-3" />
                  Desconectar
                </Button>
              </div>
            )}

            {waState === 'disconnecting' && (
              <div className="text-center space-y-3 py-4">
                <Loader2 className="h-10 w-10 animate-spin text-gray-400 mx-auto" />
                <p className="text-sm text-gray-500">Desconectando...</p>
              </div>
            )}

            {waState === 'error' && (
              <div className="text-center space-y-3">
                <WifiOff className="h-10 w-10 text-red-400 mx-auto" />
                <p className="text-sm font-medium text-red-700">Erro ao conectar</p>
                <p className="text-xs text-red-500">{waError}</p>
                <Button
                  onClick={handleConnect}
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 gap-1.5 text-xs"
                >
                  Tentar novamente
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
