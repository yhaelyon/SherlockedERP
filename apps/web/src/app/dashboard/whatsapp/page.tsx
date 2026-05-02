'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ImagePlus, RefreshCw, Send, Wifi, WifiOff } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

type MessageStatus = 'received' | 'read' | 'pending' | 'sent' | 'failed' | 'delivered'

interface CustomerSummary {
  id: string
  first_name: string
  last_name: string | null
  phone: string
}

interface Conversation {
  id: string
  instance_id: string
  remote_jid: string
  phone: string
  customer_id: string | null
  display_name: string | null
  last_message_preview: string | null
  last_message_at: string | null
  unread_count: number
  status: string
  customers?: CustomerSummary | null
}

interface InboxMessage {
  id: string
  conversation_id: string
  external_message_id: string | null
  direction: 'inbound' | 'outbound'
  from_me: boolean
  message_type: 'text' | 'image' | 'unknown'
  body: string | null
  media_url: string | null
  media_mime_type: string | null
  status: MessageStatus
  sent_at: string | null
  received_at: string | null
  created_at: string
}

function apiUrl(path: string): string {
  // The shared inbox uses same-origin Next routes as a production-safe proxy.
  // Railway currently exposes NEXT_PUBLIC_API_URL to browsers, but that API
  // origin is not reliable for authenticated inbox fetches and can fail CORS.
  return `/api${path}`
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const supabase = createClient()
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token

  if (!token) throw new Error('יש להתחבר למערכת')

  const res = await fetch(apiUrl(path), {
    ...init,
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  })

  const payload = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(payload?.error ?? 'שגיאת תקשורת')
  }

  return payload as T
}

function formatTime(value: string | null): string {
  if (!value) return ''
  return new Intl.DateTimeFormat('he-IL', {
    timeZone: 'Asia/Jerusalem',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    hour12: false,
  }).format(new Date(value))
}

function conversationName(conversation: Conversation): string {
  const customer = conversation.customers
  const customerName = customer
    ? [customer.first_name, customer.last_name].filter(Boolean).join(' ').trim()
    : ''

  return conversation.display_name || customerName || conversation.phone
}

export default function WhatsAppInboxPage() {
  const { user, loading, can } = useAuth()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [messages, setMessages] = useState<InboxMessage[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loadingConversations, setLoadingConversations] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedId) ?? null,
    [conversations, selectedId],
  )

  const loadConversations = useCallback(async () => {
    if (!user) return
    setLoadingConversations(true)
    setError(null)
    try {
      const data = await apiFetch<Conversation[]>('/whatsapp/inbox/conversations')
      setConversations(data)
      setSelectedId((current) => current ?? data[0]?.id ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בטעינת שיחות')
    } finally {
      setLoadingConversations(false)
    }
  }, [user])

  const loadMessages = useCallback(async (conversationId: string) => {
    setLoadingMessages(true)
    setError(null)
    try {
      const data = await apiFetch<InboxMessage[]>(`/whatsapp/inbox/conversations/${conversationId}/messages`)
      const sorted = [...data].sort((a, b) => {
        const aTime = new Date(a.received_at ?? a.sent_at ?? a.created_at).getTime()
        const bTime = new Date(b.received_at ?? b.sent_at ?? b.created_at).getTime()
        return aTime - bTime
      })
      setMessages(sorted)
      setConversations((prev) =>
        prev.map((conversation) =>
          conversation.id === conversationId ? { ...conversation, unread_count: 0 } : conversation,
        ),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בטעינת הודעות')
    } finally {
      setLoadingMessages(false)
    }
  }, [])

  useEffect(() => {
    if (!loading && user && can('whatsapp_inbox')) {
      loadConversations()
    }
  }, [can, loadConversations, loading, user])

  useEffect(() => {
    if (selectedId) loadMessages(selectedId)
  }, [loadMessages, selectedId])

  useEffect(() => {
    if (!user || !can('whatsapp_inbox')) return

    const supabase = createClient()
    const channel = supabase
      .channel('whatsapp-inbox')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'whatsapp_inbox_conversations' },
        () => {
          loadConversations()
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'whatsapp_inbox_messages' },
        (payload) => {
          const incoming = payload.new as Partial<InboxMessage>
          // Always reload messages for the open conversation when any message changes
          if (selectedId) loadMessages(selectedId)
          // Also keep the conversation list (preview, unread count) fresh
          if (!incoming.conversation_id || incoming.conversation_id !== selectedId) {
            loadConversations()
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [can, loadConversations, loadMessages, selectedId, user])

  const sendText = async (body: string) => {
    if (!selectedId) return
    setSending(true)
    setError(null)
    try {
      const sent = await apiFetch<InboxMessage>(`/whatsapp/inbox/conversations/${selectedId}/messages/text`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      })
      setMessages((prev) => [...prev, sent])
      await loadConversations()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שליחת הודעה נכשלה')
    } finally {
      setSending(false)
    }
  }

  const sendImage = async (mediaUrl: string, mimeType: string, fileName: string, caption?: string) => {
    if (!selectedId) return
    setSending(true)
    setError(null)
    try {
      const sent = await apiFetch<InboxMessage>(`/whatsapp/inbox/conversations/${selectedId}/messages/image`, {
        method: 'POST',
        body: JSON.stringify({ mediaUrl, mimeType, fileName, caption }),
      })
      setMessages((prev) => [...prev, sent])
      await loadConversations()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שליחת תמונה נכשלה')
    } finally {
      setSending(false)
    }
  }

  if (!loading && (!user || !can('whatsapp_inbox'))) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-center">
        <div>
          <h1 className="text-2xl font-bold text-[#E8EAFF] mb-2">אין הרשאה</h1>
          <p className="text-[#8B8FA8]">הגישה לתיבת הוואטסאפ פתוחה למנהלים ומנהלי משמרת בלבד.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-4rem)] min-h-[640px] flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#E8EAFF]">וואטסאפ</h1>
          <p className="text-sm text-[#8B8FA8] mt-1">תיבת צוות משותפת למספר העסקי</p>
        </div>
        <div className="flex items-center gap-2">
          <ConnectionStatusBadge />
          <button
            onClick={() => {
              loadConversations()
              if (selectedId) loadMessages(selectedId)
            }}
            className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors"
            style={{ background: '#1A1D2A', color: '#8B8FA8', border: '1px solid #2A2D3E' }}
            title="רענון"
          >
            <RefreshCw size={17} className={loadingConversations ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#F87171', border: '1px solid rgba(239,68,68,0.25)' }}>
          {error}
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-[340px_minmax(0,1fr)] overflow-hidden rounded-lg border border-[#2A2D3E] bg-[#11141D] max-lg:grid-cols-1">
        <ConversationList
          conversations={conversations}
          selectedId={selectedId}
          loading={loadingConversations}
          onSelect={setSelectedId}
        />
        <ChatView
          conversation={selectedConversation}
          messages={messages}
          loading={loadingMessages}
          sending={sending}
          onSendText={sendText}
          onSendImage={sendImage}
        />
      </div>
    </div>
  )
}

function ConnectionStatusBadge() {
  const { user } = useAuth()
  const [status, setStatus] = useState<'unknown' | 'connected' | 'disconnected' | 'connecting'>('unknown')

  useEffect(() => {
    if (!user) return
    let cancelled = false

    const loadStatus = () => {
      apiFetch<{ status?: string }>(`/whatsapp/status?_t=${Date.now()}`)
        .then((data) => {
          if (!cancelled) setStatus((data.status as typeof status) ?? 'unknown')
        })
        .catch(() => {
          if (!cancelled) setStatus('unknown')
        })
    }

    loadStatus()
    const interval = window.setInterval(loadStatus, 10000)

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [user])

  const connected = status === 'connected'

  return (
    <span
      className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm"
      style={{
        background: connected ? 'rgba(16,185,129,0.12)' : '#1A1D2A',
        color: connected ? '#10B981' : '#8B8FA8',
        border: `1px solid ${connected ? 'rgba(16,185,129,0.28)' : '#2A2D3E'}`,
      }}
    >
      {connected ? <Wifi size={16} /> : <WifiOff size={16} />}
      {connected ? 'מחובר' : status === 'connecting' ? 'מתחבר' : 'מנותק'}
    </span>
  )
}

function ConversationList({
  conversations,
  selectedId,
  loading,
  onSelect,
}: {
  conversations: Conversation[]
  selectedId: string | null
  loading: boolean
  onSelect: (id: string) => void
}) {
  return (
    <aside className="min-h-0 overflow-y-auto border-l border-[#2A2D3E] bg-[#13161F] custom-scrollbar max-lg:h-80 max-lg:border-b max-lg:border-l-0">
      <div className="sticky top-0 z-10 border-b border-[#24283A] bg-[#13161F] px-4 py-3">
        <div className="text-sm font-semibold text-[#E8EAFF]">שיחות</div>
        <div className="text-xs text-[#555870] mt-0.5">{conversations.length} שיחות פעילות</div>
      </div>

      {loading && conversations.length === 0 && (
        <div className="p-4 text-sm text-[#8B8FA8]">טוען שיחות...</div>
      )}

      {!loading && conversations.length === 0 && (
        <div className="p-6 text-center text-sm text-[#8B8FA8]">אין שיחות עדיין</div>
      )}

      {conversations.map((conversation) => {
        const active = conversation.id === selectedId
        return (
          <button
            key={conversation.id}
            onClick={() => onSelect(conversation.id)}
            className="w-full border-b border-[#1E2035] px-4 py-3 text-right transition-colors"
            style={{ background: active ? '#202437' : 'transparent' }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-[#E8EAFF]">{conversationName(conversation)}</div>
                <div className="mt-1 truncate text-xs text-[#8B8FA8]" dir="auto">
                  {conversation.last_message_preview ?? conversation.phone}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className="whitespace-nowrap text-[11px] text-[#555870]">{formatTime(conversation.last_message_at)}</span>
                {conversation.unread_count > 0 && (
                  <span className="min-w-5 rounded-full bg-[#00C4AA] px-1.5 py-0.5 text-center text-[11px] font-bold text-[#0F1117]">
                    {conversation.unread_count}
                  </span>
                )}
              </div>
            </div>
          </button>
        )
      })}
    </aside>
  )
}

function ChatView({
  conversation,
  messages,
  loading,
  sending,
  onSendText,
  onSendImage,
}: {
  conversation: Conversation | null
  messages: InboxMessage[]
  loading: boolean
  sending: boolean
  onSendText: (body: string) => Promise<void>
  onSendImage: (mediaUrl: string, mimeType: string, fileName: string, caption?: string) => Promise<void>
}) {
  const bottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length, conversation?.id])

  if (!conversation) {
    return (
      <section className="flex min-h-0 items-center justify-center bg-[#0F1117]">
        <div className="text-center text-[#8B8FA8]">בחרו שיחה מהרשימה</div>
      </section>
    )
  }

  return (
    <section className="flex min-h-0 flex-col bg-[#0F1117]">
      <header className="flex items-center justify-between border-b border-[#24283A] bg-[#13161F] px-5 py-4">
        <div className="min-w-0">
          <div className="truncate text-base font-bold text-[#E8EAFF]">{conversationName(conversation)}</div>
          <div className="text-xs text-[#8B8FA8]" dir="ltr">{conversation.phone}</div>
        </div>
        <span className="rounded-full px-2.5 py-1 text-xs text-[#00C4AA]" style={{ background: 'rgba(0,196,170,0.1)' }}>
          {conversation.status === 'closed' ? 'סגור' : 'פתוח'}
        </span>
      </header>

      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {loading && <div className="py-4 text-center text-sm text-[#8B8FA8]">טוען הודעות...</div>}
        {!loading && messages.length === 0 && (
          <div className="py-10 text-center text-sm text-[#8B8FA8]">אין הודעות בשיחה הזו</div>
        )}
        <div className="flex flex-col gap-3">
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
        </div>
        <div ref={bottomRef} />
      </div>

      <MessageComposer sending={sending} onSendText={onSendText} onSendImage={onSendImage} />
    </section>
  )
}

function MessageBubble({ message }: { message: InboxMessage }) {
  const outbound = message.direction === 'outbound'
  const timestamp = message.received_at ?? message.sent_at ?? message.created_at

  return (
    <div className={`flex ${outbound ? 'justify-start' : 'justify-end'}`}>
      <div
        className="max-w-[72%] rounded-lg px-3 py-2 text-sm shadow-sm"
        style={{
          background: outbound ? '#00C4AA' : '#1D2232',
          color: outbound ? '#07110F' : '#E8EAFF',
          borderTopLeftRadius: outbound ? 4 : 8,
          borderTopRightRadius: outbound ? 8 : 4,
        }}
      >
        {message.message_type === 'image' && message.media_url && (
          <img
            src={message.media_url}
            alt=""
            className="mb-2 max-h-72 w-full rounded-md object-cover"
          />
        )}
        {message.body && <div className="whitespace-pre-wrap break-words" dir="auto">{message.body}</div>}
        <div className="mt-1 flex items-center justify-end gap-2 text-[11px] opacity-70">
          {outbound && <span>{message.status === 'failed' ? 'נכשל' : message.status === 'pending' ? 'ממתין' : 'נשלח'}</span>}
          <span>{formatTime(timestamp)}</span>
        </div>
      </div>
    </div>
  )
}

function MessageComposer({
  sending,
  onSendText,
  onSendImage,
}: {
  sending: boolean
  onSendText: (body: string) => Promise<void>
  onSendImage: (mediaUrl: string, mimeType: string, fileName: string, caption?: string) => Promise<void>
}) {
  const [draft, setDraft] = useState('')

  const submit = async () => {
    const body = draft.trim()
    if (!body || sending) return
    setDraft('')
    await onSendText(body)
  }

  const sendImage = async (mediaUrl: string, mimeType: string, fileName: string) => {
    const caption = draft.trim()
    setDraft('')
    await onSendImage(mediaUrl, mimeType, fileName, caption || undefined)
  }

  return (
    <footer className="border-t border-[#24283A] bg-[#13161F] p-4">
      <div className="flex items-end gap-2">
        <button
          onClick={submit}
          disabled={sending || !draft.trim()}
          className="h-11 w-11 flex-shrink-0 rounded-lg flex items-center justify-center transition-opacity disabled:opacity-40"
          style={{ background: '#00C4AA', color: '#07110F' }}
          title="שליחה"
        >
          <Send size={18} />
        </button>
        <ImageUploadButton disabled={sending} onImage={sendImage} />
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              submit()
            }
          }}
          rows={1}
          placeholder="כתיבת הודעה"
          className="max-h-32 min-h-11 flex-1 resize-none rounded-lg border border-[#2A2D3E] bg-[#0F1117] px-4 py-3 text-sm text-[#E8EAFF] outline-none placeholder:text-[#555870] focus:border-[#00C4AA]"
        />
      </div>
    </footer>
  )
}

function ImageUploadButton({
  disabled,
  onImage,
}: {
  disabled: boolean
  onImage: (mediaUrl: string, mimeType: string, fileName: string) => Promise<void>
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) return
    if (file.size > 4 * 1024 * 1024) {
      window.alert('התמונה גדולה מדי. ניתן לשלוח עד 4MB ב-MVP.')
      return
    }

    const mediaUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(new Error('Image read failed'))
      reader.readAsDataURL(file)
    })

    await onImage(mediaUrl, file.type, file.name)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className="h-11 w-11 flex-shrink-0 rounded-lg flex items-center justify-center transition-opacity disabled:opacity-40"
        style={{ background: '#1A1D2A', color: '#8B8FA8', border: '1px solid #2A2D3E' }}
        title="שליחת תמונה"
      >
        <ImagePlus size={18} />
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) handleFile(file)
        }}
      />
    </>
  )
}
