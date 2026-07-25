export interface Store {
  id: string;
  name: string;
  rows: number;
  cols: number;
  colWidths: number[];
  rowHeights: number[];
  cells: Cell[][];
  entrance: { row: number; col: number } | null;
}

export interface Cell {
  type: 'empty' | 'wall' | 'aisle' | 'checkout';
  categoryId?: string;
  merged?: boolean;
  mergeParent?: { row: number; col: number };
  mergeSpan?: { rows: number; cols: number };
  split?: { direction: 'horizontal' | 'vertical'; children: [SubCell, SubCell] };
}

export interface SubCell {
  type: 'empty' | 'wall' | 'aisle' | 'checkout';
  categoryId?: string;
  split?: { direction: 'horizontal' | 'vertical'; children: [SubCell, SubCell] };
}

export interface Category {
  id: string;
  name: string;
  color: string;
}

export interface Article {
  id: string;
  name: string;
  categoryId?: string;
}

export interface ShoppingList {
  id: string;
  name: string;
  storeId: string;
  items: ShoppingItem[];
}

export interface ShoppingItem {
  id: string;
  name: string;
  categoryId?: string;
  notes?: string;
  checked: boolean;
}

export type EditorMode = 'select' | 'wall' | 'aisle' | 'entrance' | 'category' | 'split' | 'checkout' | 'erase';
