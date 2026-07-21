import { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { HexColorPicker } from 'react-colorful';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Trash2, Pencil, Search } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

export default function CategoriesPage() {
  const { categories, addCategory, updateCategory, deleteCategory } = useAppStore();
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#3b9e7c');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [search, setSearch] = useState('');

  const handleAdd = () => {
    const name = newName.trim();
    if (!name) return;
    addCategory(name, newColor);
    toast.success('Catégorie ajoutée', {
      description: name,
    });
    setNewName('');
    setNewColor('#3b9e7c');
  };

  const filtered = categories.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Catégories</h1>
        <p className="text-muted-foreground text-sm mt-1">Organisez vos produits par rayon</p>
      </div>

      <div className="flex flex-wrap gap-2 items-end">
        <Input
          placeholder="Nouvelle catégorie..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          className="max-w-[200px]"
        />
        <Popover>
          <PopoverTrigger asChild>
            <button
              className="h-9 w-9 rounded-md border border-input shrink-0"
              style={{ backgroundColor: newColor }}
            />
          </PopoverTrigger>
          <PopoverContent className="w-auto p-3" align="start">
            <HexColorPicker color={newColor} onChange={setNewColor} />
          </PopoverContent>
        </Popover>
        <Button onClick={handleAdd} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Ajouter
        </Button>
      </div>

      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-center py-12 text-muted-foreground text-sm">
          {categories.length === 0 ? 'Aucune catégorie. Créez-en une !' : 'Aucun résultat.'}
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((cat) => (
            <Card key={cat.id} className="overflow-hidden">
              <CardContent className="p-3 flex items-center gap-3">
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      className="h-8 w-8 rounded-md shrink-0 border border-border"
                      style={{ backgroundColor: cat.color }}
                    />
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-3">
                    <HexColorPicker
                      color={cat.color}
                      onChange={(color) => updateCategory(cat.id, { color })}
                    />
                  </PopoverContent>
                </Popover>

                {editingId === cat.id ? (
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        updateCategory(cat.id, { name: editName.trim() || cat.name });
                        setEditingId(null);
                      }
                    }}
                    onBlur={() => {
                      updateCategory(cat.id, { name: editName.trim() || cat.name });
                      setEditingId(null);
                    }}
                    autoFocus
                    className="h-7 text-sm"
                  />
                ) : (
                  <span className="text-sm font-medium truncate flex-1">{cat.name}</span>
                )}

                <div className="flex items-center gap-0.5 ml-auto shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => { setEditingId(cat.id); setEditName(cat.name); }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={() => deleteCategory(cat.id)}
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
