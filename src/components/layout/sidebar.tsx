'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  KanbanSquare,
  Settings,
  Stethoscope,
  Bell,
  LogOut,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { signOut } from '@/lib/supabase/actions'

const navItems = [
  { href: '/dashboard',      label: 'Dashboard',     icon: LayoutDashboard },
  { href: '/patients',       label: 'Pacientes',      icon: Users },
  { href: '/agenda',         label: 'Agenda',         icon: CalendarDays },
  { href: '/pipeline',       label: 'Pipeline',       icon: KanbanSquare },
  { href: '/settings',       label: 'Configurações',  icon: Settings },
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
    <aside className="flex h-screen w-60 flex-col border-r border-gray-200 bg-white">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-gray-100">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 shadow-sm">
          <Stethoscope className="h-4 w-4 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{companyName}</p>
          <p className="text-[11px] text-gray-400">DentalFlow</p>
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
                'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )}
            >
              <item.icon className={cn('h-4 w-4 flex-shrink-0', isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600')} />
              <span className="flex-1">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Bottom section */}
      <div className="border-t border-gray-100 p-3 space-y-1">
        <button className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors text-sm">
          <Bell className="h-4 w-4" />
          <span>Notificações</span>
        </button>

        <div className="flex items-center gap-3 px-3 py-2 rounded-lg">
          <Avatar className="h-7 w-7 flex-shrink-0">
            <AvatarFallback className="bg-blue-600 text-white text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{userName}</p>
            <p className="text-[11px] text-gray-400 truncate">{userEmail}</p>
          </div>
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-gray-700 hover:bg-gray-100">
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </form>
        </div>
      </div>
    </aside>
  )
}
