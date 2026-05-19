'use client'

import { useState } from 'react'
import { UserPlus, Copy, Check, Clock, ChevronDown, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { generateInvite } from './invite-actions'

const ROLES = [
  {
    value: 'admin' as const,
    label: 'Administrador',
    desc: 'Acesso total ao sistema',
    color: 'border-blue-200 text-blue-700 bg-blue-50',
  },
  {
    value: 'receptionist' as const,
    label: 'Atendente',
    desc: 'Dashboard · Agenda · Pacientes · WhatsApp',
    color: 'border-violet-200 text-violet-700 bg-violet-50',
  },
  {
    value: 'dentist' as const,
    label: 'Profissional',
    desc: 'Agenda própria · Consultas vinculadas',
    color: 'border-emerald-200 text-emerald-700 bg-emerald-50',
  },
]

export function InviteButton() {
  const [open, setOpen] = useState(false)
  const [role, setRole] = useState<'admin' | 'receptionist' | 'dentist'>('receptionist')
  const [selectOpen, setSelectOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const selectedRole = ROLES.find(r => r.value === role)!

  function handleOpen() {
    setOpen(true)
    setInviteUrl(null)
    setCopied(false)
    setRole('receptionist')
  }

  async function handleGenerate() {
    setLoading(true)
    const result = await generateInvite(role)
    setLoading(false)

    if ('error' in result && result.error) {
      toast.error(result.error)
      return
    }

    setInviteUrl(result.url!)
  }

  async function handleCopy() {
    if (!inviteUrl) return
    await navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    toast.success('Link copiado!')
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="border-blue-200 text-blue-700 hover:bg-blue-50 bg-white text-xs shadow-sm gap-1.5"
        onClick={handleOpen}
      >
        <UserPlus className="h-3.5 w-3.5" />
        Convidar membro
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md bg-white border-gray-200 shadow-xl">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                <UserPlus className="h-4 w-4 text-blue-600" />
              </div>
              <DialogTitle className="text-gray-900 text-base font-semibold">
                Convidar membro da equipe
              </DialogTitle>
            </div>
          </DialogHeader>

          <div className="space-y-5 pt-2">
            {/* Role selector */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Função</Label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setSelectOpen(v => !v)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors text-sm text-gray-900"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`text-xs ${selectedRole.color}`}>
                      {selectedRole.label}
                    </Badge>
                    <span className="text-gray-400 text-xs">{selectedRole.desc}</span>
                  </div>
                  <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${selectOpen ? 'rotate-180' : ''}`} />
                </button>

                {selectOpen && (
                  <div className="absolute z-10 top-full mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden">
                    {ROLES.map(r => (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => { setRole(r.value); setSelectOpen(false); setInviteUrl(null) }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors text-left ${role === r.value ? 'bg-blue-50' : ''}`}
                      >
                        <Badge variant="outline" className={`text-xs flex-shrink-0 ${r.color}`}>
                          {r.label}
                        </Badge>
                        <span className="text-xs text-gray-400">{r.desc}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Expiry badge */}
            <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              <Clock className="h-3.5 w-3.5 flex-shrink-0" />
              <span>O link expira em <strong>7 dias</strong> e pode ser usado uma vez</span>
            </div>

            {/* Generated link */}
            {inviteUrl && (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Link de convite</Label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-xs text-gray-600 font-mono truncate select-all">
                    {inviteUrl}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className={`flex-shrink-0 gap-1.5 transition-all ${copied ? 'border-emerald-200 text-emerald-700 bg-emerald-50' : 'border-gray-200 text-gray-700'}`}
                    onClick={handleCopy}
                  >
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? 'Copiado!' : 'Copiar'}
                  </Button>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                className="flex-1 border-gray-200 text-gray-600"
                onClick={() => setOpen(false)}
              >
                Fechar
              </Button>
              <Button
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
                onClick={inviteUrl ? handleCopy : handleGenerate}
                disabled={loading}
              >
                {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {loading ? 'Gerando...' : inviteUrl ? (
                  <><Copy className="h-3.5 w-3.5" /> Copiar link</>
                ) : 'Gerar link'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
