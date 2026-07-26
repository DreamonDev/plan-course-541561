import { useState, useMemo, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, ShoppingCart, StickyNote, ChevronDown, ChevronUp, Check, Star, Play } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

export default function ShoppingListsPage() {
  const {
    stores, articles, categories, shoppingLists, defaultStoreId,
    setDefaultStore, ensureListForStore, addItem, updateItem, deleteItem, toggleItem, addArticle,
  } = useAppStore();

  const navigate = useNavigate();
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [newCat, setNewCat] = useState<string>('_none');
  const [expanded, setExpanded] = useState<string | null>(null);

  // Pick default store on mount / when stores load
  useEffect(() => {
    if (selectedStoreId) return;
    const target = defaultStoreId || stores[0]?.id || '';
    if (target) setSelectedStoreId(target);
  }, [defaultStoreId, stores, selectedStoreId]);

  const store = stores.find((s) => s.id === selectedStoreId);
  const listId = useMemo(
    () => (store ? ensureListForStore(store.id) : null),
    [store, ensureListForStore, shoppingLists.length],
  );
  const list = shoppingLists.find((l) => l.id === listId);

  const trimmed = search.trim();
  const matching = trimmed
    ? articles.filter((a) => a.name.toLowerCase().includes(trimmed.toLowerCase())).slice(0, 8)
    : [];
  const exactMatch = articles.find((a) => a.name.toLowerCase() === trimmed.toLowerCase());
  const canCreate = trimmed.length > 0 && !exactMatch;

  const addExisting = (articleName: string, articleCategoryId?: string) => {
    if (!listId) return;
    addItem(listId, articleName);
    // Set category on the freshly added item
    const l = useAppStore.getState().shoppingLists.find((x) => x.id === listId);
    const it = l?.items[l.items.length - 1];
    if (it && articleCategoryId) updateItem(listId, it.id, { categoryId: articleCategoryId });
    setSearch('');
    setNewCat('_none');
    toast.success(`« ${articleName} » ajouté`);
  };

  const createAndAdd = () => {
    if (!listId || !trimmed) return;
    const cat = newCat === '_none' ? undefined : newCat;
    const article = addArticle(trimmed, cat);
    addExisting(article.name, article.categoryId);
  };

  if (stores.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p>Créez d'abord un magasin.</p>
      </div>
    );
  }

  const unchecked = list?.items.filter((i) => !i.checked) ?? [];
  const checkedItems = list?.items.filter((i) => i.checked) ?? [];

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <h1 className="text-2xl font-bold flex-1">Courses</h1>
        <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Magasin" />
          </SelectTrigger>
          <SelectContent>
            {stores.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant={defaultStoreId === selectedStoreId ? 'default' : 'outline'}
          size="icon"
          className="h-9 w-9"
          onClick={() => selectedStoreId && setDefaultStore(selectedStoreId)}
          title="Définir comme magasin par défaut"
        >
          <Star className="h-4 w-4" />
        </Button>
        <Button
          className="gap-1"
          disabled={!selectedStoreId || (list?.items.filter((i) => !i.checked).length ?? 0) === 0}
          onClick={() => navigate(`/run/${selectedStoreId}`)}
        >
          <Play className="h-4 w-4" /> Lancer course
        </Button>
      </div>

      <div className="rounded-lg border border-border p-3 space-y-2 bg-card">
        <Input
          placeholder="Rechercher ou ajouter un article..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {matching.length > 0 && (
          <div className="space-y-1">
            {matching.map((a) => {
              const cat = categories.find((c) => c.id === a.categoryId);
              return (
                <button
                  key={a.id}
                  onClick={() => addExisting(a.name, a.categoryId)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-accent text-left"
                >
                  <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="flex-1">{a.name}</span>
                  {cat && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                      style={{ backgroundColor: cat.color + '30', color: cat.color }}>
                      {cat.name}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
        {canCreate && (
          <div className="flex gap-2 items-end pt-1 border-t border-border">
            <div className="flex-1">
              <p className="text-xs text-muted-foreground mb-1">
                Nouvel article « {trimmed} »
              </p>
              <Select value={newCat} onValueChange={setNewCat}>
                <SelectTrigger className="h-8"><SelectValue placeholder="Catégorie" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Sans catégorie</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                        {c.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" onClick={createAndAdd}>
              <Plus className="h-4 w-4 mr-1" /> Ajouter
            </Button>
          </div>
        )}
      </div>

      {list && (
        <>
          <div className="space-y-1">
            {unchecked.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Liste vide.</p>
            )}
            {unchecked.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                listId={list.id}
                categories={categories}
                expanded={expanded === item.id}
                onToggleExpand={() => setExpanded(expanded === item.id ? null : item.id)}
                toggleItem={toggleItem}
                updateItem={updateItem}
                deleteItem={deleteItem}
              />
            ))}
          </div>

          {checkedItems.length > 0 && (
            <div className="space-y-1 pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <Check className="h-3 w-3" /> {checkedItems.length} article(s) coché(s)
              </p>
              {checkedItems.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  listId={list.id}
                  categories={categories}
                  expanded={expanded === item.id}
                  onToggleExpand={() => setExpanded(expanded === item.id ? null : item.id)}
                  toggleItem={toggleItem}
                  updateItem={updateItem}
                  deleteItem={deleteItem}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ItemRow({
  item, listId, categories, expanded, onToggleExpand, toggleItem, updateItem, deleteItem,
}: {
  item: { id: string; name: string; categoryId?: string; notes?: string; checked: boolean };
  listId: string;
  categories: { id: string; name: string; color: string }[];
  expanded: boolean;
  onToggleExpand: () => void;
  toggleItem: (listId: string, itemId: string) => void;
  updateItem: (listId: string, itemId: string, updates: Partial<{ name: string; categoryId?: string; notes?: string }>) => void;
  deleteItem: (listId: string, itemId: string) => void;
}) {
  const cat = categories.find((c) => c.id === item.categoryId);
  return (
    <div className={`rounded-lg border border-border p-2 transition-colors ${item.checked ? 'opacity-50' : ''}`}>
      <div className="flex items-center gap-2">
        <Checkbox checked={item.checked} onCheckedChange={() => toggleItem(listId, item.id)} />
        <span className={`text-sm flex-1 ${item.checked ? 'line-through' : ''}`}>{item.name}</span>
        {cat && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
            style={{ backgroundColor: cat.color + '30', color: cat.color }}>
            {cat.name}
          </span>
        )}
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onToggleExpand}>
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteItem(listId, item.id)}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
      {expanded && (
        <div className="mt-2 pl-6 space-y-2">
          <Select
            value={item.categoryId || '_none'}
            onValueChange={(v) => updateItem(listId, item.id, { categoryId: v === '_none' ? undefined : v })}
          >
            <SelectTrigger className="h-7 text-xs w-full">
              <SelectValue placeholder="Catégorie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">Sans catégorie</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full inline-block" style={{ backgroundColor: c.color }} />
                    {c.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative">
            <StickyNote className="absolute left-2 top-2 h-3 w-3 text-muted-foreground" />
            <Textarea
              placeholder="Notes..."
              value={item.notes || ''}
              onChange={(e) => updateItem(listId, item.id, { notes: e.target.value })}
              className="min-h-[60px] text-xs pl-7 resize-none"
            />
          </div>
        </div>
      )}
    </div>
  );
}
