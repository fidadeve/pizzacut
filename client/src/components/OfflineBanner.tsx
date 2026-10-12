import { useEffect, useState } from 'react';
import { Icon } from './icons';

export function OfflineBanner() {
  const [offline, setOffline] = useState(typeof navigator !== 'undefined' && !navigator.onLine);
  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  if (!offline) return null;
  return (
    <div className="fixed inset-x-0 top-0 z-[90] flex items-center justify-center gap-2 bg-charcoal px-4 py-2 text-[12px] font-extrabold text-white" role="alert">
      <Icon name="info" className="h-4 w-4" /> You're offline — showing your last saved menu. Checkout needs a connection.
    </div>
  );
}
