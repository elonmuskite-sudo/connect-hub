import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/solid'
import ChatSidebar from '../components/chat/ChatSidebar'
import { useNavigate } from 'react-router-dom'

export default function Home() {
  const navigate = useNavigate()
  return (
    <>
    <div className="flex md:hidden flex-1 min-h-0 overflow-hidden"><ChatSidebar activeTab="chats" onTabChange={() => navigate('/app')} /></div>
    <div className="hidden md:flex flex-1 items-center justify-center bg-background p-4 md:p-8">
      <div className="w-full max-w-xl text-center chat-enter">
        <div className="mb-6">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
             <ChatBubbleLeftRightIcon className="w-8 h-8 text-primary" />
          </div>
        </div>
        <p className="text-2xl font-semibold text-card-foreground">Your conversations</p>
        <p className="text-sm mt-2 text-muted-foreground">No chat selected</p>
      </div>
    </div>
    </>
  )
}
