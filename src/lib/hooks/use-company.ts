'use client'

import { createClient } from '@/lib/supabase/client'
import { Tables } from '@/types/database'
import { useEffect, useState } from 'react'

type Company = Tables<'companies'>
type Member = Tables<'company_members'>

interface CompanyContext {
  company: Company | null
  member: Member | null
  isLoading: boolean
}

export function useCompany(): CompanyContext {
  const [company, setCompany] = useState<Company | null>(null)
  const [member, setMember] = useState<Member | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setIsLoading(false); return }

      const { data: memberData } = await supabase
        .from('company_members')
        .select('*, companies(*)')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single()

      if (memberData) {
        setMember(memberData as Member)
        setCompany((memberData as unknown as { companies: Company }).companies)
      }

      setIsLoading(false)
    }

    load()
  }, [])

  return { company, member, isLoading }
}
