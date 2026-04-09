import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Store, Cell, Category, ShoppingList, ShoppingItem } from '@/types';

function createEmptyCell(): Cell {
  return { type: 'empty' };
}

function createGrid(rows: number, cols: number): Cell[][] {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => createEmptyCell())
  );
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

interface AppState {
  stores: Store[];
  categories: Category[];
  shoppingLists: ShoppingList[];
  defaultStoreId: string | null;

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

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      stores: [],
      categories: [],
      shoppingLists: [],
      defaultStoreId: null,

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
            // Set parent
            cells[rMin][cMin] = {
              ...cells[rMin][cMin],
              mergeSpan: { rows: rMax - rMin + 1, cols: cMax - cMin + 1 },
              merged: false,
            };
            // Mark children
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

      // Categories
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

      // Shopping Lists
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

      // Items
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
    }),
    { name: 'grocery-app-storage' }
  )
);
