import { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, Pencil, Map, Star } from 'lucide-react';

export default function StoresPage() {
  const { stores, addStore, deleteStore, renameStore, defaultStoreId, setDefaultStore } = useAppStore();
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const navigate = useNavigate();

  const handleAdd = () => {
    if (!newName.trim()) return;
    addStore(newName.trim());
    setNewName('');
  };

  const handleRename = (id: string) => {
    if (!editName.trim()) return;
    renameStore(id, editName.trim());
    setEditingId(null);
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Magasins</h1>
        <p className="text-muted-foreground text-sm mt-1">Gérez vos magasins et leurs plans</p>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="Nouveau magasin..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          className="max-w-xs"
        />
        <Button onClick={handleAdd} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Ajouter
        </Button>
      </div>

      {stores.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Store className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Aucun magasin. Ajoutez-en un pour commencer !</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {stores.map((store) => (
            <Card key={store.id} className="group relative">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  {editingId === store.id ? (
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleRename(store.id)}
                      onBlur={() => handleRename(store.id)}
                      autoFocus
                      className="h-7 text-sm"
                    />
                  ) : (
                    <>
                      <span className="truncate">{store.name}</span>
                      {defaultStoreId === store.id && (
                        <Star className="h-3.5 w-3.5 text-primary fill-primary shrink-0" />
                      )}
                    </>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-center gap-2 pt-0">
                <span className="text-xs text-muted-foreground">
                  {store.cols}×{store.rows} cases
                </span>
                <div className="ml-auto flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    title="Magasin par défaut"
                    onClick={() => setDefaultStore(store.id)}
                  >
                    <Star className={`h-3.5 w-3.5 ${defaultStoreId === store.id ? 'text-primary fill-primary' : ''}`} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => { setEditingId(store.id); setEditName(store.name); }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => navigate(`/stores/${store.id}/plan`)}
                  >
                    <Map className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={() => deleteStore(store.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Store(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" />
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4" />
      <path d="M2 7h20" />
      <path d="M22 7v3a2 2 0 0 1-2 2a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7" />
    </svg>
  );
}
