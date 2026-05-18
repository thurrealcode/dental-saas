'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'

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
  const router = useRouter()
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
        className="h-7 w-7 rounded-lg border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </button>

      {!isToday && (
        <button
          onClick={() => router.push('/dashboard')}
          className="h-7 px-2.5 rounded-lg border border-blue-200 bg-blue-50 text-[11px] font-semibold text-blue-600 hover:bg-blue-100 transition-colors"
        >
          Hoje
        </button>
      )}

      <button
        onClick={() => navigate(1)}
        title="Próximo dia"
        className="h-7 w-7 rounded-lg border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors"
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
