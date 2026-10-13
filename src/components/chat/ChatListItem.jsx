import { memo, useMemo } from 'react'
import Avatar from './Avatar'
import { format } from 'date-fns'
import { Lock } from 'lucide-react'
import ChatButton from './ChatButton'
import { decodeContent } from '../../lib/chatProtocol'
import VerificationBadge from './VerificationBadge'
import { useAuth } from '../../lib/AuthContext'

export function peerIdOf(chat, myId) {
  const ids = (chat?.participant_ids || []).map(String).filter((id) => id !== String(myId || ''))
  return ids.length === 1 ? ids[0] : null
}

function ChatListItem({ chat, selected, onClick }) {
  const { user } = useAuth()
  const peerId = peerIdOf(chat, user?.id)
  const timeLabel = useMemo(() => {
    if (!chat.last_message_time) return null
    try {
      return format(new Date(chat.last_message_time), 'h:mm a')
    } catch {
      return null
    }
  }, [chat.last_message_time])

  return (
    <ChatButton
      onClick={onClick}
      className={`w-full text-left flex items-center !rounded-none !h-auto !justify-start p-4 chat-enter ${
        selected ? 'bg-primary/10 border-l-2 border-primary' : 'border-l-2 border-transparent'
      }`}
    >
      <Avatar src={chat.avatar_url} alt={chat.title} />
      <div className="ml-3 flex-1 min-w-0">
        <div className="flex justify-between items-baseline">
          <div className="flex items-center gap-1 min-w-0">
            <h3 className="text-sm font-semibold text-foreground truncate">
              {chat.title}
            </h3>
            {peerId && <VerificationBadge userId={peerId} className="w-3.5 h-3.5 flex-shrink-0" />}
            {chat.encrypted && (
              <Lock className="w-3 h-3 text-primary flex-shrink-0" />
            )}
          </div>
          {timeLabel && (
            <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">
              {timeLabel}
            </span>
          )}
        </div>
        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground truncate">
            {decodeContent(chat.last_message).text || 'No messages yet'}
          </p>
          {chat.unread_count > 0 && (
            <span className="ml-2 bg-primary text-primary-foreground text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0">
              {chat.unread_count}
            </span>
          )}
        </div>
      </div>
    </ChatButton>
  )
}

export default memo(ChatListItem, (prev, next) => {
  return (
    prev.chat.id === next.chat.id &&
    prev.chat.title === next.chat.title &&
    prev.chat.last_message === next.chat.last_message &&
    prev.chat.last_message_time === next.chat.last_message_time &&
    prev.chat.unread_count === next.chat.unread_count &&
    prev.chat.avatar_url === next.chat.avatar_url &&
    prev.chat.encrypted === next.chat.encrypted &&
    prev.selected === next.selected && prev.onClick === next.onClick
  )
})
