import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { useFetch } from '../../lib/useFetch';
import type { AppNotification } from '../../lib/types';
import { formatDate } from '../../lib/format';
import { Sheet, Spinner } from '../../components/ui';
import { Icon } from '../../components/icons';

/** Short chime for new orders (Web Audio — no asset needed). */
function beep() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sine'; osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start(); osc.stop(ctx.currentTime + 0.4);
    setTimeout(() => void ctx.close(), 600);
  } catch { /* audio unavailable — silent fallback */ }
}

/** Header bell: unread badge, notification sheet, and a chime for fresh orders. */
export function AdminNotifications() {
  const { data, retry } = useFetch(
    () => api.get<{ notifications: AppNotification[]; unread: number }>('/admin/notifications'),
    [],
  );
  const [open, setOpen] = useState(false);
  const lastUnread = useRef<number | null>(null);
  const [muted, setMuted] = useState(() => localStorage.getItem('pc_admin_muted') === '1');

  // Poll + chime when new admin notifications arrive.
  useEffect(() => {
    const timer = setInterval(() => void retry(), 15000);
    return () => clearInterval(timer);
  }, [retry]);

  useEffect(() => {
    const unread = data?.unread;
    if (unread == null) return;
    if (lastUnread.current != null && unread > lastUnread.current && !muted) beep();
    lastUnread.current = unread;
  }, [data?.unread, muted]);

  const unread = data?.unread ?? 0;
  const markRead = async () => {
    await api.post('/admin/notifications/read');
    void retry();
  };

  return (
    <>
      <div className="flex items-center gap-1">
        <button onClick={() => setOpen(o => !o)} aria-label={`Notifications (${unread} unread)`}
          className="relative flex h-9 w-9 items-center justify-center rounded-full bg-surface text-charcoal hover:bg-line">
          <Icon name="bell" className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-0.5 text-[10px] font-extrabold text-white">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
        <button onClick={() => setMuted(m => { localStorage.setItem('pc_admin_muted', m ? '0' : '1'); return !m; })}
          aria-label={muted ? 'Enable notification sound' : 'Mute notification sound'}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-surface text-charcoal hover:bg-line" title={muted ? 'Sound off' : 'Sound on'}>
          <Icon name={muted ? 'close' : 'sparkle'} className="h-4 w-4" />
        </button>
      </div>

      {open && (
        <Sheet open title="Notifications" onClose={() => { setOpen(false); }}>
          <div className="pb-4">
            {data == null ? (
              <div className="flex justify-center py-6"><Spinner className="h-6 w-6 text-brand" /></div>
            ) : data.notifications.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-line p-6 text-center text-[13px] font-semibold text-muted">No notifications yet.</p>
            ) : (
              <>
                <button onClick={() => void markRead()} className="mb-3 text-[12px] font-extrabold text-brand hover:underline">Mark all read</button>
                <ul className="space-y-2">
                  {data.notifications.map(n => (
                    <li key={n.id} className={`rounded-2xl border p-3 ${n.read ? 'border-line bg-white' : 'border-brand/40 bg-brand-soft'}`}>
                      <p className="text-[13.5px] font-extrabold text-ink">{n.title}</p>
                      {n.body && <p className="text-[12px] font-semibold text-muted">{n.body}</p>}
                      <p className="mt-0.5 text-[11px] font-bold text-muted">{formatDate(n.createdAt)}</p>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </Sheet>
      )}
    </>
  );
}
