import { supabase, isSupabaseConfigured } from './supabase'

export const STORAGE_QUOTA_BYTES = 5 * 1024 * 1024 * 1024 // 5 GB per user
export const MAX_VIDEO_DURATION_SECONDS = 45
const BUCKET = 'chat-files'
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 365

const ALLOWED_MIME_PREFIXES = ['image/', 'video/', 'audio/']
const ALLOWED_EXTRA_MIME = new Set([
  'application/pdf',
  'application/zip',
  'application/x-zip-compressed',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])

export function classifyFileType(mimeType, fallback = 'file') {
  const mime = String(mimeType || '').toLowerCase()
  if (mime === 'image/gif') return 'sticker'
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return fallback === 'voice' ? 'voice' : 'audio'
  return 'file'
}

export function formatBytes(bytes) {
  const value = Number(bytes) || 0
  if (value >= 1024 * 1024 * 1024) return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${value} B`
}

export function probeMediaDuration(file) {
  return new Promise((resolve) => {
    const mime = String(file?.type || '')
    if (!mime.startsWith('video/') && !mime.startsWith('audio/')) return resolve(null)
    const url = URL.createObjectURL(file)
    const el = document.createElement(mime.startsWith('video/') ? 'video' : 'audio')
    el.preload = 'metadata'
    el.onloadedmetadata = () => {
      const duration = Number.isFinite(el.duration) ? el.duration : null
      URL.revokeObjectURL(url)
      resolve(duration)
    }
    el.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
    el.src = url
  })
}

export async function getStorageUsage(userId) {
  if (!isSupabaseConfigured() || !userId) {
    return { usedBytes: 0, quotaBytes: STORAGE_QUOTA_BYTES, byType: {}, files: [] }
  }
  const { data, error } = await supabase
    .from('storage_files')
    .select('id, chat_id, file_name, file_type, mime_type, size_bytes, duration_seconds, storage_path, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1000)
  if (error) throw error

  const files = data || []
  const byType = {}
  let usedBytes = 0
  for (const file of files) {
    const size = Number(file.size_bytes) || 0
    usedBytes += size
    byType[file.file_type] = (byType[file.file_type] || 0) + size
  }
  const { data: quotaRow } = await supabase
    .from('user_storage_quotas').select('quota_bytes').eq('user_id', userId).maybeSingle()
  const quotaBytes = Number(quotaRow?.quota_bytes) || STORAGE_QUOTA_BYTES
  return { usedBytes, quotaBytes, byType, files }
}

export async function validateUpload(file, { userId, durationSeconds = null, kind = 'file' } = {}) {
  if (!file) throw new Error('No file selected.')
  const mime = String(file.type || '').toLowerCase()
  const allowed = ALLOWED_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix)) || ALLOWED_EXTRA_MIME.has(mime)
  if (!allowed) {
    throw new Error('This file type is not supported. You can send images, videos, audio, PDFs, and documents.')
  }

  const fileType = classifyFileType(mime, kind)
  let duration = durationSeconds
  if ((fileType === 'video' || fileType === 'audio' || fileType === 'voice') && duration == null) {
    duration = await probeMediaDuration(file)
  }
  if (fileType === 'video' && duration != null && duration > MAX_VIDEO_DURATION_SECONDS) {
    throw new Error(`Videos can be at most ${MAX_VIDEO_DURATION_SECONDS} seconds long. This video is ${Math.round(duration)} seconds.`)
  }

  const usage = await getStorageUsage(userId)
  const remaining = usage.quotaBytes - usage.usedBytes
  if (file.size > remaining) {
    throw new Error(`Not enough storage space. This file is ${formatBytes(file.size)} but only ${formatBytes(Math.max(remaining, 0))} of your ${formatBytes(usage.quotaBytes)} is free. Delete files in Settings → Storage to free up space.`)
  }

  return { fileType, durationSeconds: duration }
}

function safeFileName(name) {
  return String(name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80)
}

export async function uploadChatFile({ userId, chatId, file, kind = 'file', durationSeconds = null }) {
  if (!isSupabaseConfigured()) throw new Error('File storage is not configured.')
  if (!userId) throw new Error('Sign in to send files.')

  const { fileType, durationSeconds: duration } = await validateUpload(file, { userId, durationSeconds, kind })
  const path = `${userId}/${chatId || 'direct'}/${Date.now()}-${safeFileName(file.name)}`

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false })
  if (uploadError) throw new Error(uploadError.message || 'The file could not be uploaded.')

  const { error: insertError } = await supabase.from('storage_files').insert({
    user_id: userId,
    chat_id: chatId ? String(chatId) : null,
    file_name: file.name || 'file',
    file_type: fileType,
    mime_type: file.type || null,
    size_bytes: file.size,
    duration_seconds: duration,
    storage_path: path,
  })
  if (insertError) {
    await supabase.storage.from(BUCKET).remove([path]).catch(() => {})
    throw new Error(insertError.message || 'The file could not be registered.')
  }

  const { data: signed, error: signError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
  if (signError) throw new Error(signError.message || 'The file link could not be created.')

  return {
    fileUrl: signed.signedUrl,
    fileName: file.name || 'file',
    fileType,
    durationSeconds: duration,
    storagePath: path,
  }
}

export async function deleteStorageFiles(userId, fileIds) {
  if (!isSupabaseConfigured() || !userId) throw new Error('File storage is not configured.')
  const ids = (fileIds || []).filter(Boolean)
  if (!ids.length) return { deleted: 0 }

  const { data: rows, error: readError } = await supabase
    .from('storage_files')
    .select('id, storage_path')
    .eq('user_id', userId)
    .in('id', ids)
  if (readError) throw readError

  const paths = (rows || []).map((row) => row.storage_path).filter(Boolean)
  if (paths.length) {
    const { error: removeError } = await supabase.storage.from(BUCKET).remove(paths)
    if (removeError) throw new Error(removeError.message || 'Files could not be deleted from storage.')
  }

  const { error: deleteError } = await supabase
    .from('storage_files')
    .delete()
    .eq('user_id', userId)
    .in('id', ids)
  if (deleteError) throw deleteError

  return { deleted: rows?.length || 0 }
}
