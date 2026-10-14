import { useCallback, useRef, useState } from 'react';
import { LocationMapEmbed } from './LocationMap';
import { Icon } from './icons';
import { Spinner } from './ui';

export interface CapturedLocation {
  lat: number; lng: number; accuracy: number | null;
}

type Phase = 'idle' | 'locating' | 'captured' | 'denied' | 'unavailable';

/**
 * Mandatory delivery-location capture for checkout (delivery orders only).
 *
 * Uses the device's standard Geolocation permission dialog. Permission being
 * “granted” is never treated as proof of a valid fix — only a real position
 * object with usable accuracy marks the location as captured, otherwise we
 * surface clear guidance (permission denied / location off / weak GPS) with a
 * retry. After capture the customer sees a map preview with the exact pin.
 */
export function DeliveryLocationPicker({ value, onChange, landmark, onLandmark }: {
  value: CapturedLocation | null;
  onChange: (loc: CapturedLocation | null) => void;
  landmark?: string;
  onLandmark?: (v: string) => void;
}) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [weakGps, setWeakGps] = useState(false);
  const watchRef = useRef<number | null>(null);

  const stopWatch = useCallback(() => {
    if (watchRef.current != null) { navigator.geolocation.clearWatch(watchRef.current); watchRef.current = null; }
  }, []);

  const capture = useCallback(() => {
    setError(null);
    setWeakGps(false);
    if (!('geolocation' in navigator)) {
      setPhase('unavailable');
      setError('Your browser does not support location sharing. Please order for pickup instead.');
      return;
    }
    setPhase('locating');
    stopWatch();
    navigator.geolocation.getCurrentPosition(
      pos => {
        const loc: CapturedLocation = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Number.isFinite(pos.coords.accuracy) ? Math.round(pos.coords.accuracy) : null,
        };
        onChange(loc);
        setPhase('captured');
        setWeakGps(loc.accuracy != null && loc.accuracy > 100);
      },
      err => {
        if (err.code === err.PERMISSION_DENIED) {
          setPhase('denied');
          setError('Location access was blocked. Delivery orders need your location so the rider can find you — enable location for this site in your browser settings, then try again.');
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setPhase('unavailable');
          setError('Your device could not determine a location. Make sure Location Services / GPS is on, step outside or near a window, then try again.');
        } else {
          setPhase('unavailable');
          setError('Getting your location timed out. Please try again.');
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }, [onChange, stopWatch]);

  const captured = phase === 'captured' && !!value;

  return (
    <div className="rounded-2xl border-2 border-line bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[14.5px] font-extrabold text-ink">Confirm delivery location</h3>
        {captured && (
          <button onClick={capture} className="text-[12px] font-extrabold text-brand hover:underline">
            {weakGps ? 'Improve accuracy' : 'Re-capture'}
          </button>
        )}
      </div>
      <p className="mt-0.5 text-[12px] font-semibold text-muted">
        We need your pin so the rider reaches the right door. Your location is shared only with this order.
      </p>

      {!captured && phase !== 'locating' && (
        <button onClick={capture}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-brand px-4 py-3.5 text-[14px] font-extrabold text-white shadow-pop transition-transform active:scale-[0.99]">
          <Icon name="pin" className="h-5 w-5" /> Use my current location
        </button>
      )}

      {phase === 'locating' && (
        <div className="mt-3 flex items-center gap-3 rounded-2xl bg-surface p-4 text-[13px] font-bold text-charcoal">
          <Spinner className="h-5 w-5 text-brand" /> Getting your location — allow the browser prompt if shown…
        </div>
      )}

      {error && (
        <div role="alert" className="mt-3 rounded-2xl bg-brand-soft p-3 text-[12.5px] font-bold text-brand">
          <p>{error}</p>
          <p className="mt-1 text-[11.5px] font-semibold text-charcoal">
            Tip: check the location icon in your browser's address bar → allow location.
          </p>
        </div>
      )}

      {captured && value && (
        <div className="mt-3 space-y-2">
          <LocationMapEmbed lat={value.lat} lng={value.lng} label="Delivery" className="w-full" />
          <p className="text-[12px] font-bold text-muted">
            Pin captured{value.accuracy != null ? ` · GPS accuracy ±${value.accuracy} m` : ''}.
            {weakGps && ' This is a rough fix (indoors?) — tap “Improve accuracy” to retry from outside.'}
          </p>
          {onLandmark && (
            <label className="block">
              <span className="label">Landmark (optional)</span>
              <input className="field" value={landmark ?? ''} onChange={e => onLandmark(e.target.value)}
                placeholder="e.g. opposite the blue mosque gate" maxLength={120} />
            </label>
          )}
        </div>
      )}
    </div>
  );
}
