const PREFIX = 'nexus:v1:'
export const REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '🙏']

export function encodeReply(text, reply) {
  return reply ? PREFIX + JSON.stringify({ kind: 'reply', text, reply: { id: reply.id, preview: reply.content.slice(0, 160) } }) : text
}

export function decodeContent(content) {
  if (typeof content !== 'string' || !content.startsWith(PREFIX)) return { text: content || '' }
  try {
    const value = JSON.parse(content.slice(PREFIX.length))
    if (value.kind === 'reply' && typeof value.text === 'string' && typeof value.reply?.id === 'string') return { text: value.text, reply: value.reply }
  } catch { /* Legacy text remains readable. */ }
  return { text: content }
}

export function reactionContent(messageId, emoji, active) {
  if (!messageId || !REACTIONS.includes(emoji)) throw new Error('Choose a valid message reaction.')
  return JSON.stringify({ messageId, emoji, active: Boolean(active) })
}

export function resolveMessages(messages) {
  const reactions = new Map()
  const ordered = [...messages].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)) || String(a.id).localeCompare(String(b.id)))
  for (const message of ordered) {
    if (message.type !== 'reaction') continue
    try {
      const event = JSON.parse(message.content)
      if (!REACTIONS.includes(event.emoji) || typeof event.messageId !== 'string' || typeof event.active !== 'boolean') continue
      const key = `${event.messageId}:${message.sender_id}:${event.emoji}`
      reactions.set(key, { ...event, userId: String(message.sender_id) })
    } catch { /* Ignore malformed reaction events. */ }
  }
  return ordered.filter(message => message.type !== 'reaction').map(message => ({
    ...message,
    reactions: [...reactions.values()].filter(event => event.messageId === message.id && event.active),
  }))
}