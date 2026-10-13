import { useState, useRef, useCallback, useEffect } from 'react'

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
}

export function useVoiceCall(chatId) {
  const [callState, setCallState] = useState('idle')
  const [callDuration, setCallDuration] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [error, setError] = useState(null)

  const peerConnection = useRef(null)
  const localStream = useRef(null)
  const durationInterval = useRef(null)
  const channelRef = useRef(null)

  const cleanup = useCallback(() => {
    if (durationInterval.current) {
      clearInterval(durationInterval.current)
      durationInterval.current = null
    }
    localStream.current?.getTracks().forEach(track => track.stop())
    localStream.current = null
    peerConnection.current?.close()
    peerConnection.current = null
    setCallDuration(0)
    setIsMuted(false)
    setError(null)
  }, [])

  useEffect(() => {
    if (!chatId) return
    channelRef.current = new BroadcastChannel(`nexus-call-${chatId}`)
    channelRef.current.onmessage = async (event) => {
      const { type, sdp, candidate } = event.data
      if (type === 'offer' && callState === 'idle') {
        await handleIncomingCall(sdp)
      } else if (type === 'answer' && peerConnection.current) {
        await peerConnection.current.setRemoteDescription(sdp)
        setCallState('connected')
        startDurationTimer()
      } else if (type === 'ice-candidate' && peerConnection.current) {
        await peerConnection.current.addIceCandidate(candidate)
      } else if (type === 'hangup') {
        endCall()
      }
    }
    return () => {
      channelRef.current?.close()
      cleanup()
    }
  }, [chatId])

  const startDurationTimer = () => {
    durationInterval.current = setInterval(() => {
      setCallDuration(prev => prev + 1)
    }, 1000)
  }

  const createPeerConnection = async () => {
    if (typeof window === 'undefined' || typeof RTCPeerConnection === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      throw new Error('Voice calls are not supported in this browser')
    }

    const pc = new RTCPeerConnection(ICE_SERVERS)

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        channelRef.current?.postMessage({
          type: 'ice-candidate',
          candidate: event.candidate,
        })
      }
    }

    pc.ontrack = (event) => {
      const audio = document.getElementById('remote-audio')
      if (audio) audio.srcObject = event.streams[0]
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setCallState('connected')
        startDurationTimer()
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        endCall()
      }
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    localStream.current = stream
    stream.getTracks().forEach(track => pc.addTrack(track, stream))

    peerConnection.current = pc
    return pc
  }

  const initiateCall = useCallback(async () => {
    try {
      setCallState('calling')
      setError(null)
      const pc = await createPeerConnection()
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      channelRef.current?.postMessage({ type: 'offer', sdp: offer })
    } catch (err) {
      setError('Microphone access denied or unavailable')
      setCallState('idle')
      cleanup()
    }
  }, [chatId, cleanup])

  const handleIncomingCall = async (offer) => {
    try {
      setCallState('incoming')
      const pc = await createPeerConnection()
      await pc.setRemoteDescription(offer)
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      channelRef.current?.postMessage({ type: 'answer', sdp: answer })
    } catch (err) {
      setError('Failed to answer call')
      endCall()
    }
  }

  const acceptCall = useCallback(async () => {
    if (callState === 'incoming' && peerConnection.current) {
      setCallState('connected')
      startDurationTimer()
    }
  }, [callState])

  const endCall = useCallback(() => {
    channelRef.current?.postMessage({ type: 'hangup' })
    cleanup()
    setCallState('idle')
  }, [cleanup])

  const toggleMute = useCallback(() => {
    if (localStream.current) {
      localStream.current.getAudioTracks().forEach(track => {
        track.enabled = isMuted
      })
      setIsMuted(!isMuted)
    }
  }, [isMuted])

  const formatDuration = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0')
    const s = (seconds % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  return {
    callState,
    callDuration,
    isMuted,
    error,
    initiateCall,
    acceptCall,
    endCall,
    toggleMute,
    formatDuration,
  }
}
