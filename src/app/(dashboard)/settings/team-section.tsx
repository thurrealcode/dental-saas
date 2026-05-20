'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { ShieldCheck, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { changeMemberRole } from './change-role-action'

const ROLE_PT: Record<string, { label: string; cls: string }> = {
  owner:        { label: 'Proprietário',  cls: 'border-amber-200  text-amber-700  bg-amber-50' },
  admin:        { label: 'Administrador', cls: 'border-blue-200   text-blue-700   bg-blue-50' },
  dentist:      { label: 'Profissional',  cls: 'border-emerald-200 text-emerald-700 bg-emerald-50' },
  receptionist: { label: 'Atendente',    cls: 'border-violet-200 text-violet-700 bg-violet-50' },
  viewer:       { label: 'Visualizador', cls: 'border-gray-200   text-gray-500   bg-gray-50' },
}

const ROLE_PERMS: Record<string, string> = {
  owner:        'Acesso total ao sistema',
  admin:        'Acesso total ao sistema',
  dentist:      'Agenda própria · Consultas vinculadas',
  receptionist: 'Dashboard · Agenda · Pacientes · WhatsApp',
  viewer:       'Acesso somente leitura',
}

const ASSIGNABLE_ROLES = [
  { value: 'admin',        label: 'Administrador' },
  { value: 'receptionist', label: 'Atendente' },
  { value: 'dentist',      label: 'Profissional' },
  { value: 'viewer',       label: 'Visualizador' },
]

interface Member {
  id: string
  user_id: string
  role: string
  fullName: string | null
  isCurrentUser: boolean
}

interface TeamSectionProps {
  members: Member[]
  currentUserRole: string
  currentUserId: string
  currentUserEmail: string
}

function RoleSelect({ member, currentUserRole, currentUserId, adminCount }: {
  member: Member
  currentUserRole: string
  currentUserId: string
  adminCount: number
}) {
  const [role, setRole] = useState(member.role)
  const [loading, setLoading] = useState(false)

  const canManage = ['owner', 'admin'].includes(currentUserRole)

  // Can't touch owners unless you're an owner yourself
  const targetIsOwner = member.role === 'owner'
  const iAmOwner = currentUserRole === 'owner'

  // Can't demote yourself if you're the last owner/admin
  const wouldLeaveNoAdmin = member.isCurrentUser && ['owner', 'admin'].includes(role) && adminCount <= 1

  const editable = canManage && (!targetIsOwner || iAmOwner) && !wouldLeaveNoAdmin

  if (!editable || member.role === 'owner') {
    const rp = ROLE_PT[role] ?? { label: role, cls: 'border-gray-200 text-gray-500 bg-gray-50' }
    return <Badge variant="outline" className={`text-xs ${rp.cls}`}>{rp.label}</Badge>
  }

  async function handleChange(newRole: string) {
    if (newRole === role) return
    setLoading(true)
    const result = await changeMemberRole(member.id, newRole)
    setLoading(false)
    if (result.error) {
      toast.error(result.error)
      return
    }
    setRole(newRole)
    toast.success('Função atualizada')
  }

  return (
    <div className="flex items-center gap-2">
      {loading && <Loader2 className="h-3 w-3 animate-spin text-gray-400" />}
      <select
        value={role}
        onChange={(e) => handleChange(e.target.value)}
        disabled={loading}
        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-50 cursor-pointer"
      >
        {ASSIGNABLE_ROLES.map(r => (
          <option key={r.value} value={r.value}>{r.label}</option>
        ))}
      </select>
    </div>
  )
}

export function TeamSection({ members, currentUserRole, currentUserId, currentUserEmail }: TeamSectionProps) {
  const adminCount = members.filter(m => ['owner', 'admin'].includes(m.role)).length

  return (
    <>
      <div className="divide-y divide-gray-50">
        {members.map(member => {
          const displayName = member.isCurrentUser
            ? (member.fullName || currentUserEmail || 'Você')
            : (member.fullName || 'Usuário')
          const subLine = member.isCurrentUser
            ? currentUserEmail
            : (ROLE_PERMS[member.role] ?? '')
          const avatarInitial = displayName[0]?.toUpperCase() ?? '?'

          return (
            <div key={member.id} className="flex items-center justify-between py-3.5">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 text-xs font-bold flex-shrink-0">
                  {avatarInitial}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900">{displayName}</p>
                    {member.isCurrentUser && (
                      <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">Você</span>
                    )}
                  </div>
                  {subLine && (
                    <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{subLine}</p>
                  )}
                </div>
              </div>
              <RoleSelect
                member={member}
                currentUserRole={currentUserRole}
                currentUserId={currentUserId}
                adminCount={adminCount}
              />
            </div>
          )
        })}
      </div>

      <div className="mt-3 mb-4 rounded-xl border border-gray-100 bg-gray-50 p-4">
        <div className="flex items-center gap-1.5 mb-3">
          <ShieldCheck className="h-3.5 w-3.5 text-gray-400" />
          <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Permissões por função</h4>
        </div>
        <div className="space-y-2">
          {[
            { roles: ['Proprietário', 'Administrador'], perms: 'Acesso total ao sistema' },
            { roles: ['Atendente'],   perms: 'Dashboard · Agenda · Pacientes · WhatsApp ao vivo' },
            { roles: ['Profissional'], perms: 'Agenda própria · Consultas vinculadas' },
            { roles: ['Visualizador'], perms: 'Dashboard · leitura' },
          ].map(row => (
            <div key={row.roles[0]} className="flex items-start gap-3">
              <div className="flex gap-1 flex-shrink-0 w-52">
                {row.roles.map((r, i) => (
                  <span key={r} className="text-[11px] font-semibold text-gray-600">
                    {r}{i < row.roles.length - 1 ? ' ·' : ''}
                  </span>
                ))}
              </div>
              <span className="text-[11px] text-gray-400 leading-relaxed">{row.perms}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
