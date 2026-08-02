import { externalSupabase as supabase } from '@/integrations/external-supabase/client';
import type { Store, Category, Article, ShoppingList, ShoppingItem } from '@/types';

export interface PersistedState {
  stores: Store[];
  categories: Category[];
  articles: Article[];
  shoppingLists: ShoppingList[];
  defaultStoreId: string | null;
}

export const SETTINGS_ID = 'default';

// ---------------------------------------------------------------- row types
interface StoreRow {
  id: string;
  name: string;
  rows: number;
  cols: number;
  col_widths: number[];
  row_heights: number[];
  cells: Store['cells'];
  entrance: Store['entrance'];
}
interface CategoryRow { id: string; name: string; color: string }
interface ArticleRow { id: string; name: string; category_id: string | null }
interface ListRow { id: string; name: string; store_id: string }
interface ItemRow {
  id: string;
  list_id: string;
  name: string;
  category_id: string | null;
  notes: string | null;
  checked: boolean;
  position: number;
}

// ------------------------------------------------------------- (de)mappers
const toStoreRow = (s: Store): StoreRow => ({
  id: s.id,
  name: s.name,
  rows: s.rows,
  cols: s.cols,
  col_widths: s.colWidths,
  row_heights: s.rowHeights,
  cells: s.cells,
  entrance: s.entrance,
});
const fromStoreRow = (r: StoreRow): Store => ({
  id: r.id,
  name: r.name,
  rows: r.rows,
  cols: r.cols,
  colWidths: r.col_widths ?? [],
  rowHeights: r.row_heights ?? [],
  cells: r.cells ?? [],
  entrance: r.entrance ?? null,
});

const toArticleRow = (a: Article): ArticleRow => ({
  id: a.id,
  name: a.name,
  category_id: a.categoryId ?? null,
});
const fromArticleRow = (r: ArticleRow): Article => ({
  id: r.id,
  name: r.name,
  categoryId: r.category_id ?? undefined,
});

const toItemRow = (i: ShoppingItem, listId: string, position: number): ItemRow => ({
  id: i.id,
  list_id: listId,
  name: i.name,
  category_id: i.categoryId ?? null,
  notes: i.notes ?? null,
  checked: i.checked,
  position,
});
const fromItemRow = (r: ItemRow): ShoppingItem => ({
  id: r.id,
  name: r.name,
  categoryId: r.category_id ?? undefined,
  notes: r.notes ?? undefined,
  checked: r.checked,
});

// ------------------------------------------------------------------- read
export async function loadAll(): Promise<PersistedState> {
  const [stores, categories, articles, lists, items, settings] = await Promise.all([
    supabase.from('stores').select('*').order('created_at', { ascending: true }),
    supabase.from('categories').select('*').order('created_at', { ascending: true }),
    supabase.from('articles').select('*').order('created_at', { ascending: true }),
    supabase.from('shopping_lists').select('*').order('created_at', { ascending: true }),
    supabase.from('shopping_items').select('*').order('position', { ascending: true }),
    supabase.from('app_settings').select('*').eq('id', SETTINGS_ID).maybeSingle(),
  ]);

  const err = stores.error || categories.error || articles.error || lists.error || items.error;
  if (err) throw err;

  const itemRows = (items.data ?? []) as ItemRow[];
  const shoppingLists: ShoppingList[] = ((lists.data ?? []) as ListRow[]).map((l) => ({
    id: l.id,
    name: l.name,
    storeId: l.store_id,
    items: itemRows.filter((i) => i.list_id === l.id).map(fromItemRow),
  }));

  return {
    stores: ((stores.data ?? []) as StoreRow[]).map(fromStoreRow),
    categories: ((categories.data ?? []) as CategoryRow[]).map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color,
    })),
    articles: ((articles.data ?? []) as ArticleRow[]).map(fromArticleRow),
    shoppingLists,
    defaultStoreId:
      (settings.data as { default_store_id: string | null } | null)?.default_store_id ?? null,
  };
}

export function isEmpty(state: PersistedState): boolean {
  return (
    state.stores.length === 0 &&
    state.categories.length === 0 &&
    state.articles.length === 0 &&
    state.shoppingLists.length === 0
  );
}

// ------------------------------------------------------------------ write
type Keyed = { id: string };

function diff<T extends Keyed>(prev: T[], next: T[]) {
  const prevMap = new Map(prev.map((x) => [x.id, x]));
  const nextMap = new Map(next.map((x) => [x.id, x]));
  const upserts = next.filter(
    (x) => JSON.stringify(prevMap.get(x.id)) !== JSON.stringify(x),
  );
  const deletes = prev.filter((x) => !nextMap.has(x.id)).map((x) => x.id);
  return { upserts, deletes };
}

async function applyTable<T extends Keyed>(table: string, prev: T[], next: T[]) {
  const { upserts, deletes } = diff(prev, next);
  if (deletes.length) {
    const { error } = await supabase.from(table).delete().in('id', deletes);
    if (error) console.error(`[db] delete ${table}`, error);
  }
  if (upserts.length) {
    const { error } = await supabase.from(table).upsert(upserts as never);
    if (error) console.error(`[db] upsert ${table}`, error);
  }
}

function flattenItems(lists: ShoppingList[]): ItemRow[] {
  return lists.flatMap((l) => l.items.map((i, idx) => toItemRow(i, l.id, idx)));
}

/** Persist the difference between two snapshots, table by table. */
export async function syncState(prev: PersistedState, next: PersistedState) {
  // Parents first (stores, categories), then children (articles, lists, items).
  await applyTable('stores', prev.stores.map(toStoreRow), next.stores.map(toStoreRow));
  await applyTable('categories', prev.categories, next.categories);
  await applyTable('articles', prev.articles.map(toArticleRow), next.articles.map(toArticleRow));
  await applyTable(
    'shopping_lists',
    prev.shoppingLists.map((l) => ({ id: l.id, name: l.name, store_id: l.storeId })),
    next.shoppingLists.map((l) => ({ id: l.id, name: l.name, store_id: l.storeId })),
  );
  await applyTable('shopping_items', flattenItems(prev.shoppingLists), flattenItems(next.shoppingLists));

  if (prev.defaultStoreId !== next.defaultStoreId) {
    const { error } = await supabase
      .from('app_settings')
      .upsert({ id: SETTINGS_ID, default_store_id: next.defaultStoreId });
    if (error) console.error('[db] upsert app_settings', error);
  }
}

/** Full write of a state into empty tables (used for the JSON → SQL migration). */
export async function insertAll(state: PersistedState) {
  await syncState(
    { stores: [], categories: [], articles: [], shoppingLists: [], defaultStoreId: null },
    state,
  );
  if (state.defaultStoreId) {
    await supabase
      .from('app_settings')
      .upsert({ id: SETTINGS_ID, default_store_id: state.defaultStoreId });
  }
}

/** Legacy single-JSON row, kept only as a migration source. */
export async function loadLegacyJson(): Promise<PersistedState | null> {
  const { data, error } = await supabase
    .from('app_state')
    .select('data')
    .eq('id', 'default')
    .maybeSingle();
  if (error || !data?.data) return null;
  const d = data.data as Partial<PersistedState>;
  const state: PersistedState = {
    stores: d.stores ?? [],
    categories: d.categories ?? [],
    articles: d.articles ?? [],
    shoppingLists: d.shoppingLists ?? [],
    defaultStoreId: d.defaultStoreId ?? null,
  };
  return isEmpty(state) ? null : state;
}

export function subscribeToChanges(onChange: () => void) {
  return supabase
    .channel('relational_sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'stores' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'articles' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'shopping_lists' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'shopping_items' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, onChange)
    .subscribe();
}
