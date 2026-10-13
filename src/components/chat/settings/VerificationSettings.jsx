import { useEffect, useRef, useState } from 'react'
import { Camera, IdCard, LoaderCircle } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../lib/AuthContext'
import VerificationBadge from '../VerificationBadge'

const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model'
let faceApiPromise
async function loadFaceApi() {
  if (!faceApiPromise) {
    faceApiPromise = (async () => {
      const faceapi = await import('@vladmandic/face-api')
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ])
      return faceapi
    })()
  }
  return faceApiPromise
}

async function descriptorFor(faceapi, blob) {
  const img = await faceapi.bufferToImage(blob)
  const result = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor()
  return result?.descriptor || null
}

export default function VerificationSettings() {
  const { user } = useAuth()
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [record, setRecord] = useState(null)
  const [selfie, setSelfie] = useState(null)
  const [idDoc, setIdDoc] = useState(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!supabase || !user?.id) return
    supabase.from('identity_verifications').select('status, match_score, reviewer_note, created_at')
      .eq('user_id', user.id).maybeSingle().then(({ data }) => setRecord(data))
    return () => streamRef.current?.getTracks().forEach((t) => t.stop())
  }, [user?.id])

  const startCamera = async () => {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      streamRef.current = stream
      videoRef.current.srcObject = stream
      await videoRef.current.play()
    } catch {
      setError('Camera access was blocked. Allow camera access and try again.')
    }
  }

  const capture = () => {
    const v = videoRef.current
    if (!v?.videoWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = v.videoWidth; canvas.height = v.videoHeight
    canvas.getContext('2d').drawImage(v, 0, 0)
    canvas.toBlob((blob) => setSelfie(blob), 'image/jpeg', 0.92)
    streamRef.current?.getTracks().forEach((t) => t.stop())
  }

  const submit = async () => {
    if (!selfie || !idDoc) return
    setError('')
    try {
      setBusy('Checking faces…')
      const faceapi = await loadFaceApi()
      const [a, b] = await Promise.all([descriptorFor(faceapi, selfie), descriptorFor(faceapi, idDoc)])
      if (!a) throw new Error('No face found in your selfie. Try again in good light.')
      if (!b) throw new Error('No face found on your ID photo. Upload a clearer picture.')
      const distance = faceapi.euclideanDistance(a, b)
      const score = Math.max(0, Math.min(1, 1 - distance))
      if (distance > 0.6) throw new Error('Your selfie does not match the ID photo. Please try again.')

      setBusy('Uploading securely…')
      const stamp = Date.now()
      const selfiePath = `${user.id}/selfie-${stamp}.jpg`
      const idPath = `${user.id}/id-${stamp}.${(idDoc.name?.split('.').pop() || 'jpg').toLowerCase()}`
      const up1 = await supabase.storage.from('identity-docs').upload(selfiePath, selfie, { contentType: 'image/jpeg' })
      if (up1.error) throw up1.error
      const up2 = await supabase.storage.from('identity-docs').upload(idPath, idDoc, { contentType: idDoc.type })
      if (up2.error) throw up2.error
      const { error: insError } = await supabase.from('identity_verifications').upsert({
        user_id: user.id, status: 'pending', match_score: Number(score.toFixed(3)),
        selfie_path: selfiePath, id_document_path: idPath, reviewer_note: null,
      }, { onConflict: 'user_id' })
      if (insError) throw insError
      setRecord({ status: 'pending', match_score: score })
    } catch (err) {
      setError(err.message || 'Verification could not be submitted.')
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-muted/30 p-4">
        <VerificationBadge userId={user?.id} className="w-6 h-6" />
        <p className="text-sm text-foreground">
          {record?.status === 'approved' ? 'You are Authenticated (gold badge).'
            : record?.status === 'pending' ? 'Your faces matched. A reviewer is confirming your ID.'
            : record?.status === 'rejected' ? `Verification rejected${record.reviewer_note ? `: ${record.reviewer_note}` : ''}.`
            : 'Verify with a selfie and a government ID to earn the gold Authenticated badge.'}
        </p>
      </div>

      {(!record || record.status === 'rejected') && (
        <>
          <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <p className="flex items-center gap-2 font-semibold text-foreground"><Camera className="w-4 h-4" /> 1. Take a selfie</p>
            {selfie ? (
              <div className="flex items-center gap-3">
                <img src={URL.createObjectURL(selfie)} alt="Your selfie" className="h-24 rounded-xl" />
                <button onClick={() => { setSelfie(null) }} className="text-sm text-primary hover:underline">Retake</button>
              </div>
            ) : (
              <>
                <video ref={videoRef} playsInline muted className="w-full max-w-sm rounded-xl bg-muted" />
                <div className="flex gap-2">
                  <button onClick={startCamera} className="rounded-full border border-border px-4 py-2 text-sm">Start camera</button>
                  <button onClick={capture} className="rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground">Capture</button>
                </div>
              </>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <p className="flex items-center gap-2 font-semibold text-foreground"><IdCard className="w-4 h-4" /> 2. Upload your government ID</p>
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setIdDoc(e.target.files?.[0] || null)} className="text-sm" />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <button onClick={submit} disabled={!selfie || !idDoc || !!busy}
            className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {busy ? <><LoaderCircle className="w-4 h-4 animate-spin" /> {busy}</> : 'Submit for verification'}
          </button>
          <p className="text-xs text-muted-foreground">Face matching runs on your device. Your photos are stored privately and only reviewers can see them.</p>
        </>
      )}
    </div>
  )
}
