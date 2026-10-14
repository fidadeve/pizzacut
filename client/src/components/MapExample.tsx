import { Map, MapControls } from '@/components/ui/map';

/**
 * Basic mapcn example — a MapLibre map with zoom/locate controls,
 * rendered inside an explicitly sized container (the map needs a
 * height; `h-80` + `overflow-hidden` keeps it contained).
 *
 * Uses the default tiled basemap (CARTO streets) for geographic context.
 */
export function MapExample() {
  // Store location fallback when no delivery pin is available.
  const center: [number, number] = [72.8777, 19.076]; // lng, lat (Mumbai)
  return (
    <div className="h-80 w-full overflow-hidden rounded-2xl border border-line shadow-card">
      <Map center={center} zoom={12}>
        <MapControls showZoom showLocate position="top-right" />
      </Map>
    </div>
  );
}
