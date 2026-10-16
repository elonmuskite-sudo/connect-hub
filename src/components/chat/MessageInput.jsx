/* eslint-disable react/prop-types */
import { useState, useRef, useEffect } from 'react'
import { Smile, Paperclip, Mic, Send, Square, X, LoaderCircle, Reply } from 'lucide-react'
import StickerPicker from './StickerPicker'
import ChatButton from './ChatButton'
import { uploadChatFile } from '../../lib/storageManager'
import { useAuth } from '../../lib/AuthContext'

export default function MessageInput({ onSendMessage, reply, onCancelReply, chatId }) {
  const { user } = useAuth()
  const [inputText, setInputText] = useState('')
  const [showStickers, setShowStickers] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)
  const textareaRef = useRef(null)
  const recorderRef = useRef(null)
  const intervalRef = useRef(null)
  const streamRef = useRef(null)
  const startedRef = useRef(0)
  const aliveRef = useRef(true)
  const chunksRef = useRef([])

  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
      if (recorderRef.current) recorderRef.current.onstop = null
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
      streamRef.current?.getTracks().forEach(track => track.stop())
      clearInterval(intervalRef.current)
    }
  }, [])
  useEffect(() => { if (reply) textareaRef.current?.focus() }, [reply])

  const send = async data => {
    if (isSending) return false
    setIsSending(true)
    setError('')
    try { return await onSendMessage(data) }
    catch (err) { setError(err.message || 'Message could not be sent.'); return false }
    finally { if (aliveRef.current) setIsSending(false) }
  }
  const submit = async event => {
    event.preventDefault()
    if (!inputText.trim() || isSending) return
    if (await send({ content: inputText.trim(), type: 'text' })) setInputText('')
  }
  const selectFile = async event => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || isSending) return
    setIsSending(true)
    setError('')
    try {
      const uploaded = await uploadChatFile({ userId: user?.id, chatId, file })
      await send({
        content: uploaded.fileName,
        type: uploaded.fileType === 'sticker' ? 'image' : uploaded.fileType,
        file_url: uploaded.fileUrl,
        file_name: uploaded.fileName,
        duration: uploaded.durationSeconds,
      })
    } catch (err) {
      setError(err.message || 'The file could not be sent.')
    } finally {
      if (aliveRef.current) setIsSending(false)
    }
  }
  const startRecording = async () => {
    setError('')
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Voice recording is not supported in this browser.'); return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (!aliveRef.current) { stream.getTracks().forEach(track => track.stop()); return }
      streamRef.current = stream
      const recorder = new MediaRecorder(stream)
      recorderRef.current = recorder
      recorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop())
        clearInterval(intervalRef.current)
        if (!aliveRef.current) return
        setIsRecording(false)
        setRecordingDuration(0)
        try {
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
          chunksRef.current = []
          if (!blob.size) return
          const ext = (recorder.mimeType || 'audio/webm').split('/')[1]?.split(';')[0] || 'webm'
          const file = new File([blob], `voice-note.${ext}`, { type: blob.type })
          const durationSeconds = Math.round((Date.now() - startedRef.current) / 1000)
          const uploaded = await uploadChatFile({ userId: user?.id, chatId, file, kind: 'voice', durationSeconds })
          await send({ content: uploaded.fileName, type: 'voice', file_url: uploaded.fileUrl, file_name: uploaded.fileName, duration: uploaded.durationSeconds })
        } catch (err) {
          if (aliveRef.current) setError(err.message || 'The voice note could not be sent.')
        }
      }
      chunksRef.current = []
      recorder.ondataavailable = e => { if (e.data?.size) chunksRef.current.push(e.data) }
      recorder.start()
      startedRef.current = Date.now()
      setIsRecording(true)
      intervalRef.current = setInterval(() => setRecordingDuration(Math.floor((Date.now() - startedRef.current) / 1000)), 250)
    } catch { setError('Microphone access is required for voice messages.') }
  }
  const stopRecording = () => { if (recorderRef.current?.state === 'recording') recorderRef.current.stop() }

  return <div className="bg-card/95 border-t border-border px-3 sm:px-5 py-3 relative flex-shrink-0 chat-surface">
    {reply && <div className="flex items-center gap-3 border-l-2 border-primary pl-3 pb-2 mb-2 chat-enter"><Reply className="w-4 h-4 text-primary" /><div className="flex-1 min-w-0"><p className="text-xs text-primary font-semibold">Reply</p><p className="text-sm truncate text-muted-foreground">{reply.content}</p></div><ChatButton title="Cancel reply" onClick={onCancelReply} className="w-8"><X className="w-4 h-4" /></ChatButton></div>}
    {showStickers && <StickerPicker onSelect={async sticker => { if (await send({ content: sticker.emoji, type: 'sticker' })) setShowStickers(false) }} onClose={() => setShowStickers(false)} />}
    {error && <div role="alert" className="flex gap-2 items-start text-sm text-destructive mb-2"><p className="flex-1">{error}</p><ChatButton title="Dismiss attachment error" onClick={() => setError('')} className="w-7"><X className="w-4 h-4" /></ChatButton></div>}
    {isRecording ? <div className="flex items-center gap-3"><div className="flex-1 text-destructive flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-destructive motion-safe:animate-pulse" /><span className="text-sm">Recording {recordingDuration}s</span></div><ChatButton title="Stop recording" onClick={stopRecording} className="w-11 h-11 bg-destructive text-destructive-foreground"><Square className="w-5 h-5" /></ChatButton></div> : <form onSubmit={submit} className="flex items-end gap-1 sm:gap-2">
      <ChatButton title="Stickers" disabled={isSending} onClick={() => setShowStickers(!showStickers)} aria-expanded={showStickers} className={`w-9 h-11 shrink-0 ${showStickers ? 'bg-primary/10 text-primary' : ''}`}><Smile className="w-5 h-5" /></ChatButton>
      <ChatButton title="Attach file" disabled={isSending} onClick={() => fileInputRef.current?.click()} className="w-9 h-11 shrink-0"><Paperclip className="w-5 h-5" /></ChatButton>
      <input ref={fileInputRef} type="file" className="hidden" onChange={selectFile} />
      <textarea ref={textareaRef} rows={1} disabled={isSending} aria-label="Message" maxLength={16000} value={inputText} onChange={e => setInputText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) submit(e) }} placeholder="Message…" className="flex-1 min-w-0 min-h-11 max-h-32 resize-none rounded-lg bg-muted px-3 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
      <ChatButton type={inputText.trim() ? 'submit' : 'button'} variant="primary" title={isSending ? 'Sending message' : inputText.trim() ? 'Send message' : 'Record voice message'} disabled={isSending} onClick={!inputText.trim() ? startRecording : undefined} className="w-11 h-11 shrink-0">{isSending ? <LoaderCircle className="w-5 h-5 animate-spin" /> : inputText.trim() ? <Send className="w-5 h-5" /> : <Mic className="w-5 h-5" />}</ChatButton>
    </form>}
  </div>
}
