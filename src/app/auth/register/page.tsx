'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Loader2, Stethoscope } from 'lucide-react'

export default function RegisterPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [confirmedEmail, setConfirmedEmail] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    // Read ?next= at submit time
    const next = new URLSearchParams(window.location.search).get('next') ?? '/onboarding'

    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        // After email confirmation, Supabase redirects here — preserves the invite link
        emailRedirectTo: window.location.origin + next,
      },
    })

    if (error) {
      toast.error(error.message)
      setLoading(false)
      return
    }

    // If Supabase didn't require email confirmation, session is immediately available
    if (data.session) {
      window.location.href = next
      return
    }

    setConfirmedEmail(email)
    setDone(true)
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <Card className="border-slate-800 bg-slate-900/50 w-full max-w-md text-center p-8">
          <div className="h-12 w-12 rounded-full bg-emerald-600/20 flex items-center justify-center mx-auto mb-4">
            <Stethoscope className="h-6 w-6 text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Conta criada!</h2>
          <p className="text-slate-400 text-sm mb-6">
            Verifique seu email <strong className="text-white">{confirmedEmail}</strong> para confirmar sua conta.
            O link no email vai te levar direto para entrar na clínica.
          </p>
          <Link href="/auth/login">
            <Button className="bg-blue-600 hover:bg-blue-700 w-full">Ir para o login</Button>
          </Link>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-600 mb-4">
            <Stethoscope className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">DentalFlow</h1>
          <p className="text-slate-400 text-sm">Crie sua conta gratuitamente</p>
        </div>

        <Card className="border-slate-800 bg-slate-900/50 backdrop-blur">
          <CardHeader className="pb-4">
            <CardTitle className="text-white text-xl">Criar conta</CardTitle>
            <CardDescription className="text-slate-400">Comece a gerenciar sua clínica hoje</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-slate-300">Nome completo</Label>
                <Input
                  id="name"
                  placeholder="Dr. João Silva"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-blue-600"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-300">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="voce@clinica.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-blue-600"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-300">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Mínimo 8 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  required
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-blue-600"
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar conta grátis
              </Button>
              <p className="text-sm text-slate-400 text-center">
                Já tem conta?{' '}
                <Link href="/auth/login" className="text-blue-400 hover:text-blue-300 font-medium">
                  Entrar
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}
