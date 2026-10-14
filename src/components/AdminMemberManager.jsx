import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { appwriteData, isAppwriteAuthEnabled } from '../lib/appwrite'

export default function AdminMemberManager() {
  const { user } = useAuth()
  const [members, setMembers] = useState([])
  const [admins, setAdmins] = useState(new Set())
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    if (isAppwriteAuthEnabled()) {
      try {
        const { members: rows, admins: roles } = await appwriteData('admin.members.list', { query })
        setMembers(rows || [])
        setAdmins(new Set((roles || []).map((role) => role.user_id)))
        setMsg('')
      } catch (error) {
        setMsg(error.message || 'Could not load members.')
      }
      return
    }
    let q = supabase.from('members').select('id, member_id, first_name, last_name, full_name, email, email_verified, bio, created_at').order('created_at', { ascending: false }).limit(100)
    const term = query.trim()
    if (term) q = q.or(`full_name.ilike.%${term.replace(/[%,()]/g, '')}%,email.ilike.%${term.replace(/[%,()]/g, '')}%,member_id.ilike.%${term.replace(/[%,()]/g, '')}%`)
    const [{ data, error }, roles] = await Promise.all([q, supabase.rpc('admin_list_admins')])
    if (error) { setMsg(error.message); return }
    setMembers(data || [])
    setAdmins(new Set((roles.data || []).map((r) => r.user_id)))
  }, [query])

  useEffect(() => { load() }, [load])

  const run = async (fn, ok) => {
    setBusy(true); setMsg('')
    try {
      await fn()
      setMsg(ok)
      setEditing(null)
      await load()
    } catch (error) {
      setMsg(error.message || 'The member action failed.')
    } finally {
      setBusy(false)
    }
  }

  const updateMember = (member) => isAppwriteAuthEnabled()
    ? appwriteData('admin.member.update', {
      memberId: member.id,
      firstName: editing.first_name,
      lastName: editing.last_name,
      bio: editing.bio,
    })
    : supabase.rpc('admin_update_member', {
      _member_id: member.id,
      _first_name: editing.first_name,
      _last_name: editing.last_name,
      _bio: editing.bio,
    }).then(({ error }) => { if (error) throw error })

  const setAdminRole = (memberId, grant) => isAppwriteAuthEnabled()
    ? appwriteData('admin.role.set', { memberId, grant })
    : supabase.rpc('admin_set_admin_role', { _user_id: memberId, _grant: grant })
      .then(({ error }) => { if (error) throw error })

  return (
    <section className="mt-8 rounded-[24px] border border-border bg-card p-6 text-card-foreground shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Manage members</h2>
          <p className="mt-1 text-sm text-muted-foreground">Edit profiles and give or remove admin access.</p>
        </div>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, email or ID"
          className="w-64 rounded-xl border border-input bg-background px-3 py-2 text-sm" />
      </div>
      {msg && <p className="mt-3 text-sm text-muted-foreground">{msg}</p>}
      <div className="mt-4 space-y-3">
        {members.map((m) => {
          const isAdmin = admins.has(m.id)
          const isSelf = m.id === user?.id
          if (editing?.id === m.id) {
            return (
              <div key={m.id} className="space-y-2 rounded-2xl border border-border bg-muted/40 p-4">
                <div className="grid gap-2 sm:grid-cols-2">
                  <input className="rounded-xl border border-input bg-background px-3 py-2 text-sm" value={editing.first_name} onChange={(e) => setEditing({ ...editing, first_name: e.target.value })} placeholder="First name" />
                  <input className="rounded-xl border border-input bg-background px-3 py-2 text-sm" value={editing.last_name} onChange={(e) => setEditing({ ...editing, last_name: e.target.value })} placeholder="Last name" />
                </div>
                <textarea className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" rows={2} maxLength={500} value={editing.bio} onChange={(e) => setEditing({ ...editing, bio: e.target.value })} placeholder="Bio" />
                <div className="flex gap-2">
                  <button disabled={busy} className="rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                    onClick={() => run(() => updateMember(m), 'Member updated.')}>Save</button>
                  <button className="rounded-xl border border-border px-3 py-2 text-sm" onClick={() => setEditing(null)}>Cancel</button>
                </div>
              </div>
            )
          }
          return (
            <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-muted/40 p-4">
              <div className="min-w-0">
                <p className="font-semibold">{m.full_name || m.member_id} {isAdmin && <span className="ml-1 rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">Admin</span>}</p>
                <p className="truncate text-sm text-muted-foreground">{m.email} · #{m.member_id} · {m.email_verified ? 'email confirmed' : 'email not confirmed'}</p>
              </div>
              <div className="flex gap-2">
                <button className="rounded-xl border border-border px-3 py-1.5 text-sm" onClick={() => setEditing({ id: m.id, first_name: m.first_name || '', last_name: m.last_name || '', bio: m.bio || '' })}>Edit</button>
                {!isSelf && (
                  <button disabled={busy} className="rounded-xl border border-border px-3 py-1.5 text-sm disabled:opacity-50"
                    onClick={() => { if (window.confirm(isAdmin ? 'Remove admin access?' : 'Give this member admin access?')) run(() => setAdminRole(m.id, !isAdmin), isAdmin ? 'Admin access removed.' : 'Admin access granted.') }}>
                    {isAdmin ? 'Remove admin' : 'Make admin'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
        {!members.length && <p className="text-sm text-muted-foreground">No members found.</p>}
      </div>
    </section>
  )
}
