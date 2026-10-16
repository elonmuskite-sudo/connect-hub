import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { MagnifyingGlassIcon, ChatBubbleLeftRightIcon } from '@heroicons/react/24/solid'
import ChatListItem from './ChatListItem'
import Avatar from './Avatar'
import { useAuth } from '../../lib/AuthContext'
import { mockChats } from '../../data/mockChats'
import { createChat, getChats, searchUserByNexusId, formatNexusId } from '../../lib/persistence'

// eslint-disable-next-line react/prop-types
export default function ChatSidebar({ activeTab, onTabChange }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [chats, setChats] = useState(mockChats)
  const [foundUser, setFoundUser] = useState(null)
  const [isSearching, setIsSearching] = useState(false)
  const [chatError, setChatError] = useState('')
  const { user } = useAuth()
  const navigate = useNavigate()
  const { chatId } = useParams()

  useEffect(() => {
    const refreshChats = async () => {
      const nextChats = await getChats(user?.id)
      setChats(Array.isArray(nextChats) ? nextChats : [])
    }
    refreshChats()
    window.addEventListener('nexus-chat:updated', refreshChats)
    return () => window.removeEventListener('nexus-chat:updated', refreshChats)
  }, [user?.id])

  // Function to detect if the search query is a Nexus number (format: 10-xxxx-xxxx or 10xxxxxxxx)
  const isNexusNumber = (query) => {
    const normalized = query.replace(/\D/g, '')
    return normalized.length >= 10 && normalized.startsWith('10')
  }

  // Handle search input with Nexus number detection
  const handleSearchChange = async (e) => {
    const query = e.target.value
    setSearchQuery(query)
    
    if (isNexusNumber(query)) {
      setIsSearching(true)
      setChatError('')
      try {
        const recipient = await searchUserByNexusId(query)
        setFoundUser(recipient)
      } catch (error) {
        setFoundUser(null)
        setChatError(error?.message || 'Recipient lookup failed.')
      } finally {
        setIsSearching(false)
      }
    } else {
      setFoundUser(null)
    }
  }

  const handleStartChatWithUser = async (recipient) => {
    setChatError('')
    try {
      if (!user?.id || !user.nexusId) throw new Error('Sign in again before starting a conversation.')
      if (!recipient?.id || String(user.id) === String(recipient.id)) throw new Error('Choose a different Nexus member to start a chat.')
      const chats = await getChats(user.id)
      const participantIds = [String(user.id), String(recipient.id)]
      participantIds.sort()
      const existing = chats.find((chat) => {
        const ids = (chat.participant_ids || []).map(String).sort()
        return ids.length === participantIds.length && ids.every((id, index) => id === participantIds[index])
      })
      if (existing) {
        navigate(`/app/chat/${existing.id}`)
      } else {
        const chatTitle = recipient.fullName || `${recipient.firstName} ${recipient.lastName}`.trim() || recipient.nexusIdDisplay
        const newChat = await createChat({
          title: chatTitle,
          type: 'private',
          avatar_url: recipient.avatarUrl || null,
          owner_id: user.id,
          participantIds: [user.id, recipient.id],
        })
        navigate(`/app/chat/${newChat.id}`)
      }
      setSearchQuery('')
      setFoundUser(null)
    } catch (error) {
      setChatError(error?.message || 'Could not start the conversation.')
    }
  }

  const filteredChats = chats.filter(chat =>
    chat.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleChatSelect = (chat) => {
    navigate(`/app/chat/${chat.id}`)
  }

  const showChatList = activeTab === 'chats'

  return (
    <div className={`w-full md:w-96 bg-card border-r border-border flex flex-col ${
      chatId ? 'hidden md:flex' : showChatList ? 'flex' : 'hidden md:flex'
    }`}>
      {showChatList && (
        <>
          <div className="p-4">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search or start new chat"
                value={searchQuery}
                onChange={handleSearchChange}
                className="w-full pl-10 pr-4 py-2 bg-muted border-none rounded-lg text-foreground focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {chatError && <p role="alert" className="mx-4 mb-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{chatError}</p>}
            {/* Show found user when Nexus number is detected */}
            {foundUser && (
              <div className="p-4 border-b border-border bg-primary/5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  User Found
                </p>
                <button
                  onClick={() => handleStartChatWithUser(foundUser)}
                  className="w-full flex items-center gap-3 p-3 bg-card border border-border rounded-lg hover:bg-muted transition duration-200"
                >
                  <Avatar src={foundUser.avatarUrl} alt={foundUser.fullName || 'User'} size="md" />
                  <div className="flex-1 text-left min-w-0">
                    <p className="font-medium text-foreground truncate">
                      {foundUser.fullName || `${foundUser.firstName} ${foundUser.lastName}`.trim()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {foundUser.nexusIdDisplay || formatNexusId(foundUser.nexusId)}
                    </p>
                  </div>
                </button>
                <p className="text-xs text-muted-foreground mt-2">
                  Click to start a chat with this user
                </p>
              </div>
            )}

            {/* Show loading state when searching */}
            {isSearching && isNexusNumber(searchQuery) && (
              <div className="p-4 border-b border-border bg-primary/5">
                <p className="text-sm text-muted-foreground text-center">Searching for user...</p>
              </div>
            )}

            {/* Show "no user found" message */}
            {!isSearching && !foundUser && isNexusNumber(searchQuery) && (
              <div className="p-4 border-b border-border bg-destructive/5">
                <p className="text-sm text-destructive text-center">User not found</p>
                <p className="text-xs text-muted-foreground text-center mt-1">
                  Make sure the Nexus number is correct
                </p>
              </div>
            )}

            {/* Show filtered chats */}
            {filteredChats.length > 0 ? (
              filteredChats.map(chat => (
                <ChatListItem
                  key={chat.id}
                  chat={chat}
                  selected={chatId === chat.id}
                  onClick={() => handleChatSelect(chat)}
                />
              ))
            ) : !foundUser && !isNexusNumber(searchQuery) && (
              <div className="flex flex-col items-center justify-center py-12 px-4">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                  <ChatBubbleLeftRightIcon className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-foreground font-medium text-center">No conversations yet</p>
                <p className="text-sm text-muted-foreground mt-1 text-center">Start a new chat to begin messaging</p>
              </div>
            )}
          </div>
        </>
      )}

      {!showChatList && (
        <div className="flex-1 flex items-center justify-center p-4">
          <button
            onClick={() => { onTabChange('chats'); navigate('/app') }}
            className="text-primary text-sm hover:underline"
          >
            ← Back to Chats
          </button>
        </div>
      )}
    </div>
  )
}
