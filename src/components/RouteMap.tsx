import { useMemo, type CSSProperties } from 'react';
import type { Store, Category, Cell, SubCell } from '@/types';
import { cellCenter, planSize, type ComputedRoute } from '@/lib/routing';

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
  style?: CSSProperties;
  /** viewBox restricted around the active stop (mobile zoom) */
  focus?: boolean;
}

interface Rect { x: number; y: number; w: number; h: number }

export function RouteMap({
  store, categories, route, activeStop, onStopHover, hoveredStop, className, style, focus,
}: Props) {
  const { width, height } = planSize(store);
  const catById = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c])),
    [categories],
  );

  const xs = useMemo(() => {
    const acc = [0];
    store.colWidths.forEach((w) => acc.push(acc[acc.length - 1] + w));
    return acc;
  }, [store.colWidths]);
  const ys = useMemo(() => {
    const acc = [0];
    store.rowHeights.forEach((h) => acc.push(acc[acc.length - 1] + h));
    return acc;
  }, [store.rowHeights]);

  /** Top-level blocks: merged cells become a single rect. */
  const blocks = useMemo(() => {
    const out: { key: string; rect: Rect; cell: Cell; row: number; col: number }[] = [];
    for (let r = 0; r < store.rows; r++) {
      for (let c = 0; c < store.cols; c++) {
        const cell = store.cells[r]?.[c];
        if (!cell || cell.merged) continue;
        const span = cell.mergeSpan ?? { rows: 1, cols: 1 };
        const endR = Math.min(r + span.rows, store.rows);
        const endC = Math.min(c + span.cols, store.cols);
        out.push({
          key: `${r}-${c}`,
          rect: {
            x: xs[c] ?? 0,
            y: ys[r] ?? 0,
            w: (xs[endC] ?? 0) - (xs[c] ?? 0),
            h: (ys[endR] ?? 0) - (ys[r] ?? 0),
          },
          cell,
          row: r,
          col: c,
        });
      }
    }
    return out;
  }, [store, xs, ys]);

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

  const renderLeaf = (
    node: Cell | SubCell,
    rect: Rect,
    key: string,
    isEntrance: boolean,
    opacity: number,
  ) => {
    const cat = node.categoryId ? catById[node.categoryId] : undefined;
    let fill = 'hsl(var(--card))';
    if (node.type === 'wall' && !cat) fill = 'hsl(var(--muted-foreground) / 0.5)';
    if (cat) fill = cat.color;
    if (node.type === 'checkout') fill = 'hsl(30 90% 55%)';
    if (isEntrance) fill = 'hsl(var(--primary))';
    const label = cat?.name ?? (node.type === 'checkout' ? 'Caisses' : isEntrance ? 'Entrée' : '');
    const fontSize = Math.max(6, Math.min(11, rect.h / 3.2, rect.w / (Math.max(4, label.length) * 0.42)));
    return (
      <g key={key} opacity={opacity}>
        <rect
          x={rect.x} y={rect.y} width={rect.w} height={rect.h}
          fill={fill}
          stroke="hsl(var(--border))"
          strokeWidth={0.5}
        />
        {label && rect.w > 14 && rect.h > 10 && (
          <foreignObject x={rect.x} y={rect.y} width={rect.w} height={rect.h}>
            <div
              style={{
                width: '100%', height: '100%', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                padding: 1, textAlign: 'center', lineHeight: 1.05,
                fontSize, fontWeight: 700, color: '#fff',
                overflow: 'hidden', wordBreak: 'break-word', hyphens: 'auto',
                textShadow: '0 1px 2px rgba(0,0,0,0.45)',
              }}
            >
              {label}
            </div>
          </foreignObject>
        )}
      </g>
    );
  };

  const renderNode = (
    node: Cell | SubCell,
    rect: Rect,
    key: string,
    isEntrance: boolean,
    opacity: number,
  ): JSX.Element[] => {
    if (node.split) {
      const [a, b] = node.split.children;
      const horizontal = node.split.direction === 'horizontal';
      const rectA: Rect = horizontal
        ? { ...rect, h: rect.h / 2 }
        : { ...rect, w: rect.w / 2 };
      const rectB: Rect = horizontal
        ? { ...rect, y: rect.y + rect.h / 2, h: rect.h / 2 }
        : { ...rect, x: rect.x + rect.w / 2, w: rect.w / 2 };
      return [
        ...renderNode(a, rectA, `${key}-0`, false, opacity),
        ...renderNode(b, rectB, `${key}-1`, false, opacity),
      ];
    }
    return [renderLeaf(node, rect, key, isEntrance, opacity)];
  };

  return (
    <svg
      className={className}
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid meet"
      style={{ transition: 'all 500ms cubic-bezier(0.4,0,0.2,1)', ...style }}
    >
      {blocks.flatMap((b) => {
        const isEntrance =
          !!store.entrance &&
          store.entrance.row >= b.row &&
          store.entrance.row < b.row + (b.cell.mergeSpan?.rows ?? 1) &&
          store.entrance.col >= b.col &&
          store.entrance.col < b.col + (b.cell.mergeSpan?.cols ?? 1);
        const active = route.stops[activeStop];
        const dim = focus && active ? (Math.abs(b.col - active.stand.col) > 6 ? 0.25 : 1) : 1;
        return renderNode(b.cell, b.rect, b.key, isEntrance, dim);
      })}

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
              r={isActive ? 12 : 8}
              fill={isDone ? 'hsl(150 30% 55%)' : isActive ? 'hsl(150 70% 35%)' : 'white'}
              stroke="hsl(150 65% 30%)"
              strokeWidth={2.5}
            />
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
