'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { UserPlus } from 'lucide-react'

export function InviteButton() {
  const [showMsg, setShowMsg] = useState(false)

  return (
    <div className="flex items-center gap-2">
      {showMsg && (
        <span className="text-xs text-gray-400 animate-in fade-in duration-200">
          🚧 Em breve
        </span>
      )}
      <Button
        size="sm"
        variant="outline"
        className="border-blue-200 text-blue-700 hover:bg-blue-50 bg-white text-xs shadow-sm gap-1.5"
        onClick={() => {
          setShowMsg(true)
          setTimeout(() => setShowMsg(false), 2500)
        }}
      >
        <UserPlus className="h-3.5 w-3.5" />
        Convidar membro
      </Button>
    </div>
  )
}
