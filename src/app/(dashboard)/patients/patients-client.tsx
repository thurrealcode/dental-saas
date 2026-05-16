'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Plus, Search, Phone, Mail, UserCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PatientModal } from './patient-modal'

const statusMap = {
  active:   { label: 'Ativo',    class: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  inactive: { label: 'Inativo',  class: 'bg-gray-100 text-gray-500 border-gray-200' },
  lead:     { label: 'Lead',     class: 'bg-blue-50 text-blue-700 border-blue-200' },
}

interface Patient {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  status: 'active' | 'inactive' | 'lead'
  created_at: string
}

interface PatientsClientProps {
  initialPatients: Patient[]
  totalCount: number
}

export function PatientsClient({ initialPatients }: PatientsClientProps) {
  const [patients, setPatients] = useState(initialPatients)
  const [query, setQuery] = useState('')
  const [modalOpen, setModalOpen] = useState(false)

  const filtered = useMemo(() => {
    if (!query.trim()) return patients
    const q = query.toLowerCase()
    return patients.filter(
      (p) => p.full_name.toLowerCase().includes(q) || p.phone?.includes(q) || p.email?.toLowerCase().includes(q)
    )
  }, [patients, query])

  function handleCreated(patient: { id: string; full_name: string; phone: string | null; email: string | null; status: string }) {
    setPatients((prev) => [{ ...patient, status: patient.status as Patient['status'], created_at: new Date().toISOString() }, ...prev])
  }

  return (
    <>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Pacientes</h1>
            <p className="text-gray-500 text-sm mt-1">{patients.length} paciente{patients.length !== 1 ? 's' : ''} cadastrado{patients.length !== 1 ? 's' : ''}</p>
          </div>
          <Button onClick={() => setModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 gap-2 shadow-sm">
            <Plus className="h-4 w-4" />
            Novo Paciente
          </Button>
        </div>

        <Card className="border-gray-200 bg-white shadow-sm">
          <CardHeader className="pb-4 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nome, email ou telefone..."
                className="pl-9 bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 focus-visible:ring-blue-500"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {filtered.length > 0 ? (
              <div className="divide-y divide-gray-50">
                {filtered.map((patient) => {
                  const status = statusMap[patient.status] ?? statusMap.active
                  const initials = patient.full_name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
                  return (
                    <div key={patient.id} className="flex items-center justify-between px-6 py-3.5 hover:bg-gray-50 transition-colors cursor-pointer group">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-semibold text-sm flex-shrink-0">
                          {initials}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{patient.full_name}</p>
                          <div className="flex items-center gap-3 mt-0.5">
                            {patient.phone && (
                              <span className="flex items-center gap-1 text-xs text-gray-400">
                                <Phone className="h-3 w-3" />{patient.phone}
                              </span>
                            )}
                            {patient.email && (
                              <span className="flex items-center gap-1 text-xs text-gray-400">
                                <Mail className="h-3 w-3" />{patient.email}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-300 hidden group-hover:block">
                          {new Date(patient.created_at).toLocaleDateString('pt-BR')}
                        </span>
                        <Badge variant="outline" className={cn('text-xs', status.class)}>
                          {status.label}
                        </Badge>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : query ? (
              <div className="flex flex-col items-center justify-center py-14 gap-2">
                <Search className="h-10 w-10 text-gray-200" />
                <p className="text-gray-400 text-sm">Nenhum resultado para &quot;{query}&quot;</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <UserCircle2 className="h-12 w-12 text-gray-200" />
                <p className="text-gray-400 text-sm">Nenhum paciente cadastrado ainda</p>
                <Button size="sm" onClick={() => setModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 gap-2">
                  <Plus className="h-4 w-4" />
                  Cadastrar primeiro paciente
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <PatientModal open={modalOpen} onClose={() => setModalOpen(false)} onCreated={handleCreated} />
    </>
  )
}
