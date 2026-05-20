import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  const { data: membership } = await supabase
    .from('company_members')
    .select('companies(name)')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!membership) redirect('/onboarding')

  const companyName = (membership.companies as unknown as { name: string } | null)?.name ?? 'Minha Clínica'
  const userName = profile?.full_name ?? user.email?.split('@')[0] ?? 'Usuário'
  const userRole = membership.role as string

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar
        companyName={companyName}
        userName={userName}
        userEmail={user.email ?? ''}
        userRole={userRole}
      />
      <main className="flex-1 overflow-y-auto bg-gray-50">
        {children}
      </main>
    </div>
  )
}
