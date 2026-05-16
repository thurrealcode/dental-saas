import { createClient } from '@/lib/supabase/server'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MessageSquare, Search, Phone, Mail, Globe, Camera, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

const channelMap = {
  whatsapp:  { label: 'WhatsApp', icon: Phone,    class: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  email:     { label: 'Email',    icon: Mail,     class: 'bg-blue-50 text-blue-700 border-blue-200' },
  sms:       { label: 'SMS',      icon: MessageSquare, class: 'bg-amber-50 text-amber-700 border-amber-200' },
  webchat:   { label: 'Web Chat', icon: Globe,    class: 'bg-violet-50 text-violet-700 border-violet-200' },
  instagram: { label: 'Instagram',icon: Camera,   class: 'bg-pink-50 text-pink-700 border-pink-200' },
}

export default async function ConversationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: membership } = await supabase
    .from('company_members').select('company_id')
    .eq('user_id', user!.id).eq('is_active', true).single()

  if (!membership) return null

  const { data: conversations } = await supabase
    .from('conversations').select('*')
    .eq('company_id', membership.company_id)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(30)

  return (
    <div className="flex h-full">
      {/* Sidebar list */}
      <div className="w-80 border-r border-gray-200 flex flex-col bg-white">
        <div className="p-4 border-b border-gray-100 space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="text-base font-semibold text-gray-900">Conversas</h1>
            <Button size="icon" className="h-7 w-7 bg-blue-600 hover:bg-blue-700 shadow-sm">
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <Input placeholder="Buscar..." className="pl-8 h-8 bg-gray-50 border-gray-200 text-gray-900 text-sm placeholder:text-gray-400 focus-visible:ring-blue-500" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {conversations && conversations.length > 0 ? (
            conversations.map((conv, index) => {
              const channel = channelMap[conv.channel as keyof typeof channelMap] ?? channelMap.whatsapp
              const ChannelIcon = channel.icon
              const time = conv.last_message_at
                ? new Date(conv.last_message_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                : ''

              return (
                <div key={conv.id} className={cn(
                  'flex items-start gap-3 px-4 py-3 cursor-pointer border-b border-gray-50 hover:bg-gray-50 transition-colors',
                  index === 0 && 'bg-blue-50/50'
                )}>
                  <div className="h-9 w-9 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 text-sm font-semibold text-gray-600">
                    {(conv.contact_name ?? '?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{conv.contact_name ?? conv.contact_phone ?? 'Contato'}</p>
                      <span className="text-[11px] text-gray-400 flex-shrink-0">{time}</span>
                    </div>
                    <p className="text-xs text-gray-400 truncate mt-0.5">{conv.last_message_preview ?? 'Nenhuma mensagem'}</p>
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
              <MessageSquare className="h-10 w-10 text-gray-200" />
              <p className="text-gray-400 text-sm">Nenhuma conversa</p>
            </div>
          )}
        </div>
      </div>

      {/* Chat area empty state */}
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-3">
          <div className="h-16 w-16 rounded-2xl bg-white border border-gray-200 shadow-sm flex items-center justify-center mx-auto">
            <MessageSquare className="h-8 w-8 text-gray-300" />
          </div>
          <p className="text-gray-600 font-medium">Selecione uma conversa</p>
          <p className="text-gray-400 text-sm">Escolha uma conversa para ver as mensagens</p>
        </div>
      </div>
    </div>
  )
}
