import { Phone, PhoneOff, Mic, MicOff } from 'lucide-react'
import Avatar from './Avatar'

export default function VoiceCallOverlay({ chat, voiceCall }) {
  const { callState, callDuration, isMuted, error, acceptCall, endCall, toggleMute, formatDuration } = voiceCall

  if (callState === 'idle') return null

  return (
    <div className="fixed inset-0 z-50 bg-gray-900/95 flex flex-col items-center justify-center">
      <div className="text-center">
        <Avatar src={chat.avatar_url} alt={chat.title} size="2xl" />
        <h2 className="text-2xl font-semibold text-white mt-6">{chat.title}</h2>

        {callState === 'calling' && (
          <p className="text-gray-400 mt-2 animate-pulse">Calling...</p>
        )}
        {callState === 'incoming' && (
          <p className="text-gray-400 mt-2">Incoming voice call</p>
        )}
        {callState === 'connected' && (
          <p className="text-green-400 mt-2 font-mono text-lg">{formatDuration(callDuration)}</p>
        )}
        {error && (
          <p className="text-red-400 mt-2 text-sm">{error}</p>
        )}
      </div>

      <div className="flex items-center gap-6 mt-12">
        {callState === 'incoming' && (
          <button
            onClick={acceptCall}
            className="p-5 bg-green-600 hover:bg-green-700 rounded-full text-white transition-colors"
          >
            <Phone className="w-7 h-7" />
          </button>
        )}

        {(callState === 'connected' || callState === 'calling') && (
          <button
            onClick={toggleMute}
            className={`p-4 rounded-full transition-colors ${
              isMuted
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-white'
            }`}
          >
            {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </button>
        )}

        <button
          onClick={endCall}
          className="p-5 bg-red-600 hover:bg-red-700 rounded-full text-white transition-colors"
        >
          <PhoneOff className="w-7 h-7" />
        </button>
      </div>
    </div>
  )
}
