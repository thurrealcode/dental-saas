'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  KanbanSquare,
  MessageSquare,
  Settings,
  Stethoscope,
  ChevronRight,
  Bell,
  LogOut,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { signOut } from '@/lib/supabase/actions'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/patients', label: 'Pacientes', icon: Users },
  { href: '/dashboard/agenda', label: 'Agenda', icon: CalendarDays },
  { href: '/dashboard/pipeline', label: 'Pipeline', icon: KanbanSquare },
  { href: '/dashboard/conversations', label: 'Conversas', icon: MessageSquare, badge: 3 },
  { href: '/dashboard/settings', label: 'Configurações', icon: Settings },
]

interface SidebarProps {
  companyName?: string
  userName?: string
  userEmail?: string
}

export function Sidebar({ companyName = 'Minha Clínica', userName = 'Usuário', userEmail = '' }: SidebarProps) {
  const pathname = usePathname()

  const initials = userName
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-slate-800 bg-slate-950">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-800">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
          <Stethoscope className="h-4 w-4 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white truncate">{companyName}</p>
          <p className="text-[11px] text-slate-500">DentalFlow</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
              )}
            >
              <item.icon className={cn('h-4 w-4 flex-shrink-0', isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-300')} />
              <span className="flex-1">{item.label}</span>
              {item.badge && (
                <Badge className="h-5 min-w-[20px] px-1.5 text-[11px] bg-red-500 text-white border-0">
                  {item.badge}
                </Badge>
              )}
              {isActive && <ChevronRight className="h-3 w-3 text-blue-200" />}
            </Link>
          )
        })}
      </nav>

      {/* Bottom section */}
      <div className="border-t border-slate-800 p-3 space-y-2">
        <button className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-slate-400 hover:bg-slate-800/60 hover:text-white transition-colors">
          <Bell className="h-4 w-4" />
          <span className="text-sm">Notificações</span>
        </button>

        <div className="flex items-center gap-3 px-3 py-2 rounded-lg">
          <Avatar className="h-7 w-7 flex-shrink-0">
            <AvatarFallback className="bg-blue-700 text-white text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{userName}</p>
            <p className="text-[11px] text-slate-500 truncate">{userEmail}</p>
          </div>
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="icon" className="h-7 w-7 text-slate-500 hover:text-white hover:bg-slate-700">
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </form>
        </div>
      </div>
    </aside>
  )
}
