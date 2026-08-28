import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { securityApi } from '@/api/client'
import {
  Shield, AlertTriangle, Unlock, Globe, Monitor,
  Loader2, ChevronDown, ChevronRight,
  MapPin, Ban, Eye, KeyRound, Lock, LayoutGrid,
} from 'lucide-react'
import { useState } from 'react'

export default function SecurityDashboard() {
  const [activeTab, setActiveTab] = useState<'sessions' | 'attempts' | 'suspicious' | 'blocked' | 'locked' | 'otp'>('sessions')
  const [menuOpen, setMenuOpen] = useState(false)

  const tabs = [
    { id: 'sessions' as const, label: 'Sessions', icon: Monitor },
    { id: 'attempts' as const, label: 'Login Attempts', icon: Eye },
    { id: 'suspicious' as const, label: 'Suspicious Logins', icon: AlertTriangle },
    { id: 'blocked' as const, label: 'Blocked IPs', icon: Ban },
    { id: 'locked' as const, label: 'Locked Users', icon: Lock },
    { id: 'otp' as const, label: 'OTP Codes', icon: KeyRound },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-primary/10">
          <Shield className="w-5 h-5 text-primary" />
        </div>
        <h1 className="text-2xl font-black">Security Dashboard</h1>
      </div>

      {/* ── Foldout menu (replaces the top tab bar) ── */}
      <div className="fixed top-[4.5rem] right-6 z-40">
        <button
          onClick={() => setMenuOpen(v => !v)}
          className="w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center"
          title="Switch section"
        >
          <LayoutGrid className="w-5 h-5" />
        </button>

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
            <div className="absolute top-16 right-0 z-40 w-64 glass-card overflow-y-auto p-3 border border-border shadow-2xl rounded-2xl max-h-[70vh]">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground px-3 py-2">Sections</p>
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id); setMenuOpen(false) }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-all ${
                    activeTab === tab.id
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'hover:bg-primary/10'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {activeTab === 'sessions' && <SessionsPanel />}
      {activeTab === 'attempts' && <LoginAttemptsPanel />}
      {activeTab === 'suspicious' && <SuspiciousLoginsPanel />}
      {activeTab === 'blocked' && <BlockedIpsPanel />}
      {activeTab === 'locked' && <LockedUsersPanel />}
      {activeTab === 'otp' && <OTPCodesPanel />}
    </div>
  )
}

function SessionsPanel() {
  const [expanded, setExpanded] = useState<string | null>(null)
  const { data: sessions, isLoading } = useQuery({ queryKey: ['security-sessions'], queryFn: () => securityApi.getSessions().then(r => r.data) , })

  if (isLoading) return <Loading />

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-bold">Active Sessions</h2>
      {sessions?.length === 0 ? (
        <p className="text-sm text-muted-foreground">No active sessions.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {sessions?.map((s: any) => (
            <div key={s.id} className="card p-4">
              <button
                onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                className="flex items-center gap-3 w-full text-left"
              >
                {expanded === s.id ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{s.user_name || s.user_email || 'Unknown user'}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {s.ip_address || '—'} · {deviceLabel(s.device_info)} · {new Date(s.last_activity).toLocaleString()}
                  </p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${s.is_active ? 'bg-green-500/10 text-green-600' : 'bg-muted text-muted-foreground'}`}>
                  {s.is_active ? 'Active' : 'Expired'}
                </span>
              </button>
              {expanded === s.id && (
                <div className="mt-3 pt-3 border-t text-sm grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">IP Address</p>
                    <p className="font-mono text-sm">{s.ip_address || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Location</p>
                    <p className="text-sm">{[s.city, s.country].filter(Boolean).join(', ') || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Created</p>
                    <p className="text-sm">{new Date(s.created_at).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Last Active</p>
                    <p className="text-sm">{new Date(s.last_activity).toLocaleString()}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground mb-1">Device</p>
                    <p className="font-mono text-xs break-all">{deviceDetail(s.device_info)}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function deviceLabel(d?: Record<string, any> | null): string {
  if (!d) return 'Unknown device'
  const parts = [d.browser, d.os, d.device].filter(Boolean)
  return parts.length ? String(parts.join(' · ')) : 'Unknown device'
}

function deviceDetail(d?: Record<string, any> | null): string {
  if (!d) return '—'
  const keys = ['browser', 'os', 'device', 'fingerprint', 'userAgent', 'model', 'brand']
  const found = keys.map(k => d[k]).filter(Boolean)
  return found.length ? found.map(String).join(' · ') : JSON.stringify(d)
}

function LoginAttemptsPanel() {
  const { data: attempts, isLoading } = useQuery({ queryKey: ['security-attempts'], queryFn: () => securityApi.getLoginAttempts().then(r => r.data) })

  if (isLoading) return <Loading />

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-bold">Login Attempts</h2>
      {attempts?.length === 0 ? (
        <p className="text-sm text-muted-foreground">No login attempts recorded.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 font-semibold">Email</th>
                <th className="pb-2 font-semibold">IP</th>
                <th className="pb-2 font-semibold">Country</th>
                <th className="pb-2 font-semibold">Result</th>
                <th className="pb-2 font-semibold">Time</th>
              </tr>
            </thead>
            <tbody>
              {attempts?.map((a: any) => (
                <tr key={a.id} className="border-b last:border-0">
                  <td className="py-2">{a.email_attempted || a.user_email || '—'}</td>
                  <td className="py-2 font-mono text-xs">{a.ip_address}</td>
                  <td className="py-2">{a.country || '—'}</td>
                  <td className="py-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      a.success ? 'bg-green-500/10 text-green-600' : 'bg-destructive/10 text-destructive'
                    }`}>
                      {a.success ? 'Success' : 'Failed'}
                    </span>
                  </td>
                  <td className="py-2 text-muted-foreground">{new Date(a.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function SuspiciousLoginsPanel() {
  const queryClient = useQueryClient()
  const { data: logins, isLoading } = useQuery({ queryKey: ['security-suspicious'], queryFn: () => securityApi.getSuspiciousLogins().then(r => r.data) })

  if (isLoading) return <Loading />

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-bold">Suspicious Logins</h2>
      {logins?.length === 0 ? (
        <p className="text-sm text-muted-foreground">No suspicious logins recorded.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {logins?.map((l: any) => (
            <div key={l.id} className="card p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span className="font-semibold">{l.user_email}</span>
                </div>
                <span className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString()}</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Globe className="w-3 h-3" /> {l.ip_address}
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <MapPin className="w-3 h-3" /> {l.country || 'Unknown'}{l.city ? `, ${l.city}` : ''}
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Monitor className="w-3 h-3" /> {l.status}
                </div>
                {l.confirmed_by_user === null && (
                  <div className="flex gap-2">
                    <ConfirmButtons loginId={l.id} queryClient={queryClient} />
                  </div>
                )}
                {l.confirmed_by_user === true && <span className="text-xs bg-green-500/10 text-green-600 px-2 py-1 rounded-full w-fit">Confirmed safe</span>}
                {l.confirmed_by_user === false && <span className="text-xs bg-destructive/10 text-destructive px-2 py-1 rounded-full w-fit">Confirmed suspicious</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ConfirmButtons({ queryClient }: { loginId: string; queryClient: any }) {
  const mutation = useMutation({
    mutationFn: () => Promise.resolve(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['security-suspicious'] }),
  })

  return (
    <div className="flex gap-2">
        <button
          onClick={() => mutation.mutate()}
          className="text-xs bg-green-500/10 text-green-600 px-2 py-1 rounded-full hover:bg-green-500/20 transition-colors"
        >
          Safe
        </button>
        <button
          onClick={() => mutation.mutate()}
          className="text-xs bg-destructive/10 text-destructive px-2 py-1 rounded-full hover:bg-destructive/20 transition-colors"
        >
          Suspicious
        </button>
    </div>
  )
}

function BlockedIpsPanel() {
  const queryClient = useQueryClient()
  const [ip, setIp] = useState('')
  const [reason, setReason] = useState('')

  const { data: blocked, isLoading } = useQuery({ queryKey: ['security-blocked'], queryFn: () => securityApi.getBlockedIps().then(r => r.data) })

  const blockMutation = useMutation({
    mutationFn: () => securityApi.blockIp({ ip, reason: reason || undefined }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['security-blocked'] }); setIp(''); setReason('') },
  })

  const unblockMutation = useMutation({
    mutationFn: (id: string) => securityApi.unblockIp(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['security-blocked'] }),
  })

  if (isLoading) return <Loading />

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-bold">Blocked IPs</h2>

      <div className="card p-4 flex flex-col gap-3">
        <div className="flex gap-3">
          <input
            value={ip}
            onChange={e => setIp(e.target.value)}
            placeholder="IP address (e.g. 192.168.1.1)"
            className="input-field flex-1"
          />
          <input
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Reason (optional)"
            className="input-field flex-1"
          />
          <button
            onClick={() => blockMutation.mutate()}
            disabled={!ip || blockMutation.isPending}
            className="btn-primary shrink-0"
          >
            {blockMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
            Block
          </button>
        </div>
        {blockMutation.isError && <p className="text-sm text-destructive">Failed to block IP.</p>}
      </div>

      {blocked?.length === 0 ? (
        <p className="text-sm text-muted-foreground">No blocked IPs.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {blocked?.map((b: any) => (
            <div key={b.id} className="card p-4 flex items-center justify-between">
              <div>
                <p className="font-mono text-sm font-semibold">{b.ip_address}</p>
                <p className="text-xs text-muted-foreground mt-1">{b.reason || 'No reason given'} · Blocked {new Date(b.created_at).toLocaleString()}</p>
              </div>
              <button
                onClick={() => unblockMutation.mutate(b.id)}
                className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                title="Unblock"
              >
                <Unlock className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Loading() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
    </div>
  )
}

function LockedUsersPanel() {
  const queryClient = useQueryClient()
  const { data: users, isLoading } = useQuery({ queryKey: ['security-locked'], queryFn: () => securityApi.getLockedUsers().then(r => r.data) })

  const unlockMutation = useMutation({
    mutationFn: (id: string) => securityApi.unlockAccount(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['security-locked'] }),
  })

  if (isLoading) return <Loading />

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-bold">Locked Out Users</h2>
      <p className="text-sm text-muted-foreground">Accounts locked after repeated failed login attempts. Unlock to restore access.</p>
      {users?.length === 0 ? (
        <p className="text-sm text-muted-foreground">No locked-out users.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 font-semibold">Name</th>
                <th className="pb-2 font-semibold">Email</th>
                <th className="pb-2 font-semibold">Failed Attempts</th>
                <th className="pb-2 font-semibold">Last Failed</th>
                <th className="pb-2 font-semibold">Locked Until</th>
                <th className="pb-2 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {users?.map((u: any) => (
                <tr key={u.id} className="border-b last:border-0">
                  <td className="py-2 font-semibold">{u.name}</td>
                  <td className="py-2">{u.email}</td>
                  <td className="py-2">{u.failed_attempts}</td>
                  <td className="py-2 text-muted-foreground">{u.last_failed_at ? new Date(u.last_failed_at).toLocaleString() : '—'}</td>
                  <td className="py-2 text-muted-foreground">{u.locked_until ? new Date(u.locked_until).toLocaleString() : '—'}</td>
                  <td className="py-2 text-right">
                    <button
                      onClick={() => unlockMutation.mutate(u.id)}
                      disabled={unlockMutation.isPending}
                      className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
                    >
                      <Unlock className="w-3.5 h-3.5" /> Unlock
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function OTPCodesPanel() {
  const { data: otps, isLoading } = useQuery({ queryKey: ['security-otp'], queryFn: () => securityApi.getOTPStatus().then(r => r.data) })

  if (isLoading) return <Loading />

  const statusColor: Record<string, string> = {
    sent: 'bg-amber-500/10 text-amber-600',
    used: 'bg-green-500/10 text-green-600',
    expired: 'bg-destructive/10 text-destructive',
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-bold">OTP Codes</h2>
      <p className="text-sm text-muted-foreground">All one-time passwords issued (last 500). Codes are masked; each can be used once and expires after 10 minutes.</p>
      {otps?.length === 0 ? (
        <p className="text-sm text-muted-foreground">No OTP codes issued.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 font-semibold">User</th>
                <th className="pb-2 font-semibold">Code</th>
                <th className="pb-2 font-semibold">Purpose</th>
                <th className="pb-2 font-semibold">Status</th>
                <th className="pb-2 font-semibold">Issued</th>
                <th className="pb-2 font-semibold">Expires</th>
              </tr>
            </thead>
            <tbody>
              {otps?.map((o: any) => (
                <tr key={o.id} className="border-b last:border-0">
                  <td className="py-2">{o.user_name || o.user_email || o.user_id}</td>
                  <td className="py-2 font-mono text-xs">{o.masked_code}</td>
                  <td className="py-2 capitalize">{o.purpose}</td>
                  <td className="py-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${statusColor[o.status] || 'bg-muted text-muted-foreground'}`}>
                      {o.status}
                    </span>
                  </td>
                  <td className="py-2 text-muted-foreground">{new Date(o.created_at).toLocaleString()}</td>
                  <td className="py-2 text-muted-foreground">{new Date(o.expires_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
