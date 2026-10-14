import { lazy, Suspense } from 'react';
import { Spinner } from './ui';
import type { LiveDeliveryMapProps } from './LiveDeliveryMap';

/**
 * Code-split entry point for the live delivery map: MapLibre (~400 kB) is
 * only fetched when a page actually renders a map, keeping the menu/checkout
 * bundle small. Same props/behaviour as `LiveDeliveryMap`.
 */
const LiveDeliveryMap = lazy(() =>
  import('./LiveDeliveryMap').then(m => ({ default: m.LiveDeliveryMap })),
);

export function LiveDeliveryMapBoundary(props: LiveDeliveryMapProps) {
  return (
    <Suspense
      fallback={
        <div className={`flex items-center justify-center rounded-2xl border border-line bg-surface ${props.className ?? 'h-56'}`}>
          <Spinner className="h-6 w-6 text-brand" />
        </div>
      }
    >
      <LiveDeliveryMap {...props} />
    </Suspense>
  );
}
