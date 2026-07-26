import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppStore } from '@/lib/store';
import { computeRoute } from '@/lib/routing';
import { RouteMap } from '@/components/RouteMap';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useIsMobile } from '@/hooks/use-mobile';
import { X, Check, SkipForward, ChevronLeft, Flag, MapPin, AlertTriangle } from 'lucide-react';

export default function RoutePage() {
  const { storeId } = useParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { stores, categories, shoppingLists, updateItem } = useAppStore();

  const store = stores.find((s) => s.id === storeId);
  const list = shoppingLists.find((l) => l.storeId === storeId);
  const pending = useMemo(() => list?.items.filter((i) => !i.checked) ?? [], [list]);

  const route = useMemo(
    () => (store ? computeRoute(store, pending, categories) : null),
    [store, pending, categories],
  );

  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState<number | null>(null);

  if (!store || !route) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Magasin introuvable.
        <div className="mt-4"><Button onClick={() => navigate('/lists')}>Retour</Button></div>
      </div>
    );
  }

  const total = route.stops.length;
  const finished = index >= total;
  const current = route.stops[index];
  const next = route.stops[index + 1];

  const validate = (done: boolean) => {
    if (current && done && list) {
      current.items.forEach((it) => updateItem(list.id, it.id, { checked: true }));
    }
    setIndex((i) => Math.min(i + 1, total));
  };

  // ---------- Desktop ----------
  if (!isMobile) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => navigate('/lists')}>
            <X className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Parcours — {store.name}</h1>
            <p className="text-sm text-muted-foreground">
              {total} arrêt{total > 1 ? 's' : ''} · {pending.length} article{pending.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {route.unreachable.length > 0 && (
          <div className="flex items-start gap-2 rounded-md border border-border bg-muted/50 p-3 text-sm">
            <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-500 shrink-0" />
            <span>
              Non placés sur le plan :{' '}
              {route.unreachable.map((u) => u.categoryName).join(', ')}
            </span>
          </div>
        )}

        <div className="grid grid-cols-[1fr_260px] gap-4">
          <div className="rounded-lg border border-border bg-card p-2 overflow-auto">
            <RouteMap
              store={store}
              categories={categories}
              route={route}
              activeStop={index}
              hoveredStop={hovered}
              onStopHover={setHovered}
              className="w-full h-auto"
            />
          </div>
          <div className="space-y-1 overflow-auto max-h-[75vh]">
            {route.stops.map((stop, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                className={`w-full text-left rounded-md border p-2 text-sm transition-colors ${
                  i === index ? 'border-primary bg-accent' : 'border-border hover:bg-accent/50'
                }`}
              >
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {i + 1}. {stop.categoryName}
                </p>
                {stop.items.map((it) => (
                  <p key={it.id} className="font-medium">{it.name}</p>
                ))}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ---------- Mobile ----------
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center gap-3 px-4 pt-3 pb-2 shrink-0">
        <div className="flex-1">
          <p className="text-xs text-muted-foreground mb-1">
            {finished ? 'Parcours terminé' : `Arrêt ${index + 1} / ${total}`}
          </p>
          <Progress value={total ? (index / total) * 100 : 100} className="h-1.5" />
        </div>
        <Button variant="ghost" size="icon" onClick={() => navigate('/lists')}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex-1 min-h-0 px-3">
        <div className="h-full w-full overflow-hidden rounded-xl border border-border bg-card">
          <RouteMap
            store={store}
            categories={categories}
            route={route}
            activeStop={finished ? total : index}
            focus
            className="w-full h-full"
          />
        </div>
      </div>

      {finished ? (
        <div className="shrink-0 px-4 pb-6 pt-4 space-y-3 text-center">
          <Flag className="h-8 w-8 mx-auto text-primary" />
          <p className="text-lg font-bold">Direction les caisses !</p>
          <p className="text-sm text-muted-foreground">Tous les articles ont été parcourus.</p>
          <Button className="w-full h-14 text-lg" onClick={() => navigate('/lists')}>
            Terminé
          </Button>
          {total > 0 && (
            <Button variant="ghost" className="w-full" onClick={() => setIndex(total - 1)}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Retour
            </Button>
          )}
        </div>
      ) : (
        <div className="shrink-0 px-4 pb-6 pt-3 space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" /> {current?.categoryName}
            </p>
            <p className="text-3xl font-bold leading-tight mt-1">
              {current?.items.map((i) => i.name).join(' · ')}
            </p>
            {current?.items.some((i) => i.notes) && (
              <p className="text-sm text-muted-foreground mt-1">
                {current.items.filter((i) => i.notes).map((i) => `${i.name} : ${i.notes}`).join(' — ')}
              </p>
            )}
            <p className="text-sm text-muted-foreground mt-2">
              {next
                ? `Suivant : ${next.items.map((i) => i.name).join(', ')} — ${next.categoryName}`
                : 'Suivant : les caisses'}
            </p>
          </div>

          <Button className="w-full h-16 text-xl gap-2" onClick={() => validate(true)}>
            <Check className="h-6 w-6" /> Fait
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 h-11"
              disabled={index === 0}
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> Retour
            </Button>
            <Button variant="secondary" className="flex-1 h-11" onClick={() => validate(false)}>
              <SkipForward className="h-4 w-4 mr-1" /> Passer
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
