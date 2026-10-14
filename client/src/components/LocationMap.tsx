/**
 * Map preview + navigation helpers.
 *
 * Uses the Google Maps URL scheme for "Open in Maps" (deep-links straight into
 * the installed Android/iOS app, falling back to the web browser), and an
 * OpenStreetMap embed for the in-page preview so no API key is needed.
 * Real stored coordinates (lat/lng) are always used — never a geocoded address.
 */
export function mapsPinLink(lat: number, lng: number) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

export function mapsNavLink(lat: number, lng: number) {
  // Universal navigation intent: opens the device's maps app with directions.
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
}

export function coordLink(lat: number, lng: number) {
  // Fallback that works even when no maps app/provider is available.
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;
}

/** Static-ish embed with a marker pin. No API key, graceful if offline. */
export function LocationMapEmbed({ lat, lng, label = 'Delivery location', className = '' }: {
  lat: number; lng: number; label?: string; className?: string;
}) {
  const d = 0.004; // ~400 m framing
  const bbox = `${lng - d},${lat - d},${lng + d},${lat + d}`;
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;
  return (
    <div className={`overflow-hidden rounded-2xl border border-line ${className}`}>
      <iframe
        src={src}
        title={`${label} map preview · pin at ${lat.toFixed(5)}, ${lng.toFixed(5)}`}
        loading="lazy"
        className="h-44 w-full border-0 bg-surface"
      />
      <div className="flex items-center justify-between gap-2 bg-surface px-3 py-2 text-[11.5px] font-bold text-muted">
        <span className="truncate">📍 {lat.toFixed(5)}, {lng.toFixed(5)}</span>
        <div className="flex shrink-0 gap-2">
          <a href={mapsPinLink(lat, lng)} target="_blank" rel="noopener noreferrer" className="font-extrabold text-brand hover:underline">Open in Maps</a>
          <a href={coordLink(lat, lng)} target="_blank" rel="noopener noreferrer" className="font-extrabold text-charcoal hover:underline underline-offset-2">Coordinates</a>
        </div>
      </div>
    </div>
  );
}
