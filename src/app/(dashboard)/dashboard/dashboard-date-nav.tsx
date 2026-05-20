'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  selectedDate: string // YYYY-MM-DD
  todayStr: string
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + days)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

export function DashboardDateNav({ selectedDate, todayStr }: Props) {
  const router  = useRouter()
  const isToday = selectedDate === todayStr

  function navigate(days: number) {
    const next = addDays(selectedDate, days)
    router.push(next === todayStr ? '/dashboard' : `/dashboard?date=${next}`)
  }

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => navigate(-1)}
        title="Dia anterior"
        className={cn(
          'h-6 w-6 rounded-md flex items-center justify-center transition-all duration-150',
          'text-gray-400 hover:text-gray-700 hover:bg-gray-100 active:scale-95',
        )}
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </button>

      {!isToday && (
        <button
          onClick={() => router.push('/dashboard')}
          className={cn(
            'h-6 px-2 rounded-md text-[10px] font-semibold transition-all duration-150 active:scale-95',
            'bg-blue-600 text-white hover:bg-blue-700 shadow-sm',
          )}
        >
          Hoje
        </button>
      )}

      <button
        onClick={() => navigate(1)}
        title="Próximo dia"
        className={cn(
          'h-6 w-6 rounded-md flex items-center justify-center transition-all duration-150',
          'text-gray-400 hover:text-gray-700 hover:bg-gray-100 active:scale-95',
        )}
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
