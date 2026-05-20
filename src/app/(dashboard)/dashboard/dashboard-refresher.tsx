'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

const INTERVAL_S = 10

export function DashboardRefresher() {
  const router = useRouter()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [sec, setSec] = useState(INTERVAL_S)
  const secRef  = useRef(INTERVAL_S)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function triggerRefresh() {
    setIsRefreshing(true)
    router.refresh()
    secRef.current = INTERVAL_S
    setSec(INTERVAL_S)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setIsRefreshing(false), 900)
  }

  useEffect(() => {
    const id = setInterval(() => {
      secRef.current -= 1
      if (secRef.current <= 0) {
        secRef.current = INTERVAL_S
        setSec(INTERVAL_S)
        setIsRefreshing(true)
        router.refresh()
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => setIsRefreshing(false), 900)
      } else {
        setSec(secRef.current)
      }
    }, 1000)
    return () => clearInterval(id)
  }, [router])

  return (
    <button
      onClick={triggerRefresh}
      title="Clique para atualizar agora"
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-150',
        'border border-gray-200/80 bg-white shadow-sm hover:border-gray-300 hover:shadow active:scale-95',
        isRefreshing ? 'text-blue-600' : 'text-gray-500 hover:text-gray-800',
      )}
    >
      <RefreshCw
        className={cn(
          'h-3 w-3 flex-shrink-0 transition-all',
          isRefreshing ? 'animate-spin text-blue-500' : 'text-gray-400',
        )}
      />
      <span className="tabular-nums">
        {isRefreshing ? 'Atualizando…' : `Ao vivo · ${sec}s`}
      </span>
    </button>
  )
}
