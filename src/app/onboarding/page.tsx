'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createCompany } from '@/lib/supabase/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Stethoscope, Building2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export default function OnboardingPage() {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  function handleNameChange(value: string) {
    setName(value)
    setSlug(
      value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !slug.trim()) return
    setLoading(true)
    setError('')

    const result = await createCompany(name.trim(), slug.trim())

    if (result?.error) {
      setError(result.error)
      toast.error(result.error)
      setLoading(false)
      return
    }

    router.push('/setup')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-600 mb-4">
            <Stethoscope className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Bem-vindo ao DentalFlow!</h1>
          <p className="text-slate-400 text-sm">Configure sua clínica para começar</p>
        </div>

        <Card className="border-slate-800 bg-slate-900/50 backdrop-blur">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-blue-400" />
              <div>
                <CardTitle className="text-white text-lg">Dados da Clínica</CardTitle>
                <CardDescription className="text-slate-400">
                  Essas informações serão usadas em toda a plataforma
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Nome da Clínica</Label>
                <Input
                  placeholder="Clínica Odonto Silva"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  required
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-blue-600"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">URL da clínica</Label>
                <div className="flex items-center rounded-lg border border-slate-700 bg-slate-800 overflow-hidden">
                  <span className="px-3 text-xs text-slate-500 border-r border-slate-700 py-2 bg-slate-900">
                    dentalflow.app/
                  </span>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    className="flex-1 bg-transparent px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500"
                    placeholder="clinica-silva"
                    required
                  />
                </div>
                <p className="text-xs text-slate-500">Apenas letras minúsculas, números e hífens</p>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              {error && (
                <p className="w-full text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={loading || !name || !slug}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar minha clínica
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}
