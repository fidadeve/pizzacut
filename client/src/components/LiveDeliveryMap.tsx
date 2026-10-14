import { useEffect, useMemo } from 'react';
import { Map, MapControls, MapMarker, MapRoute, MarkerContent, MarkerLabel, useMap } from '@/components/ui/map';
import { Icon } from './icons';

export interface MapPoint { lat: number; lng: number }

/** Fits the viewport to every supplied point (with padding) whenever they change. */
function FitBounds({ points }: { points: MapPoint[] }) {
  const { map, isLoaded } = useMap();
  const key = points.map(p => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join('|');
  useEffect(() => {
    if (!map || !isLoaded || points.length === 0) return;
    const lngs = points.map(p => p.lng);
    const lats = points.map(p => p.lat);
    const bounds: [[number, number], [number, number]] = [
      [Math.min(...lngs), Math.min(...lats)],
      [Math.max(...lngs), Math.max(...lats)],
    ];
    // Single point → gentle zoom-in; two+ → frame them both.
    map.fitBounds(bounds, {
      padding: points.length === 1 ? 40 : 72,
      maxZoom: points.length === 1 ? 15 : 14,
      duration: 700,
      essential: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, isLoaded, key]);
  return null;
}

function RiderPin({ label, live }: { label?: string; live: boolean }) {
  return (
    <div className="pointer-events-none flex flex-col items-center">
      <div className="relative flex h-9 w-9 items-center justify-center rounded-full border-[3px] border-white bg-brand text-white shadow-pop">
        <Icon name="bike" className="h-4.5 w-4.5" />
        {live && <span className="absolute -inset-1.5 -z-10 animate-ping rounded-full bg-brand/40" />}
      </div>
      {label && (
        <MarkerLabel position="bottom" className="rounded-full bg-charcoal px-2 py-0.5 text-[10px] font-extrabold text-white shadow">
          {label}
        </MarkerLabel>
      )}
    </div>
  );
}

function PlacePin({ label, tone = 'dark' }: { label?: string; tone?: 'dark' | 'brand' }) {
  return (
    <div className="pointer-events-none flex flex-col items-center">
      <div className={`flex h-9 w-9 items-center justify-center rounded-full border-[3px] border-white text-white shadow-pop ${tone === 'brand' ? 'bg-brand' : 'bg-charcoal'}`}>
        <Icon name="pin" className="h-4.5 w-4.5" />
      </div>
      {label && (
        <MarkerLabel position="bottom" className="rounded-full bg-white px-2 py-0.5 text-[10px] font-extrabold text-charcoal shadow ring-1 ring-line">
          {label}
        </MarkerLabel>
      )}
    </div>
  );
}

export interface LiveDeliveryMapProps {
  rider?: MapPoint | null;
  destination?: MapPoint | null;
  riderLabel?: string;
  destinationLabel?: string;
  live?: boolean;
  footer?: React.ReactNode;
  className?: string;
}

/**
 * Real-time delivery map (mapcn / MapLibre):
 *  - pulsing rider marker (live GPS) + destination pin
 *  - dashed route line between them
 *  - auto-fits, zoom controls, live badge, "updated just now" chip
 *
 * `rider` is null until the server has a fresh ping — the map still renders
 * the destination so customers/riders always see geographic context.
 */
export function LiveDeliveryMap({
  rider,
  destination,
  riderLabel,
  destinationLabel = 'Destination',
  live = false,
  footer,
  className = 'h-56',
}: LiveDeliveryMapProps) {
  const points = useMemo(() => {
    const list: MapPoint[] = [];
    if (rider) list.push(rider);
    if (destination) list.push(destination);
    return list;
  }, [rider, destination]);

  if (points.length === 0) return null;

  const center: [number, number] = [points[0].lng, points[0].lat];
  const showRoute = !!rider && !!destination;

  return (
    <div className={`relative w-full overflow-hidden rounded-2xl border border-line bg-surface ${className}`}>
      <Map center={center} zoom={13} className="h-full w-full">
        <FitBounds points={points} />
        {showRoute && (
          <MapRoute
            coordinates={[[rider!.lng, rider!.lat], [destination!.lng, destination!.lat]]}
            color="#FF0018"
            width={4}
            opacity={0.9}
            dashArray={[8, 6]}
          />
        )}
        {destination && (
          <MapMarker longitude={destination.lng} latitude={destination.lat} anchor="bottom">
            <MarkerContent><PlacePin label={destinationLabel} /></MarkerContent>
          </MapMarker>
        )}
        {rider && (
          <MapMarker longitude={rider.lng} latitude={rider.lat} anchor="bottom">
            <MarkerContent><RiderPin label={riderLabel} live={live} /></MarkerContent>
          </MapMarker>
        )}
        <MapControls position="bottom-right" showZoom showCompass={false} />
      </Map>

      {/* Live badge */}
      <div className="pointer-events-none absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 shadow-card ring-1 ring-line">
        <span className={`h-2 w-2 rounded-full ${live ? 'animate-pulse-dot bg-brand' : 'bg-muted'}`} />
        <span className="text-[10.5px] font-extrabold uppercase tracking-wide text-charcoal">
          {live ? 'Live' : 'Map'}
        </span>
      </div>

      {footer && (
        <div className="absolute inset-x-0 bottom-0 z-10 border-t border-line bg-white/95 px-3 py-1.5 text-[11px] font-bold text-muted backdrop-blur">
          {footer}
        </div>
      )}
    </div>
  );
}
