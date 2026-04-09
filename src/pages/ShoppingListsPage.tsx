import { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, ShoppingCart, ChevronRight } from 'lucide-react';

export default function ShoppingListsPage() {
  const { shoppingLists, stores, addShoppingList, deleteShoppingList, defaultStoreId } = useAppStore();
  const [newName, setNewName] = useState('');
  const [newStoreId, setNewStoreId] = useState(defaultStoreId || '');
  const navigate = useNavigate();

  const handleAdd = () => {
    if (!newName.trim() || !newStoreId) return;
    addShoppingList(newName.trim(), newStoreId);
    setNewName('');
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Listes de courses</h1>
        <p className="text-muted-foreground text-sm mt-1">Préparez vos courses</p>
      </div>

      <div className="flex flex-wrap gap-2 items-end">
        <Input
          placeholder="Nouvelle liste..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          className="max-w-[200px]"
        />
        <Select value={newStoreId} onValueChange={setNewStoreId}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Magasin" />
          </SelectTrigger>
          <SelectContent>
            {stores.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={handleAdd} size="sm" disabled={!newStoreId}>
          <Plus className="h-4 w-4 mr-1" /> Créer
        </Button>
      </div>

      {stores.length === 0 && (
        <p className="text-sm text-muted-foreground bg-accent/50 p-3 rounded-lg">
          Créez d'abord un magasin pour pouvoir ajouter une liste.
        </p>
      )}

      {shoppingLists.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Aucune liste de courses.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {shoppingLists.map((list) => {
            const store = stores.find((s) => s.id === list.storeId);
            const checked = list.items.filter((i) => i.checked).length;
            return (
              <Card
                key={list.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/lists/${list.id}`)}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span className="truncate">{list.name}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 flex items-center justify-between">
                  <div className="text-xs text-muted-foreground space-x-2">
                    <span>{store?.name || '?'}</span>
                    <span>·</span>
                    <span>{checked}/{list.items.length} articles</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={(e) => { e.stopPropagation(); deleteShoppingList(list.id); }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
