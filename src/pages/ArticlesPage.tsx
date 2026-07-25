import { useState, useMemo } from 'react';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Package, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function ArticlesPage() {
  const { articles, categories, addArticle, updateArticle, deleteArticle } = useAppStore();
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState<string>('_none');
  const [search, setSearch] = useState('');

  const normalized = (s: string) => s.trim().toLowerCase();
  const isDuplicate = useMemo(
    () => name.trim() !== '' && articles.some((a) => normalized(a.name) === normalized(name)),
    [name, articles],
  );

  const handleAdd = () => {
    if (!name.trim()) return;
    if (isDuplicate) {
      toast.error('Cet article existe déjà');
      return;
    }
    addArticle(name.trim(), categoryId === '_none' ? undefined : categoryId);
    toast.success(`Article « ${name.trim()} » ajouté`);
    setName('');
    setCategoryId('_none');
  };

  const filtered = articles
    .filter((a) => a.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Articles</h1>
        <p className="text-muted-foreground text-sm mt-1">Catalogue de vos articles</p>
      </div>

      <div className="rounded-lg border border-border p-3 space-y-2 bg-card">
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[160px]">
            <label className="text-xs text-muted-foreground">Nom</label>
            <Input
              placeholder="ex: lait"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
          </div>
          <div className="w-[200px]">
            <label className="text-xs text-muted-foreground">Catégorie</label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger><SelectValue placeholder="Catégorie" /></SelectTrigger>
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
          <Button onClick={handleAdd} disabled={!name.trim() || isDuplicate}>
            <Plus className="h-4 w-4 mr-1" /> Ajouter
          </Button>
        </div>
        {isDuplicate && (
          <div className="flex items-center gap-2 text-xs text-destructive">
            <AlertTriangle className="h-3.5 w-3.5" />
            Un article portant ce nom existe déjà.
          </div>
        )}
      </div>

      <Input
        placeholder="Rechercher un article..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Aucun article.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {filtered.map((a) => {
            const cat = categories.find((c) => c.id === a.categoryId);
            return (
              <div key={a.id} className="flex items-center gap-2 rounded-lg border border-border p-2">
                <Input
                  value={a.name}
                  onChange={(e) => updateArticle(a.id, { name: e.target.value })}
                  className="h-7 text-sm flex-1"
                />
                <Select
                  value={a.categoryId || '_none'}
                  onValueChange={(v) => updateArticle(a.id, { categoryId: v === '_none' ? undefined : v })}
                >
                  <SelectTrigger className="h-7 text-xs w-[180px]">
                    <SelectValue placeholder="Catégorie">
                      {cat ? (
                        <span className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                          {cat.name}
                        </span>
                      ) : 'Sans catégorie'}
                    </SelectValue>
                  </SelectTrigger>
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
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive"
                  onClick={() => deleteArticle(a.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
