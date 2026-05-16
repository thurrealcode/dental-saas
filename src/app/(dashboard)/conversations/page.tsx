import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { MessageSquare, Search, Phone, Camera, Mail, Globe, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

const channelMap = {
  whatsapp: { label: 'WhatsApp', icon: Phone, class: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  email: { label: 'Email', icon: Mail, class: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  sms: { label: 'SMS', icon: MessageSquare, class: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  webchat: { label: 'Web Chat', icon: Globe, class: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
  instagram: { label: 'Instagram', icon: Camera, class: 'text-pink-400 bg-pink-500/10 border-pink-500/20' },
}

export default async function ConversationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user!.id)
    .eq('is_active', true)
    .single()

  if (!membership) return null

  const { data: conversations } = await supabase
    .from('conversations')
    .select('*')
    .eq('company_id', membership.company_id)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(30)

  return (
    <div className="flex h-full">
      {/* Conversations list */}
      <div className="w-80 border-r border-slate-800 flex flex-col bg-slate-950">
        <div className="p-4 border-b border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold text-white">Conversas</h1>
            <Button size="icon" className="h-7 w-7 bg-blue-600 hover:bg-blue-700">
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
            <Input placeholder="Buscar..." className="pl-8 h-8 bg-slate-800 border-slate-700 text-white text-sm placeholder:text-slate-500" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {conversations && conversations.length > 0 ? (
            conversations.map((conv, index) => {
              const channel = channelMap[conv.channel]
              const ChannelIcon = channel.icon
              const time = conv.last_message_at
                ? new Date(conv.last_message_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                : ''

              return (
                <div
                  key={conv.id}
                  className={cn(
                    'flex items-start gap-3 px-4 py-3 cursor-pointer border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors',
                    index === 0 && 'bg-slate-800/60'
                  )}
                >
                  <div className="h-9 w-9 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0 text-sm font-bold text-white">
                    {(conv.contact_name ?? '?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-sm font-medium text-white truncate">{conv.contact_name ?? conv.contact_phone ?? 'Contato'}</p>
                      <span className="text-[11px] text-slate-500 flex-shrink-0">{time}</span>
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-0.5">{conv.last_message_preview ?? 'Nenhuma mensagem'}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Badge variant="outline" className={cn('text-[10px] px-1 py-0 h-4 gap-0.5', channel.class)}>
                        <ChannelIcon className="h-2.5 w-2.5" />
                        {channel.label}
                      </Badge>
                      {conv.unread_count > 0 && (
                        <Badge className="h-4 min-w-[16px] px-1 text-[10px] bg-blue-600 border-0 text-white">
                          {conv.unread_count}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          ) : (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <MessageSquare className="h-10 w-10 text-slate-700" />
              <p className="text-slate-500 text-sm">Nenhuma conversa</p>
            </div>
          )}
        </div>
      </div>

      {/* Empty state / Chat area */}
      <div className="flex-1 flex items-center justify-center bg-slate-950">
        <div className="text-center space-y-3">
          <div className="h-16 w-16 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto">
            <MessageSquare className="h-8 w-8 text-slate-600" />
          </div>
          <p className="text-slate-400 font-medium">Selecione uma conversa</p>
          <p className="text-slate-600 text-sm">Escolha uma conversa na lista para visualizar as mensagens</p>
        </div>
      </div>
    </div>
  )
}
