'use client'

import { useState, useTransition } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { saveClinicData } from '../setup/actions'

interface Props {
  name: string
  slug: string
  email: string
  phone: string
  address: string
}

export function ClinicSettingsForm({ name, slug, email, phone, address }: Props) {
  const [form, setForm] = useState({ name, email, phone, address })
  const [status, setStatus] = useState<'idle' | 'ok' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [isPending, startTransition] = useTransition()

  function field(key: keyof typeof form) {
    return {
      value: form[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm(f => ({ ...f, [key]: e.target.value }))
        setStatus('idle')
      },
    }
  }

  function handleSave() {
    startTransition(async () => {
      const res = await saveClinicData(form)
      if (res.error) {
        setErrorMsg(
          res.error.includes('address')
            ? 'Coluna "address" não existe ainda. Execute no Supabase SQL Editor:\nALTER TABLE companies ADD COLUMN IF NOT EXISTS address text;'
            : res.error
        )
        setStatus('error')
      } else {
        setStatus('ok')
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-gray-700 text-sm">Nome da Clínica</Label>
          <Input
            {...field('name')}
            className="bg-white border-gray-200 text-gray-900 focus-visible:ring-blue-500"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-gray-700 text-sm">Slug (URL)</Label>
          <Input
            defaultValue={slug}
            disabled
            className="bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-gray-700 text-sm">Email</Label>
          <Input
            type="email"
            {...field('email')}
            className="bg-white border-gray-200 text-gray-900 focus-visible:ring-blue-500"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-gray-700 text-sm">Telefone</Label>
          <Input
            {...field('phone')}
            className="bg-white border-gray-200 text-gray-900 focus-visible:ring-blue-500"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label className="text-gray-700 text-sm">Endereço da Clínica</Label>
          <Input
            {...field('address')}
            placeholder="Ex: Rua das Flores, 123 – Centro, São Paulo/SP"
            className="bg-white border-gray-200 text-gray-900 focus-visible:ring-blue-500"
          />
          <p className="text-[11px] text-gray-400">Exibido na confirmação de agendamento pelo WhatsApp.</p>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Button
          onClick={handleSave}
          disabled={isPending}
          className="bg-blue-600 hover:bg-blue-700 shadow-sm disabled:opacity-60"
        >
          {isPending ? 'Salvando…' : 'Salvar alterações'}
        </Button>

        {status === 'ok' && (
          <span className="text-xs font-medium text-emerald-600">✓ Salvo com sucesso</span>
        )}
        {status === 'error' && (
          <span className="text-xs font-medium text-red-600 whitespace-pre-line">{errorMsg}</span>
        )}
      </div>
    </div>
  )
}
