'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Stethoscope, CheckCircle2, Circle, Plus, Trash2, Loader2, Clock, DollarSign, User, Phone, Mail, Building2, Link2, Calendar, Wifi } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { saveClinicData, saveProcedure, saveProfessional, saveProfessionalProcedures, saveProfessionalAvailability } from './actions'
import type { Procedure, Professional, AvailabilitySlot, ProfProc } from './page'

const PROC_COLORS = ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#EC4899', '#06B6D4']
const PROF_COLORS = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#EC4899', '#06B6D4']

const DAYS = [
  { value: 1, label: 'Segunda' },
  { value: 2, label: 'Terça' },
  { value: 3, label: 'Quarta' },
  { value: 4, label: 'Quinta' },
  { value: 5, label: 'Sexta' },
  { value: 6, label: 'Sábado' },
  { value: 0, label: 'Domingo' },
]

const STEPS = [
  { id: 1, label: 'Clínica',          icon: Building2 },
  { id: 2, label: 'Serviços',         icon: Stethoscope },
  { id: 3, label: 'Profissionais',    icon: User },
  { id: 4, label: 'Vínculos',         icon: Link2 },
  { id: 5, label: 'Disponibilidade',  icon: Calendar },
  { id: 6, label: 'WhatsApp',         icon: Wifi },
]

interface Props {
  company: { name: string; phone: string; email: string }
  procedures: Procedure[]
  professionals: Professional[]
  availability: AvailabilitySlot[]
  professionalProcedures: ProfProc[]
}

export function SetupWizard({ company, procedures: initProcs, professionals: initProfs, availability: initAvail, professionalProcedures: initLinks }: Props) {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)

  // Step 1 state
  const [clinicName, setClinicName] = useState(company.name)
  const [clinicPhone, setClinicPhone] = useState(company.phone)
  const [clinicEmail, setClinicEmail] = useState(company.email)

  // Step 2 state
  const [procedures, setProcedures] = useState<Procedure[]>(initProcs)
  const [procName, setProcName] = useState('')
  const [procDuration, setProcDuration] = useState('30')
  const [procPrice, setProcPrice] = useState('')
  const [procColor, setProcColor] = useState(PROC_COLORS[0])
  const [addingProc, setAddingProc] = useState(false)

  // Step 3 state
  const [professionals, setProfessionals] = useState<Professional[]>(initProfs)
  const [profName, setProfName] = useState('')
  const [profSpecialty, setProfSpecialty] = useState('')
  const [profColor, setProfColor] = useState(PROF_COLORS[0])
  const [addingProf, setAddingProf] = useState(false)

  // Step 4 state: profId → Set of procIds
  const [links, setLinks] = useState<Record<string, Set<string>>>(() => {
    const map: Record<string, Set<string>> = {}
    for (const lk of initLinks) {
      if (!map[lk.professional_id]) map[lk.professional_id] = new Set()
      map[lk.professional_id].add(lk.procedure_id)
    }
    return map
  })

  // Step 5 state: profId → array of { day_of_week, start_time, end_time, enabled }
  type DaySlot = { day_of_week: number; start_time: string; end_time: string; enabled: boolean }
  const [avail, setAvail] = useState<Record<string, DaySlot[]>>(() => {
    const map: Record<string, DaySlot[]> = {}
    for (const prof of initProfs) {
      map[prof.id] = DAYS.map((d) => {
        const existing = initAvail.find((a) => a.professional_id === prof.id && a.day_of_week === d.value)
        return { day_of_week: d.value, start_time: existing?.start_time ?? '08:00', end_time: existing?.end_time ?? '18:00', enabled: !!existing }
      })
    }
    return map
  })

  // ── Step 1 ──────────────────────────────────────────────
  async function handleStep1() {
    if (!clinicName.trim()) { toast.error('Nome da clínica é obrigatório'); return }
    setLoading(true)
    const r = await saveClinicData({ name: clinicName, phone: clinicPhone, email: clinicEmail })
    setLoading(false)
    if (r?.error) { toast.error(r.error); return }
    setStep(2)
  }

  // ── Step 2 ──────────────────────────────────────────────
  async function handleAddProc(e: React.FormEvent) {
    e.preventDefault()
    if (!procName.trim()) return
    setAddingProc(true)
    const r = await saveProcedure({ name: procName, duration_minutes: parseInt(procDuration), price: procPrice ? parseFloat(procPrice) : undefined, color: procColor })
    setAddingProc(false)
    if (r?.error) { toast.error(r.error); return }
    if (r.procedure) {
      setProcedures((p) => [...p, r.procedure as Procedure])
      // init avail for existing profs
      setAvail((prev) => ({ ...prev }))
    }
    setProcName(''); setProcDuration('30'); setProcPrice(''); setProcColor(PROC_COLORS[0])
    toast.success('Serviço adicionado')
  }

  function handleStep2() {
    if (procedures.length === 0) { toast.error('Adicione pelo menos um serviço'); return }
    setStep(3)
  }

  // ── Step 3 ──────────────────────────────────────────────
  async function handleAddProf(e: React.FormEvent) {
    e.preventDefault()
    if (!profName.trim()) return
    setAddingProf(true)
    const r = await saveProfessional({ name: profName, specialty: profSpecialty || undefined, color: profColor })
    setAddingProf(false)
    if (r?.error) { toast.error(r.error); return }
    if (r.professional) {
      const prof = r.professional as Professional
      setProfessionals((p) => [...p, prof])
      setLinks((prev) => ({ ...prev, [prof.id]: new Set() }))
      setAvail((prev) => ({ ...prev, [prof.id]: DAYS.map((d) => ({ day_of_week: d.value, start_time: '08:00', end_time: '18:00', enabled: false })) }))
    }
    setProfName(''); setProfSpecialty(''); setProfColor(PROF_COLORS[0])
    toast.success('Profissional adicionado')
  }

  function handleStep3() {
    if (professionals.length === 0) { toast.error('Adicione pelo menos um profissional'); return }
    setStep(4)
  }

  // ── Step 4 ──────────────────────────────────────────────
  function toggleLink(profId: string, procId: string) {
    setLinks((prev) => {
      const set = new Set(prev[profId] ?? [])
      if (set.has(procId)) set.delete(procId); else set.add(procId)
      return { ...prev, [profId]: set }
    })
  }

  async function handleStep4() {
    const unlinked = professionals.filter((p) => !(links[p.id]?.size > 0))
    if (unlinked.length > 0) { toast.error(`${unlinked[0].name} não tem serviços vinculados`); return }
    setLoading(true)
    for (const prof of professionals) {
      const r = await saveProfessionalProcedures(prof.id, Array.from(links[prof.id] ?? []))
      if (r?.error) { toast.error(r.error); setLoading(false); return }
    }
    setLoading(false)
    setStep(5)
  }

  // ── Step 5 ──────────────────────────────────────────────
  function toggleDay(profId: string, dayIdx: number) {
    setAvail((prev) => {
      const slots = [...(prev[profId] ?? [])]
      slots[dayIdx] = { ...slots[dayIdx], enabled: !slots[dayIdx].enabled }
      return { ...prev, [profId]: slots }
    })
  }

  function updateSlotTime(profId: string, dayIdx: number, field: 'start_time' | 'end_time', value: string) {
    setAvail((prev) => {
      const slots = [...(prev[profId] ?? [])]
      slots[dayIdx] = { ...slots[dayIdx], [field]: value }
      return { ...prev, [profId]: slots }
    })
  }

  async function handleStep5() {
    for (const prof of professionals) {
      const slots = avail[prof.id] ?? []
      const enabled = slots.filter((s) => s.enabled)
      if (enabled.length === 0) { toast.error(`Configure a disponibilidade de ${prof.name}`); return }
    }
    setLoading(true)
    for (const prof of professionals) {
      const slots = (avail[prof.id] ?? []).filter((s) => s.enabled).map(({ day_of_week, start_time, end_time }) => ({ day_of_week, start_time, end_time }))
      const r = await saveProfessionalAvailability(prof.id, slots)
      if (r?.error) { toast.error(r.error); setLoading(false); return }
    }
    setLoading(false)
    setStep(6)
  }

  // ── Render ──────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
          <Stethoscope className="h-4 w-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">Configuração da Clínica</p>
          <p className="text-xs text-gray-400">Passo {step} de {STEPS.length}</p>
        </div>
        <div className="ml-auto">
          <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard')} className="text-gray-400 hover:text-gray-700 text-xs">
            Fazer depois
          </Button>
        </div>
      </div>

      {/* Progress */}
      <div className="bg-white border-b border-gray-100 px-6 py-3">
        <div className="flex items-center gap-2 max-w-3xl mx-auto">
          {STEPS.map((s, i) => {
            const done = step > s.id
            const active = step === s.id
            return (
              <div key={s.id} className="flex items-center gap-2 flex-1">
                <div className={cn('flex items-center gap-1.5 text-xs font-medium transition-colors',
                  done ? 'text-emerald-600' : active ? 'text-blue-600' : 'text-gray-300')}>
                  {done
                    ? <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                    : <Circle className={cn('h-4 w-4 flex-shrink-0', active ? 'fill-blue-100 stroke-blue-600' : '')} />
                  }
                  <span className="hidden sm:block">{s.label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={cn('flex-1 h-0.5 rounded', done ? 'bg-emerald-200' : 'bg-gray-100')} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-start justify-center px-6 py-8">
        <div className="w-full max-w-2xl">

          {/* ── STEP 1: Clinic ── */}
          {step === 1 && (
            <Card className="border-gray-200 bg-white shadow-sm">
              <CardHeader className="border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center">
                    <Building2 className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-gray-900">Dados da Clínica</CardTitle>
                    <CardDescription className="text-gray-400">Informações de contato da clínica</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-gray-700 text-sm">Nome da clínica <span className="text-red-500">*</span></Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input value={clinicName} onChange={(e) => setClinicName(e.target.value)} placeholder="Clínica Odonto Silva"
                      className="pl-9 bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 focus-visible:ring-blue-500" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-gray-700 text-sm">Telefone / WhatsApp</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input value={clinicPhone} onChange={(e) => setClinicPhone(e.target.value)} placeholder="(11) 99999-9999"
                        className="pl-9 bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 focus-visible:ring-blue-500" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-gray-700 text-sm">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input type="email" value={clinicEmail} onChange={(e) => setClinicEmail(e.target.value)} placeholder="contato@clinica.com"
                        className="pl-9 bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 focus-visible:ring-blue-500" />
                    </div>
                  </div>
                </div>
                {!clinicPhone.trim() && !clinicEmail.trim() && (
                  <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    Informe pelo menos telefone ou e-mail para o bot conseguir identificar sua clínica.
                  </p>
                )}
                <div className="flex justify-end pt-2">
                  <Button onClick={handleStep1} disabled={loading || !clinicName.trim() || (!clinicPhone.trim() && !clinicEmail.trim())} className="bg-blue-600 hover:bg-blue-700 shadow-sm">
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Próximo →
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── STEP 2: Procedures ── */}
          {step === 2 && (
            <Card className="border-gray-200 bg-white shadow-sm">
              <CardHeader className="border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-emerald-50 flex items-center justify-center">
                    <Stethoscope className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div>
                    <CardTitle className="text-gray-900">Serviços Oferecidos</CardTitle>
                    <CardDescription className="text-gray-400">Cadastre os procedimentos e tratamentos da clínica</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                {/* Existing procedures */}
                {procedures.length > 0 && (
                  <div className="space-y-2">
                    {procedures.map((p) => (
                      <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-200">
                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">{p.name}</p>
                          <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1 text-xs text-gray-400"><Clock className="h-3 w-3" />{p.duration_minutes}min</span>
                            {p.price != null && <span className="flex items-center gap-1 text-xs text-gray-400"><DollarSign className="h-3 w-3" />R$ {p.price.toFixed(2)}</span>}
                          </div>
                        </div>
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      </div>
                    ))}
                  </div>
                )}

                {/* Add form */}
                <form onSubmit={handleAddProc} className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 space-y-3">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Adicionar serviço</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5 col-span-1">
                      <Label className="text-gray-700 text-xs">Nome <span className="text-red-500">*</span></Label>
                      <Input value={procName} onChange={(e) => setProcName(e.target.value)} placeholder="Limpeza"
                        className="bg-white border-gray-200 text-gray-900 h-8 text-sm focus-visible:ring-blue-500" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-gray-700 text-xs">Duração (min) <span className="text-red-500">*</span></Label>
                      <Input type="number" min="5" max="480" step="5" value={procDuration} onChange={(e) => setProcDuration(e.target.value)}
                        className="bg-white border-gray-200 text-gray-900 h-8 text-sm focus-visible:ring-blue-500" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-gray-700 text-xs">Preço (R$)</Label>
                      <Input type="number" min="0" step="0.01" value={procPrice} onChange={(e) => setProcPrice(e.target.value)} placeholder="0,00"
                        className="bg-white border-gray-200 text-gray-900 h-8 text-sm focus-visible:ring-blue-500" />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1.5">
                      {PROC_COLORS.map((c) => (
                        <button key={c} type="button" onClick={() => setProcColor(c)}
                          className="w-5 h-5 rounded-full transition-transform hover:scale-110"
                          style={{ backgroundColor: c, outline: procColor === c ? `2px solid ${c}` : 'none', outlineOffset: '2px' }} />
                      ))}
                    </div>
                    <Button type="submit" size="sm" disabled={addingProc || !procName.trim()} className="ml-auto bg-emerald-600 hover:bg-emerald-700 gap-1.5 shadow-sm">
                      {addingProc ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                      Adicionar
                    </Button>
                  </div>
                </form>

                <div className="flex justify-between pt-2">
                  <Button variant="outline" onClick={() => setStep(1)} className="border-gray-200 text-gray-600 hover:bg-gray-50">← Voltar</Button>
                  <Button onClick={handleStep2} disabled={procedures.length === 0} className="bg-blue-600 hover:bg-blue-700 shadow-sm">
                    Próximo → <span className="ml-1 text-blue-200 text-xs">({procedures.length} serviço{procedures.length !== 1 ? 's' : ''})</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── STEP 3: Professionals ── */}
          {step === 3 && (
            <Card className="border-gray-200 bg-white shadow-sm">
              <CardHeader className="border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center">
                    <User className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-gray-900">Profissionais</CardTitle>
                    <CardDescription className="text-gray-400">Dentistas e especialistas que atendem na clínica</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                {professionals.length > 0 && (
                  <div className="space-y-2">
                    {professionals.map((p) => (
                      <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-200">
                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{p.name}</p>
                          {p.specialty && <p className="text-xs text-gray-400">{p.specialty}</p>}
                        </div>
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      </div>
                    ))}
                  </div>
                )}

                <form onSubmit={handleAddProf} className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 space-y-3">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Adicionar profissional</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-gray-700 text-xs">Nome <span className="text-red-500">*</span></Label>
                      <Input value={profName} onChange={(e) => setProfName(e.target.value)} placeholder="Dr. Silva"
                        className="bg-white border-gray-200 text-gray-900 h-8 text-sm focus-visible:ring-blue-500" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-gray-700 text-xs">Especialidade</Label>
                      <Input value={profSpecialty} onChange={(e) => setProfSpecialty(e.target.value)} placeholder="Ortodontia"
                        className="bg-white border-gray-200 text-gray-900 h-8 text-sm focus-visible:ring-blue-500" />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1.5">
                      {PROF_COLORS.map((c) => (
                        <button key={c} type="button" onClick={() => setProfColor(c)}
                          className="w-5 h-5 rounded-full transition-transform hover:scale-110"
                          style={{ backgroundColor: c, outline: profColor === c ? `2px solid ${c}` : 'none', outlineOffset: '2px' }} />
                      ))}
                    </div>
                    <Button type="submit" size="sm" disabled={addingProf || !profName.trim()} className="ml-auto bg-blue-600 hover:bg-blue-700 gap-1.5 shadow-sm">
                      {addingProf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                      Adicionar
                    </Button>
                  </div>
                </form>

                <div className="flex justify-between pt-2">
                  <Button variant="outline" onClick={() => setStep(2)} className="border-gray-200 text-gray-600 hover:bg-gray-50">← Voltar</Button>
                  <Button onClick={handleStep3} disabled={professionals.length === 0} className="bg-blue-600 hover:bg-blue-700 shadow-sm">
                    Próximo → <span className="ml-1 text-blue-200 text-xs">({professionals.length} profissional{professionals.length !== 1 ? 'is' : ''})</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── STEP 4: Links ── */}
          {step === 4 && (
            <Card className="border-gray-200 bg-white shadow-sm">
              <CardHeader className="border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-violet-50 flex items-center justify-center">
                    <Link2 className="h-4 w-4 text-violet-600" />
                  </div>
                  <div>
                    <CardTitle className="text-gray-900">Serviços por Profissional</CardTitle>
                    <CardDescription className="text-gray-400">Quais serviços cada profissional realiza</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-5">
                {professionals.map((prof) => (
                  <div key={prof.id} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: prof.color }} />
                      <p className="text-sm font-semibold text-gray-900">{prof.name}</p>
                      {prof.specialty && <span className="text-xs text-gray-400">· {prof.specialty}</span>}
                      <Badge variant="outline" className={cn('ml-auto text-xs', (links[prof.id]?.size ?? 0) > 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200')}>
                        {(links[prof.id]?.size ?? 0)} serviço{(links[prof.id]?.size ?? 0) !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pl-4">
                      {procedures.map((proc) => {
                        const checked = links[prof.id]?.has(proc.id) ?? false
                        return (
                          <button key={proc.id} type="button" onClick={() => toggleLink(prof.id, proc.id)}
                            className={cn('flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all text-left',
                              checked ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50')}>
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: proc.color }} />
                            <span className="truncate text-xs">{proc.name}</span>
                            {checked && <CheckCircle2 className="h-3.5 w-3.5 ml-auto flex-shrink-0 text-blue-600" />}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}

                <div className="flex justify-between pt-2">
                  <Button variant="outline" onClick={() => setStep(3)} className="border-gray-200 text-gray-600 hover:bg-gray-50">← Voltar</Button>
                  <Button onClick={handleStep4} disabled={loading} className="bg-blue-600 hover:bg-blue-700 shadow-sm">
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Próximo →
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── STEP 5: Availability ── */}
          {step === 5 && (
            <Card className="border-gray-200 bg-white shadow-sm">
              <CardHeader className="border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-amber-50 flex items-center justify-center">
                    <Calendar className="h-4 w-4 text-amber-600" />
                  </div>
                  <div>
                    <CardTitle className="text-gray-900">Disponibilidade Semanal</CardTitle>
                    <CardDescription className="text-gray-400">Horários de atendimento de cada profissional</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                {professionals.map((prof) => {
                  const slots = avail[prof.id] ?? []
                  return (
                    <div key={prof.id} className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: prof.color }} />
                        <p className="text-sm font-semibold text-gray-900">{prof.name}</p>
                        {prof.specialty && <span className="text-xs text-gray-400">· {prof.specialty}</span>}
                      </div>
                      <div className="space-y-1.5 pl-4">
                        {DAYS.map((day, dayIdx) => {
                          const slot = slots[dayIdx]
                          if (!slot) return null
                          return (
                            <div key={day.value} className={cn('flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors',
                              slot.enabled ? 'border-blue-200 bg-blue-50' : 'border-gray-100 bg-gray-50')}>
                              <button type="button" onClick={() => toggleDay(prof.id, dayIdx)}
                                className={cn('w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors',
                                  slot.enabled ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-300')}>
                                {slot.enabled && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                              </button>
                              <span className={cn('text-sm w-16 flex-shrink-0', slot.enabled ? 'text-blue-700 font-medium' : 'text-gray-400')}>{day.label}</span>
                              {slot.enabled && (
                                <div className="flex items-center gap-2 ml-auto">
                                  <Input type="time" value={slot.start_time} onChange={(e) => updateSlotTime(prof.id, dayIdx, 'start_time', e.target.value)}
                                    className="h-7 w-28 text-xs bg-white border-blue-200 text-gray-900 focus-visible:ring-blue-500" />
                                  <span className="text-gray-400 text-xs">até</span>
                                  <Input type="time" value={slot.end_time} onChange={(e) => updateSlotTime(prof.id, dayIdx, 'end_time', e.target.value)}
                                    className="h-7 w-28 text-xs bg-white border-blue-200 text-gray-900 focus-visible:ring-blue-500" />
                                </div>
                              )}
                              {!slot.enabled && <span className="text-xs text-gray-300 ml-auto">Não atende</span>}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}

                <div className="flex justify-between pt-2">
                  <Button variant="outline" onClick={() => setStep(4)} className="border-gray-200 text-gray-600 hover:bg-gray-50">← Voltar</Button>
                  <Button onClick={handleStep5} disabled={loading} className="bg-blue-600 hover:bg-blue-700 shadow-sm">
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Próximo →
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── STEP 6: WhatsApp ── */}
          {step === 6 && (
            <Card className="border-gray-200 bg-white shadow-sm">
              <CardHeader className="border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-emerald-50 flex items-center justify-center">
                    <Wifi className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div>
                    <CardTitle className="text-gray-900">Conectar WhatsApp</CardTitle>
                    <CardDescription className="text-gray-400">Sua clínica está configurada! Agora conecte o WhatsApp.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                {/* Setup summary */}
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 space-y-2">
                  <p className="text-sm font-semibold text-emerald-800 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Configuração concluída
                  </p>
                  <div className="grid grid-cols-2 gap-1.5 text-xs text-emerald-700">
                    <span>✓ Clínica cadastrada</span>
                    <span>✓ {procedures.length} serviço{procedures.length !== 1 ? 's' : ''} cadastrado{procedures.length !== 1 ? 's' : ''}</span>
                    <span>✓ {professionals.length} profissional{professionals.length !== 1 ? 'is' : ''}</span>
                    <span>✓ Vínculos configurados</span>
                    <span>✓ Disponibilidade configurada</span>
                  </div>
                </div>

                <div className="rounded-xl bg-gray-50 border border-gray-200 p-5 text-center space-y-4">
                  <div className="h-14 w-14 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto">
                    <Wifi className="h-7 w-7 text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">WhatsApp Business</p>
                    <p className="text-sm text-gray-500 mt-1">Configure a integração com Evolution API para ativar o bot de agendamento automático</p>
                  </div>
                  <Button onClick={() => router.push('/settings')} className="bg-emerald-600 hover:bg-emerald-700 gap-2 shadow-sm">
                    <Wifi className="h-4 w-4" />
                    Ir para Configurações → WhatsApp
                  </Button>
                </div>

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setStep(5)} className="border-gray-200 text-gray-600 hover:bg-gray-50">← Voltar</Button>
                  <Button onClick={() => router.push('/dashboard')} className="bg-blue-600 hover:bg-blue-700 shadow-sm">
                    Ir para o Dashboard →
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

        </div>
      </div>
    </div>
  )
}
