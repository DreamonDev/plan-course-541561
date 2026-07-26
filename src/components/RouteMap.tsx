import { useMemo } from 'react';
import type { Store, Category } from '@/types';
import { resolveGrid, cellRect, cellCenter, planSize, type ComputedRoute } from '@/lib/routing';

interface Props {
  store: Store;
  categories: Category[];
  route: ComputedRoute;
  /** index of the currently targeted stop (-1 = none / checkout) */
  activeStop: number;
  /** callback used by the desktop view for tooltips */
  onStopHover?: (index: number | null) => void;
  hoveredStop?: number | null;
  className?: string;
  style?: React.CSSProperties;
  /** viewBox restricted around the active stop (mobile zoom) */
  focus?: boolean;
}

export function RouteMap({
  store, categories, route, activeStop, onStopHover, hoveredStop, className, style, focus,
}: Props) {
  const grid = useMemo(() => resolveGrid(store), [store]);
  const { width, height } = planSize(store);
  const catById = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c])),
    [categories],
  );

  const doneIndex = route.stopPathIndex[activeStop] ?? route.path.length - 1;
  const donePts = route.path.slice(0, Math.max(1, doneIndex + 1));
  const restPts = route.path.slice(Math.max(0, doneIndex));

  const toPoly = (pts: typeof route.path) =>
    pts.map((p) => { const c = cellCenter(store, p); return `${c.x},${c.y}`; }).join(' ');

  let viewBox = `0 0 ${width} ${height}`;
  if (focus) {
    const anchor = route.stops[activeStop]?.stand ?? route.checkout ?? route.entrance;
    if (anchor) {
      const c = cellCenter(store, anchor);
      const vw = Math.min(width, Math.max(320, width / 3.2));
      const vh = Math.min(height, Math.max(180, height));
      const x = Math.max(0, Math.min(width - vw, c.x - vw / 2));
      const y = Math.max(0, Math.min(height - vh, c.y - vh / 2));
      viewBox = `${x} ${y} ${vw} ${vh}`;
    }
  }

  return (
    <svg
      className={className}
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid meet"
      style={{ transition: 'all 500ms cubic-bezier(0.4,0,0.2,1)', ...style }}
    >
      {grid.map((row) =>
        row.map((cell) => {
          const r = cellRect(store, cell);
          const catId = cell.categoryIds[0];
          const cat = catId ? catById[catId] : undefined;
          const isEntrance = store.entrance?.row === cell.row && store.entrance?.col === cell.col;
          const isCheckout = cell.types.has('checkout');
          let fill = 'hsl(var(--card))';
          if (cell.types.has('wall') && !cat) fill = 'hsl(var(--muted-foreground) / 0.5)';
          if (cat) fill = cat.color;
          if (isCheckout) fill = 'hsl(30 90% 55%)';
          if (isEntrance) fill = 'hsl(var(--primary))';
          const dim = focus && route.stops[activeStop]
            ? Math.abs(cell.col - route.stops[activeStop].stand.col) > 6 ? 0.25 : 1
            : 1;
          return (
            <rect
              key={`${cell.row}-${cell.col}`}
              x={r.x} y={r.y} width={r.w} height={r.h}
              fill={fill}
              fillOpacity={dim}
              stroke="hsl(var(--border))"
              strokeWidth={0.5}
            />
          );
        }),
      )}

      {restPts.length > 1 && (
        <polyline
          points={toPoly(restPts)}
          fill="none"
          stroke="hsl(150 60% 40%)"
          strokeWidth={6}
          strokeOpacity={0.45}
          strokeDasharray="10 8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {donePts.length > 1 && (
        <polyline
          points={toPoly(donePts)}
          fill="none"
          stroke="hsl(150 65% 38%)"
          strokeWidth={6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}

      {route.entrance && (() => {
        const c = cellCenter(store, route.entrance);
        return <circle cx={c.x} cy={c.y} r={7} fill="hsl(var(--primary))" stroke="white" strokeWidth={2} />;
      })()}

      {route.stops.map((stop, i) => {
        const c = cellCenter(store, stop.stand);
        const isActive = i === activeStop;
        const isDone = i < activeStop;
        return (
          <g
            key={i}
            onMouseEnter={() => onStopHover?.(i)}
            onMouseLeave={() => onStopHover?.(null)}
            style={{ cursor: onStopHover ? 'pointer' : undefined }}
          >
            <circle
              cx={c.x} cy={c.y}
              r={isActive ? 13 : 9}
              fill={isDone ? 'hsl(150 30% 55%)' : isActive ? 'hsl(150 70% 35%)' : 'white'}
              stroke="hsl(150 65% 30%)"
              strokeWidth={2.5}
            />
            <text
              x={c.x} y={c.y + 4}
              textAnchor="middle"
              fontSize={11}
              fontWeight="700"
              fill={isDone || isActive ? 'white' : 'hsl(150 65% 25%)'}
            >
              {i + 1}
            </text>
            {hoveredStop === i && (
              <foreignObject x={c.x + 12} y={c.y - 44} width={190} height={110} style={{ overflow: 'visible' }}>
                <div className="rounded-md border border-border bg-popover px-2 py-1.5 shadow-lg text-[11px] leading-tight">
                  <p className="font-semibold uppercase tracking-wide text-muted-foreground text-[9px]">
                    {stop.categoryName}
                  </p>
                  {stop.items.map((it) => (
                    <p key={it.id} className="text-foreground">• {it.name}</p>
                  ))}
                </div>
              </foreignObject>
            )}
          </g>
        );
      })}

      {route.checkout && (() => {
        const c = cellCenter(store, route.checkout);
        return (
          <circle cx={c.x} cy={c.y} r={9} fill="hsl(30 90% 50%)" stroke="white" strokeWidth={2} />
        );
      })()}
    </svg>
  );
}
