import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Plus, Trash2, ChevronDown, ChevronUp, StickyNote } from 'lucide-react';

export default function ShoppingListDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { shoppingLists, stores, categories, addItem, updateItem, deleteItem, toggleItem, updateShoppingList } = useAppStore();
  const list = shoppingLists.find((l) => l.id === id);
  const [newItem, setNewItem] = useState('');
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  if (!list) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p>Liste introuvable.</p>
        <Button variant="link" onClick={() => navigate('/lists')}>Retour</Button>
      </div>
    );
  }

  const store = stores.find((s) => s.id === list.storeId);

  const handleAdd = () => {
    if (!newItem.trim() || !id) return;
    addItem(id, newItem.trim());
    setNewItem('');
  };

  const unchecked = list.items.filter((i) => !i.checked);
  const checked = list.items.filter((i) => i.checked);

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/lists')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold truncate">{list.name}</h1>
          <p className="text-xs text-muted-foreground">{store?.name}</p>
        </div>
        <Select
          value={list.storeId}
          onValueChange={(v) => id && updateShoppingList(id, { storeId: v })}
        >
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {stores.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="Ajouter un article..."
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <Button onClick={handleAdd} size="sm">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-1">
        {unchecked.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            listId={list.id}
            categories={categories}
            expanded={expandedItem === item.id}
            onToggleExpand={() => setExpandedItem(expandedItem === item.id ? null : item.id)}
            toggleItem={toggleItem}
            updateItem={updateItem}
            deleteItem={deleteItem}
          />
        ))}
      </div>

      {checked.length > 0 && (
        <div className="space-y-1 pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground mb-1">{checked.length} article(s) coché(s)</p>
          {checked.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              listId={list.id}
              categories={categories}
              expanded={expandedItem === item.id}
              onToggleExpand={() => setExpandedItem(expandedItem === item.id ? null : item.id)}
              toggleItem={toggleItem}
              updateItem={updateItem}
              deleteItem={deleteItem}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ItemRow({
  item,
  listId,
  categories,
  expanded,
  onToggleExpand,
  toggleItem,
  updateItem,
  deleteItem,
}: {
  item: { id: string; name: string; categoryId?: string; notes?: string; checked: boolean };
  listId: string;
  categories: { id: string; name: string; color: string }[];
  expanded: boolean;
  onToggleExpand: () => void;
  toggleItem: (listId: string, itemId: string) => void;
  updateItem: (listId: string, itemId: string, updates: any) => void;
  deleteItem: (listId: string, itemId: string) => void;
}) {
  const cat = categories.find((c) => c.id === item.categoryId);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(item.name);

  return (
    <div className={`rounded-lg border border-border p-2 transition-colors ${item.checked ? 'opacity-50' : ''}`}>
      <div className="flex items-center gap-2">
        <Checkbox
          checked={item.checked}
          onCheckedChange={() => toggleItem(listId, item.id)}
        />
        {editing ? (
          <Input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                updateItem(listId, item.id, { name: editName.trim() || item.name });
                setEditing(false);
              }
            }}
            onBlur={() => { updateItem(listId, item.id, { name: editName.trim() || item.name }); setEditing(false); }}
            autoFocus
            className="h-7 text-sm flex-1"
          />
        ) : (
          <span
            className={`text-sm flex-1 cursor-pointer ${item.checked ? 'line-through' : ''}`}
            onDoubleClick={() => { setEditing(true); setEditName(item.name); }}
          >
            {item.name}
          </span>
        )}
        {cat && (
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
            style={{ backgroundColor: cat.color + '30', color: cat.color }}
          >
            {cat.name}
          </span>
        )}
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onToggleExpand}>
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-destructive"
          onClick={() => deleteItem(listId, item.id)}
        >
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
