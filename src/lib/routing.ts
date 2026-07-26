import type { Store, Cell, SubCell, ShoppingItem } from '@/types';

export interface ResolvedCell {
  row: number;
  col: number;
  types: Set<SubCell['type']>;
  categoryIds: string[];
  walkable: boolean;
  cost: number;
}

function collectLeaves(sub: SubCell, out: SubCell[]) {
  if (sub.split) {
    collectLeaves(sub.split.children[0], out);
    collectLeaves(sub.split.children[1], out);
  } else {
    out.push(sub);
  }
}

function cellLeaves(cell: Cell): SubCell[] {
  if (cell.split) {
    const out: SubCell[] = [];
    collectLeaves(cell.split.children[0], out);
    collectLeaves(cell.split.children[1], out);
    return out;
  }
  return [{ type: cell.type, categoryId: cell.categoryId }];
}

/** Flatten merges/splits into a simple per-grid-cell description. */
export function resolveGrid(store: Store): ResolvedCell[][] {
  const rows = store.rows;
  const cols = store.cols;
  // source cell for every position (merged children point to their parent)
  const source: Cell[][] = store.cells.map((r) => r.map((c) => c));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = store.cells[r]?.[c];
      if (!cell) continue;
      const span = cell.mergeSpan;
      if (!span) continue;
      for (let rr = r; rr < Math.min(r + span.rows, rows); rr++) {
        for (let cc = c; cc < Math.min(c + span.cols, cols); cc++) {
          source[rr][cc] = cell;
        }
      }
    }
  }

  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => {
      const cell = source[r]?.[c] ?? { type: 'empty' as const };
      const leaves = cellLeaves(cell);
      const types = new Set(leaves.map((l) => l.type));
      const categoryIds = Array.from(
        new Set(leaves.map((l) => l.categoryId).filter(Boolean) as string[]),
      );
      const isEntrance = store.entrance?.row === r && store.entrance?.col === c;
      const hasAisle = types.has('aisle');
      const hasEmpty = types.has('empty') && categoryIds.length === 0;
      const walkable = isEntrance || hasAisle || types.has('checkout') || hasEmpty;
      const cost = hasAisle || isEntrance || types.has('checkout') ? 1 : 6;
      return { row: r, col: c, types, categoryIds, walkable, cost };
    }),
  );
}

export interface Point { row: number; col: number }

/** Dijkstra (small weights) over walkable cells. */
function shortestPath(grid: ResolvedCell[][], from: Point, to: Point): Point[] | null {
  const rows = grid.length;
  const cols = rows ? grid[0].length : 0;
  const key = (r: number, c: number) => r * cols + c;
  const dist = new Map<number, number>();
  const prev = new Map<number, number>();
  const queue: { r: number; c: number; d: number }[] = [{ r: from.row, c: from.col, d: 0 }];
  dist.set(key(from.row, from.col), 0);

  while (queue.length) {
    queue.sort((a, b) => a.d - b.d);
    const cur = queue.shift()!;
    const ck = key(cur.r, cur.c);
    if (cur.d > (dist.get(ck) ?? Infinity)) continue;
    if (cur.r === to.row && cur.c === to.col) break;
    const neighbours: [number, number][] = [
      [cur.r - 1, cur.c], [cur.r + 1, cur.c], [cur.r, cur.c - 1], [cur.r, cur.c + 1],
    ];
    for (const [nr, nc] of neighbours) {
      if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
      const cell = grid[nr][nc];
      const isTarget = nr === to.row && nc === to.col;
      if (!cell.walkable && !isTarget) continue;
      const nd = cur.d + cell.cost;
      const nk = key(nr, nc);
      if (nd < (dist.get(nk) ?? Infinity)) {
        dist.set(nk, nd);
        prev.set(nk, ck);
        queue.push({ r: nr, c: nc, d: nd });
      }
    }
  }

  const endKey = key(to.row, to.col);
  if (!dist.has(endKey)) return null;
  const path: Point[] = [];
  let k: number | undefined = endKey;
  while (k !== undefined) {
    path.unshift({ row: Math.floor(k / cols), col: k % cols });
    k = prev.get(k);
  }
  return path;
}

export interface RouteStop {
  categoryId?: string;
  categoryName: string;
  /** shelf cell to point at */
  target: Point;
  /** walkable cell where the shopper stands */
  stand: Point;
  items: ShoppingItem[];
}

export interface ComputedRoute {
  stops: RouteStop[];
  /** full path from entrance through all stops to checkout */
  path: Point[];
  /** index in `path` of each stop's stand cell */
  stopPathIndex: number[];
  entrance: Point | null;
  checkout: Point | null;
  unreachable: RouteStop[];
}

function findWalkableNeighbour(grid: ResolvedCell[][], p: Point): Point | null {
  const rows = grid.length;
  const cols = rows ? grid[0].length : 0;
  if (grid[p.row]?.[p.col]?.walkable) return p;
  const deltas: [number, number][] = [[0, 1], [0, -1], [-1, 0], [1, 0]];
  for (const [dr, dc] of deltas) {
    const nr = p.row + dr;
    const nc = p.col + dc;
    if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
    if (grid[nr][nc].walkable) return { row: nr, col: nc };
  }
  return null;
}

export function computeRoute(
  store: Store,
  items: ShoppingItem[],
  categories: { id: string; name: string }[],
): ComputedRoute {
  const grid = resolveGrid(store);
  const rows = grid.length;
  const cols = rows ? grid[0].length : 0;

  // group items by category
  const byCat = new Map<string, ShoppingItem[]>();
  for (const item of items) {
    const k = item.categoryId ?? '_none';
    byCat.set(k, [...(byCat.get(k) ?? []), item]);
  }

  // locate every category on the map
  const catCells = new Map<string, Point[]>();
  let checkout: Point | null = null;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = grid[r][c];
      for (const id of cell.categoryIds) {
        catCells.set(id, [...(catCells.get(id) ?? []), { row: r, col: c }]);
      }
      if (cell.types.has('checkout') && !checkout) checkout = { row: r, col: c };
    }
  }

  const entrance = store.entrance ? { row: store.entrance.row, col: store.entrance.col } : null;

  const rawStops: RouteStop[] = [];
  const unreachable: RouteStop[] = [];
  for (const [catId, catItems] of byCat) {
    const name = categories.find((c) => c.id === catId)?.name ?? 'Sans catégorie';
    const cells = catCells.get(catId) ?? [];
    // pick the right-most cell of that category (course goes right → left)
    const target = cells.slice().sort((a, b) => b.col - a.col || a.row - b.row)[0];
    const stand = target ? findWalkableNeighbour(grid, target) : null;
    const stop: RouteStop = {
      categoryId: catId === '_none' ? undefined : catId,
      categoryName: name,
      target: target ?? { row: 0, col: 0 },
      stand: stand ?? { row: 0, col: 0 },
      items: catItems,
    };
    if (!target || !stand) unreachable.push(stop);
    else rawStops.push(stop);
  }

  // Serpentine ordering: columns right → left, alternating vertical direction.
  const colGroups = new Map<number, RouteStop[]>();
  for (const s of rawStops) {
    colGroups.set(s.stand.col, [...(colGroups.get(s.stand.col) ?? []), s]);
  }
  const orderedCols = Array.from(colGroups.keys()).sort((a, b) => b - a);
  const stops: RouteStop[] = [];
  orderedCols.forEach((col, i) => {
    const group = colGroups.get(col)!.slice();
    group.sort((a, b) => (i % 2 === 0 ? a.stand.row - b.stand.row : b.stand.row - a.stand.row));
    stops.push(...group);
  });

  // Build the full path
  const path: Point[] = [];
  const stopPathIndex: number[] = [];
  const waypoints: Point[] = [];
  const start = entrance ?? stops[0]?.stand ?? null;
  if (start) waypoints.push(start);
  stops.forEach((s) => waypoints.push(s.stand));
  if (checkout) waypoints.push(checkout);

  for (let i = 0; i < waypoints.length; i++) {
    if (i === 0) {
      path.push(waypoints[0]);
    } else {
      const seg = shortestPath(grid, waypoints[i - 1], waypoints[i]);
      if (seg) path.push(...seg.slice(1));
      else path.push(waypoints[i]);
    }
    const stopIdx = entrance ? i - 1 : i;
    if (stopIdx >= 0 && stopIdx < stops.length) stopPathIndex[stopIdx] = path.length - 1;
  }

  return { stops, path, stopPathIndex, entrance, checkout, unreachable };
}

/** Pixel geometry helpers */
export function cellRect(store: Store, p: Point) {
  const x = store.colWidths.slice(0, p.col).reduce((a, b) => a + b, 0);
  const y = store.rowHeights.slice(0, p.row).reduce((a, b) => a + b, 0);
  return { x, y, w: store.colWidths[p.col] ?? 60, h: store.rowHeights[p.row] ?? 60 };
}

export function cellCenter(store: Store, p: Point) {
  const r = cellRect(store, p);
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

export function planSize(store: Store) {
  return {
    width: store.colWidths.reduce((a, b) => a + b, 0),
    height: store.rowHeights.reduce((a, b) => a + b, 0),
  };
}
