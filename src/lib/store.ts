import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import type { Store, Cell, SubCell, Category, ShoppingList, ShoppingItem, Article } from '@/types';

const CLOUD_ROW_ID = 'default';
const LOCAL_STORAGE_KEY = 'grocery-app-storage';

function createEmptyCell(): Cell {
  return { type: 'empty' };
}

// Repair merged flags: cells marked `merged: true` must be covered by a valid
// mergeSpan on some other cell. Orphaned merged cells (leftovers of partial
// re-merges) get reset so they render again.
function repairStoreCells(store: Store): Store {
  const rows = store.cells.length;
  const cols = rows > 0 ? store.cells[0].length : 0;
  const covered: ({ pr: number; pc: number } | null)[][] = Array.from(
    { length: rows },
    () => Array<{ pr: number; pc: number } | null>(cols).fill(null),
  );
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const span = store.cells[r]?.[c]?.mergeSpan;
      if (!span) continue;
      for (let rr = r; rr < Math.min(r + span.rows, rows); rr++) {
        for (let cc = c; cc < Math.min(c + span.cols, cols); cc++) {
          if (rr === r && cc === c) continue;
          covered[rr][cc] = { pr: r, pc: c };
        }
      }
    }
  }
  let dirty = false;
  const newCells = store.cells.map((row, r) =>
    row.map((cell, c) => {
      const cov = covered[r][c];
      if (cell.merged && !cov) {
        dirty = true;
        const { merged: _m, mergeParent: _p, mergeSpan: _s, ...rest } = cell;
        return rest as Cell;
      }
      if (cov && !cell.merged) {
        dirty = true;
        return { ...cell, merged: true, mergeParent: { row: cov.pr, col: cov.pc }, mergeSpan: undefined };
      }
      return cell;
    }),
  );
  return dirty ? { ...store, cells: newCells } : store;
}

function repairAllStores(stores: Store[]): Store[] {
  return stores.map(repairStoreCells);
}

function createGrid(rows: number, cols: number): Cell[][] {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => createEmptyCell())
  );
}

function updateAtPath(
  split: NonNullable<SubCell['split']>,
  path: (0 | 1)[],
  updater: (sub: SubCell) => SubCell,
): NonNullable<SubCell['split']> {
  const [head, ...rest] = path;
  const children = [split.children[0], split.children[1]] as [SubCell, SubCell];
  const target = children[head];
  if (rest.length === 0) {
    children[head] = updater(target);
  } else {
    if (!target.split) return split;
    children[head] = { ...target, split: updateAtPath(target.split, rest as (0 | 1)[], updater) };
  }
  return { ...split, children };
}



function createStore(name: string): Store {
  const rows = 5;
  const cols = 10;
  return {
    id: crypto.randomUUID(),
    name,
    rows,
    cols,
    colWidths: Array(cols).fill(60),
    rowHeights: Array(rows).fill(60),
    cells: createGrid(rows, cols),
    entrance: null,
  };
}

interface PersistedState {
  stores: Store[];
  categories: Category[];
  articles: Article[];
  shoppingLists: ShoppingList[];
  defaultStoreId: string | null;
}

interface AppState extends PersistedState {
  _loaded: boolean;
  _syncing: boolean;

  // Sync helpers
  hydrate: () => Promise<void>;
  importLocal: () => Promise<{ imported: boolean }>;

  // Stores
  addStore: (name: string) => void;
  updateStore: (id: string, updates: Partial<Omit<Store, 'id'>>) => void;
  deleteStore: (id: string) => void;
  renameStore: (id: string, name: string) => void;

  // Grid operations
  updateCell: (storeId: string, row: number, col: number, cell: Partial<Cell>) => void;
  setEntrance: (storeId: string, row: number, col: number) => void;
  addRow: (storeId: string) => void;
  removeRow: (storeId: string) => void;
  addCol: (storeId: string) => void;
  removeCol: (storeId: string) => void;
  updateColWidth: (storeId: string, col: number, width: number) => void;
  updateRowHeight: (storeId: string, row: number, height: number) => void;
  mergeCells: (storeId: string, startRow: number, startCol: number, endRow: number, endCol: number) => void;
  unmergeCells: (storeId: string, row: number, col: number) => void;
  splitCell: (storeId: string, row: number, col: number, direction: 'horizontal' | 'vertical') => void;
  unsplitCell: (storeId: string, row: number, col: number) => void;
  updateSubCell: (storeId: string, row: number, col: number, subIndex: 0 | 1, update: Partial<SubCell>) => void;
  updateSubCellPath: (storeId: string, row: number, col: number, path: (0 | 1)[], update: Partial<SubCell>) => void;
  splitSubCellPath: (storeId: string, row: number, col: number, path: (0 | 1)[], direction: 'horizontal' | 'vertical') => void;

  // Categories
  addCategory: (name: string, color: string) => void;
  updateCategory: (id: string, updates: Partial<Omit<Category, 'id'>>) => void;
  deleteCategory: (id: string) => void;

  // Shopping Lists
  addShoppingList: (name: string, storeId: string) => void;
  updateShoppingList: (id: string, updates: Partial<Omit<ShoppingList, 'id' | 'items'>>) => void;
  deleteShoppingList: (id: string) => void;
  setDefaultStore: (storeId: string) => void;

  // Shopping Items
  addItem: (listId: string, name: string) => void;
  updateItem: (listId: string, itemId: string, updates: Partial<Omit<ShoppingItem, 'id'>>) => void;
  deleteItem: (listId: string, itemId: string) => void;
  toggleItem: (listId: string, itemId: string) => void;
}

function extractPersisted(s: AppState): PersistedState {
  return {
    stores: s.stores,
    categories: s.categories,
    shoppingLists: s.shoppingLists,
    defaultStoreId: s.defaultStoreId,
  };
}

// ---- Cloud sync ---------------------------------------------------------
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let lastSavedJson = '';
let applyingRemote = false;

async function saveToCloud(state: PersistedState) {
  const payload = JSON.parse(JSON.stringify(state));
  const json = JSON.stringify(payload);
  if (json === lastSavedJson) return;
  lastSavedJson = json;
  const { error } = await supabase
    .from('app_state')
    .upsert({ id: CLOUD_ROW_ID, data: payload, updated_at: new Date().toISOString() });
  if (error) console.error('[cloud sync] save failed', error);
}

function scheduleSave(state: PersistedState) {
  if (applyingRemote) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveToCloud(state), 400);
}

// -------------------------------------------------------------------------

export const useAppStore = create<AppState>()((set, get) => ({
  stores: [],
  categories: [],
  shoppingLists: [],
  defaultStoreId: null,
  _loaded: false,
  _syncing: false,

  hydrate: async () => {
    if (get()._loaded) return;
    set({ _syncing: true });
    const { data, error } = await supabase
      .from('app_state')
      .select('data')
      .eq('id', CLOUD_ROW_ID)
      .maybeSingle();

    if (error) {
      console.error('[cloud sync] load failed', error);
    }

    const cloud = (data?.data ?? {}) as Partial<PersistedState>;
    const hasCloudData =
      (cloud.stores?.length ?? 0) > 0 ||
      (cloud.categories?.length ?? 0) > 0 ||
      (cloud.shoppingLists?.length ?? 0) > 0;

    if (hasCloudData) {
      applyingRemote = true;
      set({
        stores: repairAllStores(cloud.stores ?? []),
        categories: cloud.categories ?? [],
        shoppingLists: cloud.shoppingLists ?? [],
        defaultStoreId: cloud.defaultStoreId ?? null,
        _loaded: true,
        _syncing: false,
      });
      lastSavedJson = JSON.stringify(extractPersisted(get()));
      applyingRemote = false;
    } else {
      // Cloud empty — try importing from localStorage automatically
      const local = readLocalStorage();
      if (local) {
        applyingRemote = true;
        set({
          stores: local.stores ?? [],
          categories: local.categories ?? [],
          shoppingLists: local.shoppingLists ?? [],
          defaultStoreId: local.defaultStoreId ?? null,
          _loaded: true,
          _syncing: false,
        });
        applyingRemote = false;
        // push to cloud
        await saveToCloud(extractPersisted(get()));
      } else {
        set({ _loaded: true, _syncing: false });
        lastSavedJson = JSON.stringify(extractPersisted(get()));
      }
    }

    // Realtime subscription for cross-device sync
    supabase
      .channel('app_state_sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_state', filter: `id=eq.${CLOUD_ROW_ID}` },
        (payload) => {
          const newRow = payload.new as { data?: PersistedState } | null;
          if (!newRow?.data) return;
          const incoming = JSON.stringify(newRow.data);
          if (incoming === lastSavedJson) return; // our own write
          applyingRemote = true;
          set({
            stores: repairAllStores(newRow.data.stores ?? []),
            categories: newRow.data.categories ?? [],
            shoppingLists: newRow.data.shoppingLists ?? [],
            defaultStoreId: newRow.data.defaultStoreId ?? null,
          });
          lastSavedJson = incoming;
          applyingRemote = false;
        }
      )
      .subscribe();
  },

  importLocal: async () => {
    const local = readLocalStorage();
    if (!local) return { imported: false };
    const current = get();
    // Merge: append local items that don't exist
    const merged: PersistedState = {
      stores: [...current.stores, ...(local.stores ?? []).filter((s) => !current.stores.some((cs) => cs.id === s.id))],
      categories: [...current.categories, ...(local.categories ?? []).filter((c) => !current.categories.some((cc) => cc.id === c.id))],
      shoppingLists: [...current.shoppingLists, ...(local.shoppingLists ?? []).filter((l) => !current.shoppingLists.some((cl) => cl.id === l.id))],
      defaultStoreId: current.defaultStoreId ?? local.defaultStoreId ?? null,
    };
    set(merged);
    await saveToCloud(merged);
    return { imported: true };
  },

  addStore: (name) =>
    set((s) => ({ stores: [...s.stores, createStore(name)] })),

  updateStore: (id, updates) =>
    set((s) => ({
      stores: s.stores.map((st) => (st.id === id ? { ...st, ...updates } : st)),
    })),

  deleteStore: (id) =>
    set((s) => ({
      stores: s.stores.filter((st) => st.id !== id),
      defaultStoreId: s.defaultStoreId === id ? null : s.defaultStoreId,
    })),

  renameStore: (id, name) =>
    set((s) => ({
      stores: s.stores.map((st) => (st.id === id ? { ...st, name } : st)),
    })),

  updateCell: (storeId, row, col, cellUpdate) =>
    set((s) => ({
      stores: s.stores.map((st) => {
        if (st.id !== storeId) return st;
        const cells = st.cells.map((r) => r.map((c) => ({ ...c })));
        cells[row][col] = { ...cells[row][col], ...cellUpdate };
        return { ...st, cells };
      }),
    })),

  setEntrance: (storeId, row, col) =>
    set((s) => ({
      stores: s.stores.map((st) =>
        st.id === storeId ? { ...st, entrance: { row, col } } : st
      ),
    })),

  addRow: (storeId) =>
    set((s) => ({
      stores: s.stores.map((st) => {
        if (st.id !== storeId) return st;
        const newRow = Array.from({ length: st.cols }, () => createEmptyCell());
        return {
          ...st,
          rows: st.rows + 1,
          cells: [...st.cells, newRow],
          rowHeights: [...st.rowHeights, 60],
        };
      }),
    })),

  removeRow: (storeId) =>
    set((s) => ({
      stores: s.stores.map((st) => {
        if (st.id !== storeId || st.rows <= 1) return st;
        return {
          ...st,
          rows: st.rows - 1,
          cells: st.cells.slice(0, -1),
          rowHeights: st.rowHeights.slice(0, -1),
        };
      }),
    })),

  addCol: (storeId) =>
    set((s) => ({
      stores: s.stores.map((st) => {
        if (st.id !== storeId) return st;
        return {
          ...st,
          cols: st.cols + 1,
          cells: st.cells.map((row) => [...row, createEmptyCell()]),
          colWidths: [...st.colWidths, 60],
        };
      }),
    })),

  removeCol: (storeId) =>
    set((s) => ({
      stores: s.stores.map((st) => {
        if (st.id !== storeId || st.cols <= 1) return st;
        return {
          ...st,
          cols: st.cols - 1,
          cells: st.cells.map((row) => row.slice(0, -1)),
          colWidths: st.colWidths.slice(0, -1),
        };
      }),
    })),

  updateColWidth: (storeId, col, width) =>
    set((s) => ({
      stores: s.stores.map((st) => {
        if (st.id !== storeId) return st;
        const colWidths = [...st.colWidths];
        colWidths[col] = Math.max(20, width);
        return { ...st, colWidths };
      }),
    })),

  updateRowHeight: (storeId, row, height) =>
    set((s) => ({
      stores: s.stores.map((st) => {
        if (st.id !== storeId) return st;
        const rowHeights = [...st.rowHeights];
        rowHeights[row] = Math.max(20, height);
        return { ...st, rowHeights };
      }),
    })),

  mergeCells: (storeId, startRow, startCol, endRow, endCol) =>
    set((s) => ({
      stores: s.stores.map((st) => {
        if (st.id !== storeId) return st;
        const cells = st.cells.map((r) => r.map((c) => ({ ...c })));
        const rMin = Math.min(startRow, endRow);
        const rMax = Math.max(startRow, endRow);
        const cMin = Math.min(startCol, endCol);
        const cMax = Math.max(startCol, endCol);
        cells[rMin][cMin] = {
          ...cells[rMin][cMin],
          mergeSpan: { rows: rMax - rMin + 1, cols: cMax - cMin + 1 },
          merged: false,
        };
        for (let r = rMin; r <= rMax; r++) {
          for (let c = cMin; c <= cMax; c++) {
            if (r === rMin && c === cMin) continue;
            cells[r][c] = {
              ...cells[r][c],
              merged: true,
              mergeParent: { row: rMin, col: cMin },
              mergeSpan: undefined,
            };
          }
        }
        return { ...st, cells };
      }),
    })),

  unmergeCells: (storeId, row, col) =>
    set((s) => ({
      stores: s.stores.map((st) => {
        if (st.id !== storeId) return st;
        const cells = st.cells.map((r) => r.map((c) => ({ ...c })));
        const span = cells[row][col].mergeSpan;
        if (!span) return st;
        for (let r = row; r < row + span.rows; r++) {
          for (let c = col; c < col + span.cols; c++) {
            cells[r][c] = { type: cells[row][col].type, categoryId: cells[row][col].categoryId };
          }
        }
        return { ...st, cells };
      }),
    })),

  splitCell: (storeId, row, col, direction) =>
    set((s) => ({
      stores: s.stores.map((st) => {
        if (st.id !== storeId) return st;
        const cells = st.cells.map((r) => r.map((c) => ({ ...c })));
        const src = cells[row][col];
        const base: SubCell = { type: src.type, categoryId: src.categoryId };
        cells[row][col] = {
          ...src,
          type: 'empty',
          categoryId: undefined,
          split: { direction, children: [base, { type: 'empty' }] },
        };
        return { ...st, cells };
      }),
    })),

  unsplitCell: (storeId, row, col) =>
    set((s) => ({
      stores: s.stores.map((st) => {
        if (st.id !== storeId) return st;
        const cells = st.cells.map((r) => r.map((c) => ({ ...c })));
        const src = cells[row][col];
        if (!src.split) return st;
        const first = src.split.children[0];
        cells[row][col] = { ...src, split: undefined, type: first.type, categoryId: first.categoryId };
        return { ...st, cells };
      }),
    })),

  updateSubCell: (storeId, row, col, subIndex, update) =>
    set((s) => ({
      stores: s.stores.map((st) => {
        if (st.id !== storeId) return st;
        const cells = st.cells.map((r) => r.map((c) => ({ ...c })));
        const src = cells[row][col];
        if (!src.split) return st;
        const children = [...src.split.children] as [SubCell, SubCell];
        children[subIndex] = { ...children[subIndex], ...update };
        cells[row][col] = { ...src, split: { ...src.split, children } };
        return { ...st, cells };
      }),
    })),

  updateSubCellPath: (storeId, row, col, path, update) =>
    set((s) => ({
      stores: s.stores.map((st) => {
        if (st.id !== storeId) return st;
        const cells = st.cells.map((r) => r.map((c) => ({ ...c })));
        const src = cells[row][col];
        if (!src.split || path.length === 0) return st;
        const newSplit = updateAtPath(src.split, path, (sub) => ({ ...sub, ...update }));
        cells[row][col] = { ...src, split: newSplit };
        return { ...st, cells };
      }),
    })),

  splitSubCellPath: (storeId, row, col, path, direction) =>
    set((s) => ({
      stores: s.stores.map((st) => {
        if (st.id !== storeId) return st;
        const cells = st.cells.map((r) => r.map((c) => ({ ...c })));
        const src = cells[row][col];
        if (!src.split || path.length === 0) return st;
        const newSplit = updateAtPath(src.split, path, (sub) => ({
          type: 'empty',
          categoryId: undefined,
          split: { direction, children: [{ type: sub.type, categoryId: sub.categoryId }, { type: 'empty' }] },
        }));
        cells[row][col] = { ...src, split: newSplit };
        return { ...st, cells };
      }),
    })),

  addCategory: (name, color) =>
    set((s) => ({
      categories: [...s.categories, { id: crypto.randomUUID(), name, color }],
    })),

  updateCategory: (id, updates) =>
    set((s) => ({
      categories: s.categories.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    })),

  deleteCategory: (id) =>
    set((s) => ({
      categories: s.categories.filter((c) => c.id !== id),
    })),

  addShoppingList: (name, storeId) =>
    set((s) => ({
      shoppingLists: [
        ...s.shoppingLists,
        { id: crypto.randomUUID(), name, storeId, items: [] },
      ],
    })),

  updateShoppingList: (id, updates) =>
    set((s) => ({
      shoppingLists: s.shoppingLists.map((l) =>
        l.id === id ? { ...l, ...updates } : l
      ),
    })),

  deleteShoppingList: (id) =>
    set((s) => ({
      shoppingLists: s.shoppingLists.filter((l) => l.id !== id),
    })),

  setDefaultStore: (storeId) => set({ defaultStoreId: storeId }),

  addItem: (listId, name) =>
    set((s) => ({
      shoppingLists: s.shoppingLists.map((l) =>
        l.id === listId
          ? {
              ...l,
              items: [
                ...l.items,
                { id: crypto.randomUUID(), name, checked: false },
              ],
            }
          : l
      ),
    })),

  updateItem: (listId, itemId, updates) =>
    set((s) => ({
      shoppingLists: s.shoppingLists.map((l) =>
        l.id === listId
          ? {
              ...l,
              items: l.items.map((i) =>
                i.id === itemId ? { ...i, ...updates } : i
              ),
            }
          : l
      ),
    })),

  deleteItem: (listId, itemId) =>
    set((s) => ({
      shoppingLists: s.shoppingLists.map((l) =>
        l.id === listId
          ? { ...l, items: l.items.filter((i) => i.id !== itemId) }
          : l
      ),
    })),

  toggleItem: (listId, itemId) =>
    set((s) => ({
      shoppingLists: s.shoppingLists.map((l) =>
        l.id === listId
          ? {
              ...l,
              items: l.items.map((i) =>
                i.id === itemId ? { ...i, checked: !i.checked } : i
              ),
            }
          : l
      ),
    })),
}));

function readLocalStorage(): PersistedState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // zustand persist stores state under `state`
    const s = parsed?.state ?? parsed;
    if (!s || typeof s !== 'object') return null;
    const hasAny =
      (s.stores?.length ?? 0) > 0 ||
      (s.categories?.length ?? 0) > 0 ||
      (s.shoppingLists?.length ?? 0) > 0;
    if (!hasAny) return null;
    return {
      stores: s.stores ?? [],
      categories: s.categories ?? [],
      shoppingLists: s.shoppingLists ?? [],
      defaultStoreId: s.defaultStoreId ?? null,
    };
  } catch {
    return null;
  }
}

// Auto-save subscription
useAppStore.subscribe((state, prev) => {
  if (!state._loaded) return;
  // Only save if persisted slice changed
  const a = extractPersisted(state);
  const b = extractPersisted(prev);
  if (JSON.stringify(a) === JSON.stringify(b)) return;
  scheduleSave(a);
});

// Kick off hydration on module load
if (typeof window !== 'undefined') {
  useAppStore.getState().hydrate();
}
