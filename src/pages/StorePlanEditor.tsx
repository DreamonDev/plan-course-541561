import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '@/lib/store';
import type { EditorMode, Cell, SubCell, Category } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  ArrowLeft, Plus, Minus, MousePointer2, Square, StretchHorizontal,
  DoorOpen, Palette, Eraser, Merge, Ungroup, X, SplitSquareHorizontal, SplitSquareVertical,
  ScanBarcode,
} from 'lucide-react';

function DimInput({ value, onCommit, className }: { value: number; onCommit: (v: number) => void; className?: string }) {
  const [local, setLocal] = useState(String(value));
  useEffect(() => { setLocal(String(value)); }, [value]);
  const commit = () => {
    const n = parseInt(local, 10);
    if (!isNaN(n)) {
      const clamped = Math.max(5, Math.min(500, Math.round(n / 5) * 5));
      onCommit(clamped);
      setLocal(String(clamped));
    } else {
      setLocal(String(value));
    }
  };
  return (
    <Input
      type="text"
      inputMode="numeric"
      value={local}
      onChange={(e) => setLocal(e.target.value.replace(/[^0-9]/g, ''))}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      className={className}
    />
  );
}

const modeConfig = [
  { mode: 'select' as EditorMode, icon: MousePointer2, label: 'Sélection' },
  { mode: 'wall' as EditorMode, icon: Square, label: 'Mur' },
  { mode: 'aisle' as EditorMode, icon: StretchHorizontal, label: 'Allée' },
  { mode: 'entrance' as EditorMode, icon: DoorOpen, label: 'Entrée' },
  { mode: 'checkout' as EditorMode, icon: ScanBarcode, label: 'Caisses' },
  { mode: 'category' as EditorMode, icon: Palette, label: 'Catégorie' },
  { mode: 'split' as EditorMode, icon: SplitSquareHorizontal, label: 'Diviser' },
  { mode: 'erase' as EditorMode, icon: Eraser, label: 'Effacer' },
];

type CatPopover = { r: number; c: number; path?: (0 | 1)[] } | null;
type SplitPopover = { r: number; c: number; path?: (0 | 1)[] } | null;

export default function StorePlanEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const store = useAppStore((s) => s.stores.find((st) => st.id === id));
  const categories = useAppStore((s) => s.categories);
  const {
    updateCell, setEntrance, addRow, removeRow, addCol, removeCol,
    mergeCells, unmergeCells, updateColWidth, updateRowHeight,
    splitCell, unsplitCell, updateSubCell, updateSubCellPath, splitSubCellPath,
  } = useAppStore();

  const [mode, setMode] = useState<EditorMode>('select');
  const [catPopover, setCatPopover] = useState<CatPopover>(null);
  const [splitPopover, setSplitPopover] = useState<SplitPopover>(null);
  const [catSearch, setCatSearch] = useState('');
  const [selection, setSelection] = useState<{ start: { r: number; c: number }; end: { r: number; c: number } } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);

  const applyModeToCell = useCallback((row: number, col: number, cur: Cell) => {
    if (!id) return;
    switch (mode) {
      case 'wall':
        updateCell(id, row, col, { type: cur.type === 'wall' ? 'empty' : 'wall', categoryId: undefined });
        break;
      case 'aisle':
        updateCell(id, row, col, { type: cur.type === 'aisle' ? 'empty' : 'aisle', categoryId: undefined });
        break;
      case 'checkout':
        updateCell(id, row, col, { type: cur.type === 'checkout' ? 'empty' : 'checkout', categoryId: undefined });
        break;
      case 'entrance':
        setEntrance(id, row, col);
        updateCell(id, row, col, { type: 'aisle' });
        break;
      case 'category':
        setCatPopover({ r: row, c: col });
        break;
      case 'erase':
        updateCell(id, row, col, { type: 'empty', categoryId: undefined, split: undefined });
        break;
      case 'split':
        setSplitPopover({ r: row, c: col });
        break;
    }
  }, [id, mode, updateCell, setEntrance]);

  const applyModeToSub = useCallback((row: number, col: number, path: (0 | 1)[], cur: SubCell) => {
    if (!id) return;
    switch (mode) {
      case 'wall':
        updateSubCellPath(id, row, col, path, { type: cur.type === 'wall' ? 'empty' : 'wall', categoryId: undefined });
        break;
      case 'aisle':
        updateSubCellPath(id, row, col, path, { type: cur.type === 'aisle' ? 'empty' : 'aisle', categoryId: undefined });
        break;
      case 'checkout':
        updateSubCellPath(id, row, col, path, { type: cur.type === 'checkout' ? 'empty' : 'checkout', categoryId: undefined });
        break;
      case 'category':
        setCatPopover({ r: row, c: col, path });
        break;
      case 'erase':
        updateSubCellPath(id, row, col, path, { type: 'empty', categoryId: undefined, split: undefined });
        break;
      case 'split':
        setSplitPopover({ r: row, c: col, path });
        break;
      case 'entrance':
        break;
    }
  }, [id, mode, updateSubCellPath]);

  const handleMouseDown = (row: number, col: number, cur: Cell) => {
    if (mode === 'select') {
      setSelection({ start: { r: row, c: col }, end: { r: row, c: col } });
      setIsSelecting(true);
    } else if (!cur.split) {
      applyModeToCell(row, col, cur);
    }
  };

  const handleMouseEnter = (row: number, col: number) => {
    if (isSelecting && mode === 'select' && selection) {
      setSelection({ ...selection, end: { r: row, c: col } });
    }
  };

  const handleMouseUp = () => setIsSelecting(false);

  const handleMerge = () => {
    if (!id || !selection) return;
    mergeCells(id, selection.start.r, selection.start.c, selection.end.r, selection.end.c);
    setSelection(null);
  };

  const handleUnmerge = () => {
    if (!id || !selection) return;
    unmergeCells(id, selection.start.r, selection.start.c);
    setSelection(null);
  };

  if (!store) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p>Magasin introuvable.</p>
        <Button variant="link" onClick={() => navigate('/stores')}>Retour</Button>
      </div>
    );
  }

  const isInSelection = (r: number, c: number) => {
    if (!selection) return false;
    const rMin = Math.min(selection.start.r, selection.end.r);
    const rMax = Math.max(selection.start.r, selection.end.r);
    const cMin = Math.min(selection.start.c, selection.end.c);
    const cMax = Math.max(selection.start.c, selection.end.c);
    return r >= rMin && r <= rMax && c >= cMin && c <= cMax;
  };

  // shared renderer for sub-cell visual
  const renderSubVisual = (sub: SubCell) => {
    const cat = sub.categoryId ? categories.find((c) => c.id === sub.categoryId) : null;
    let bg = 'transparent';
    let text = '';
    let categorized = false;
    let checkout = false;
    if (sub.type === 'wall') bg = 'hsl(var(--foreground) / 0.85)';
    else if (cat) { bg = cat.color; categorized = true; }
    else if (sub.type === 'checkout') { bg = 'hsl(38 92% 55%)'; checkout = true; }
    else if (sub.type === 'aisle') bg = 'hsl(var(--card))';
    if (cat) text = cat.name;
    else if (sub.type === 'checkout') text = 'Caisses';
    else if (sub.type === 'aisle') text = 'Allée';
    return { bg, text, categorized, checkout };
  };

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-20 bg-background">
        <div className="flex items-center gap-2 p-3 border-b border-border shrink-0 flex-wrap">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/stores')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h2 className="font-semibold text-sm truncate">{store.name}</h2>

          <div className="ml-auto flex items-center gap-1 flex-wrap">
            <div className="flex items-center gap-1 text-xs text-muted-foreground mr-2">
              <span>Lignes</span>
              <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => removeRow(store.id)}><Minus className="h-3 w-3" /></Button>
              <span className="w-5 text-center">{store.rows}</span>
              <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => addRow(store.id)}><Plus className="h-3 w-3" /></Button>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span>Col</span>
              <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => removeCol(store.id)}><Minus className="h-3 w-3" /></Button>
              <span className="w-5 text-center">{store.cols}</span>
              <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => addCol(store.id)}><Plus className="h-3 w-3" /></Button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 p-2 border-b border-border shrink-0 flex-wrap">
          {modeConfig.map(({ mode: m, icon: Icon, label }) => (
            <Button
              key={m}
              variant={mode === m ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => setMode(m)}
              title={label}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </Button>
          ))}

          {mode === 'category' && (
            <span className="text-xs text-muted-foreground ml-1">Cliquez une (sous-)cellule pour choisir sa catégorie</span>
          )}
          {mode === 'split' && (
            <span className="text-xs text-muted-foreground ml-1">Cliquez une cellule à diviser en deux</span>
          )}

          {mode === 'select' && selection && (
            <>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1 ml-2" onClick={handleMerge}>
                <Merge className="h-3.5 w-3.5" /> Fusionner
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={handleUnmerge}>
                <Ungroup className="h-3.5 w-3.5" /> Défusionner
              </Button>
            </>
          )}
        </div>
      </div>

      <div
        className="flex-1 p-4"
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div className="w-full overflow-x-auto overflow-y-auto max-h-[80vh] relative isolation-isolate">
        {(() => { const totalW = 32 + store.colWidths.reduce((a, b) => a + b, 0); return (
        <table
          lang="fr"
          className="border-collapse select-none"
          style={{
            tableLayout: 'fixed',
            width: totalW,
            minWidth: totalW,
            willChange: 'transform',
            transform: 'translateZ(0)',
          }}
        >
          <colgroup>
            <col style={{ width: 32 }} />
            {store.colWidths.map((w, ci) => (
              <col key={ci} style={{ width: w }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th />
              {store.colWidths.map((w, ci) => (
                <th key={ci} className="p-0">
                  <DimInput
                    value={w}
                    onCommit={(v) => updateColWidth(store.id, ci, v)}
                    className="h-5 text-[10px] text-center p-0 border-0 bg-transparent w-full"
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {store.cells.map((row, ri) => (
              <tr key={ri}>
                <td className="p-0 pr-1">
                  <DimInput
                    value={store.rowHeights[ri]}
                    onCommit={(v) => updateRowHeight(store.id, ri, v)}
                    className="h-5 w-8 text-[10px] text-center p-0 border-0 bg-transparent"
                  />
                </td>
                {row.map((cell, ci) => {
                  if (cell.merged) return null;
                  const span = cell.mergeSpan;
                  const isEntrance = store.entrance?.row === ri && store.entrance?.col === ci;
                  const selected = isInSelection(ri, ci);
                  const isCatOpen = catPopover?.r === ri && catPopover?.c === ci && catPopover?.path === undefined;
                  const isSplitOpen = splitPopover?.r === ri && splitPopover?.c === ci && splitPopover?.path === undefined;

                  const commonTd = {
                    key: ci,
                    colSpan: span?.cols,
                    rowSpan: span?.rows,
                    style: {
                      height: store.rowHeights[ri],
                    } as React.CSSProperties,
                    onMouseEnter: () => handleMouseEnter(ri, ci),
                  };

                  // ---- Split cell rendering ----
                  if (cell.split) {
                    const renderSubTree = (sub: SubCell, path: (0 | 1)[]): JSX.Element => {
                      if (sub.split) {
                        const flexDir = sub.split.direction === 'vertical' ? 'flex-row' : 'flex-col';
                        return (
                          <div className={`flex ${flexDir} w-full h-full`}>
                            {sub.split.children.map((child, sIdx) => {
                              const idx = sIdx as 0 | 1;
                              const isBorder = sub.split!.direction === 'vertical'
                                ? (idx === 0 ? 'border-r border-border' : '')
                                : (idx === 0 ? 'border-b border-border' : '');
                              return (
                                <div key={idx} className={`flex-1 min-w-0 min-h-0 ${isBorder}`}>
                                  {renderSubTree(child, [...path, idx])}
                                </div>
                              );
                            })}
                          </div>
                        );
                      }
                      const { bg, text, categorized, checkout } = renderSubVisual(sub);
                      const pathKey = path.join('-');
                      const isSubCatOpen = catPopover?.r === ri && catPopover?.c === ci && catPopover?.path?.join('-') === pathKey;
                      const isSubSplitOpen = splitPopover?.r === ri && splitPopover?.c === ci && splitPopover?.path?.join('-') === pathKey;
                      return (
                        <div
                          style={{ backgroundColor: bg }}
                          className={`w-full h-full flex items-center justify-center cursor-pointer relative overflow-hidden ${
                            categorized || checkout ? 'text-white font-bold text-xs' : 'text-[9px] text-muted-foreground'
                          }`}
                          onMouseDown={(e) => {
                            if (mode === 'select') return; // let td handle selection
                            e.stopPropagation();
                            applyModeToSub(ri, ci, path, sub);
                          }}
                          onMouseEnter={() => handleMouseEnter(ri, ci)}
                        >
                          <span
                            className="block px-0.5 leading-tight pointer-events-none text-center"
                            style={{ overflowWrap: 'break-word', wordBreak: 'break-word', hyphens: 'auto' }}
                          >
                            {text}
                          </span>
                          {/* Invisible popover anchors — trigger doesn't intercept clicks on the visible area */}
                          <Popover open={isSubCatOpen} onOpenChange={(o) => { if (!o) { setCatPopover(null); setCatSearch(''); } }}>
                            <PopoverTrigger asChild>
                              <span className="sr-only absolute inset-0 pointer-events-none">cat-anchor</span>
                            </PopoverTrigger>
                            <PopoverContent className="w-56 p-1" align="start">
                              <CategoryPicker
                                categories={categories}
                                catSearch={catSearch}
                                setCatSearch={setCatSearch}
                                currentId={sub.categoryId}
                                onPick={(cid) => {
                                  updateSubCellPath(id!, ri, ci, path, { categoryId: cid });
                                  setCatPopover(null); setCatSearch('');
                                }}
                                onClear={() => {
                                  updateSubCellPath(id!, ri, ci, path, { categoryId: undefined });
                                  setCatPopover(null); setCatSearch('');
                                }}
                              />
                            </PopoverContent>
                          </Popover>
                          <Popover open={isSubSplitOpen} onOpenChange={(o) => { if (!o) setSplitPopover(null); }}>
                            <PopoverTrigger asChild>
                              <span className="sr-only absolute inset-0 pointer-events-none">split-anchor</span>
                            </PopoverTrigger>
                            <PopoverContent className="w-48 p-2" align="start">
                              <div className="flex flex-col gap-1">
                                <button
                                  className="flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-accent text-left"
                                  onClick={() => { splitSubCellPath(id!, ri, ci, path, 'horizontal'); setSplitPopover(null); }}
                                >
                                  <SplitSquareVertical className="h-3.5 w-3.5" /> Horizontalement
                                </button>
                                <button
                                  className="flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-accent text-left"
                                  onClick={() => { splitSubCellPath(id!, ri, ci, path, 'vertical'); setSplitPopover(null); }}
                                >
                                  <SplitSquareHorizontal className="h-3.5 w-3.5" /> Verticalement
                                </button>
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                      );
                    };
                    return (
                      <td
                        {...commonTd}
                        style={{ ...commonTd.style, backgroundColor: 'transparent' }}
                        className="border border-border p-0"
                      >
                        {renderSubTree({ type: cell.type, categoryId: cell.categoryId, split: cell.split }, [])}
                      </td>
                    );
                  }


                  // ---- Regular cell rendering ----
                  const cat = cell.categoryId ? categories.find((c) => c.id === cell.categoryId) : null;
                  let bgColor = 'transparent';
                  let textContent = '';
                  let isCategorized = false;
                  let isCheckout = false;
                  if (cell.type === 'wall') bgColor = 'hsl(var(--foreground) / 0.85)';
                  else if (cat) { bgColor = cat.color; isCategorized = true; }
                  else if (cell.type === 'checkout') { bgColor = 'hsl(38 92% 55%)'; isCheckout = true; }
                  else if (cell.type === 'aisle') bgColor = 'hsl(var(--card))';
                  if (cat) textContent = cat.name;
                  else if (cell.type === 'checkout') textContent = 'Caisses';
                  else if (cell.type === 'aisle') textContent = 'Allée';
                  if (isEntrance) textContent = '🚪';

                  return (
                    <td
                      {...commonTd}
                      style={{ ...commonTd.style, backgroundColor: bgColor, overflow: 'hidden' }}
                      className={`border border-border text-center cursor-pointer transition-colors ${
                        selected ? 'ring-2 ring-primary ring-inset' : ''
                      } ${isEntrance ? 'text-lg' : (isCategorized || isCheckout) ? 'text-white font-bold text-xs' : 'text-[9px] text-muted-foreground'}`}
                      onMouseDown={() => handleMouseDown(ri, ci, cell)}
                    >
                      {/* Category popover */}
                      <Popover open={isCatOpen} onOpenChange={(o) => { if (!o) { setCatPopover(null); setCatSearch(''); } }}>
                        <PopoverTrigger asChild>
                          <span
                            className="block px-0.5 leading-tight"
                            style={{ overflowWrap: 'break-word', wordBreak: 'break-word', hyphens: 'auto' }}
                          >{textContent}</span>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 p-1" align="start">
                          <CategoryPicker
                            categories={categories}
                            catSearch={catSearch}
                            setCatSearch={setCatSearch}
                            currentId={cell.categoryId}
                            onPick={(cid) => {
                              updateCell(id!, ri, ci, { categoryId: cid });
                              setCatPopover(null); setCatSearch('');
                            }}
                            onClear={() => {
                              updateCell(id!, ri, ci, { categoryId: undefined });
                              setCatPopover(null); setCatSearch('');
                            }}
                          />
                        </PopoverContent>
                      </Popover>

                      {/* Split popover (invisible anchor) */}
                      <Popover open={isSplitOpen} onOpenChange={(o) => { if (!o) setSplitPopover(null); }}>
                        <PopoverTrigger asChild>
                          <span className="sr-only">split-anchor</span>
                        </PopoverTrigger>
                        <PopoverContent className="w-48 p-2" align="start">
                          <div className="flex flex-col gap-1">
                            <button
                              className="flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-accent text-left"
                              onClick={() => { splitCell(id!, ri, ci, 'horizontal'); setSplitPopover(null); }}
                            >
                              <SplitSquareVertical className="h-3.5 w-3.5" /> Horizontalement
                            </button>
                            <button
                              className="flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-accent text-left"
                              onClick={() => { splitCell(id!, ri, ci, 'vertical'); setSplitPopover(null); }}
                            >
                              <SplitSquareHorizontal className="h-3.5 w-3.5" /> Verticalement
                            </button>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        ); })()}
        </div>
      </div>
    </div>
  );
}

function CategoryPicker({
  categories, catSearch, setCatSearch, currentId, onPick, onClear,
}: {
  categories: Category[];
  catSearch: string;
  setCatSearch: (v: string) => void;
  currentId?: string;
  onPick: (id: string) => void;
  onClear: () => void;
}) {
  return (
    <>
      <div className="p-1">
        <Input
          autoFocus
          placeholder="Rechercher..."
          value={catSearch}
          onChange={(e) => setCatSearch(e.target.value)}
          className="h-7 text-xs"
        />
      </div>
      <div className="max-h-64 overflow-auto">
        {categories.length === 0 && (
          <div className="text-xs text-muted-foreground p-2">Aucune catégorie</div>
        )}
        {categories
          .filter((c) => c.name.toLowerCase().includes(catSearch.toLowerCase()))
          .map((c) => (
            <button
              key={c.id}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-accent text-left"
              onClick={() => onPick(c.id)}
            >
              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
              <span className="truncate">{c.name}</span>
            </button>
          ))}
        {currentId && (
          <button
            className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-accent text-left border-t border-border mt-1 pt-2"
            onClick={onClear}
          >
            <X className="h-3 w-3" /> Retirer la catégorie
          </button>
        )}
      </div>
    </>
  );
}
