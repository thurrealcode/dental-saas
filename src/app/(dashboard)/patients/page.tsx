import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Plus, Search, Phone, Mail, UserCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const statusMap = {
  active: { label: 'Ativo', class: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  inactive: { label: 'Inativo', class: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
  lead: { label: 'Lead', class: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
}

export default async function PatientsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user!.id)
    .eq('is_active', true)
    .single()

  if (!membership) return null

  const { data: patients, count } = await supabase
    .from('patients')
    .select('*', { count: 'exact' })
    .eq('company_id', membership.company_id)
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Pacientes</h1>
          <p className="text-slate-400 text-sm mt-1">{count ?? 0} pacientes cadastrados</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700 gap-2">
          <Plus className="h-4 w-4" />
          Novo Paciente
        </Button>
      </div>

      <Card className="border-slate-800 bg-slate-900">
        <CardHeader className="pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input
              placeholder="Buscar pacientes por nome, email ou telefone..."
              className="pl-9 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-blue-600"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {patients && patients.length > 0 ? (
            <div className="divide-y divide-slate-800">
              {patients.map((patient) => {
                const status = statusMap[patient.status]
                return (
                  <div key={patient.id} className="flex items-center justify-between px-6 py-4 hover:bg-slate-800/40 transition-colors cursor-pointer">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-400 font-bold text-sm flex-shrink-0">
                        {patient.full_name[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-white text-sm">{patient.full_name}</p>
                        <div className="flex items-center gap-3 mt-0.5">
                          {patient.phone && (
                            <span className="flex items-center gap-1 text-xs text-slate-500">
                              <Phone className="h-3 w-3" />{patient.phone}
                            </span>
                          )}
                          {patient.email && (
                            <span className="flex items-center gap-1 text-xs text-slate-500">
                              <Mail className="h-3 w-3" />{patient.email}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Badge variant="outline" className={cn('text-xs', status.class)}>
                      {status.label}
                    </Badge>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <UserCircle2 className="h-12 w-12 text-slate-700" />
              <p className="text-slate-500 text-sm">Nenhum paciente cadastrado ainda</p>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 gap-2">
                <Plus className="h-4 w-4" />
                Cadastrar primeiro paciente
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
