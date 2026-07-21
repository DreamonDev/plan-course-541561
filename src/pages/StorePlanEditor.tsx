import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '@/lib/store';
import type { EditorMode } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  ArrowLeft, Plus, Minus, MousePointer2, Square, StretchHorizontal,
  DoorOpen, Palette, Eraser, Merge, Ungroup, X
} from 'lucide-react';

const modeConfig = [
  { mode: 'select' as EditorMode, icon: MousePointer2, label: 'Sélection' },
  { mode: 'wall' as EditorMode, icon: Square, label: 'Mur' },
  { mode: 'aisle' as EditorMode, icon: StretchHorizontal, label: 'Allée' },
  { mode: 'entrance' as EditorMode, icon: DoorOpen, label: 'Entrée' },
  { mode: 'category' as EditorMode, icon: Palette, label: 'Catégorie' },
  { mode: 'erase' as EditorMode, icon: Eraser, label: 'Effacer' },
];

export default function StorePlanEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const store = useAppStore((s) => s.stores.find((st) => st.id === id));
  const categories = useAppStore((s) => s.categories);
  const { updateCell, setEntrance, addRow, removeRow, addCol, removeCol, mergeCells, unmergeCells, updateColWidth, updateRowHeight } = useAppStore();

  const [mode, setMode] = useState<EditorMode>('select');
  const [catPopover, setCatPopover] = useState<{ r: number; c: number } | null>(null);
  const [selection, setSelection] = useState<{ start: { r: number; c: number }; end: { r: number; c: number } } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);

  const handleCellClick = useCallback(
    (row: number, col: number) => {
      if (!id || !store) return;
      switch (mode) {
        case 'wall':
          updateCell(id, row, col, { type: store.cells[row][col].type === 'wall' ? 'empty' : 'wall', categoryId: undefined });
          break;
        case 'aisle':
          updateCell(id, row, col, { type: store.cells[row][col].type === 'aisle' ? 'empty' : 'aisle', categoryId: undefined });
          break;
        case 'entrance':
          setEntrance(id, row, col);
          updateCell(id, row, col, { type: 'aisle' });
          break;
        case 'category':
          setCatPopover({ r: row, c: col });
          break;
        case 'erase':
          updateCell(id, row, col, { type: 'empty', categoryId: undefined });
          break;
      }
    },
    [id, mode, store, updateCell, setEntrance]
  );

  const handleMouseDown = (row: number, col: number) => {
    if (mode === 'select') {
      setSelection({ start: { r: row, c: col }, end: { r: row, c: col } });
      setIsSelecting(true);
    } else {
      handleCellClick(row, col);
    }
  };

  const handleMouseEnter = (row: number, col: number) => {
    if (isSelecting && mode === 'select' && selection) {
      setSelection({ ...selection, end: { r: row, c: col } });
    }
  };

  const handleMouseUp = () => {
    setIsSelecting(false);
  };

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

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 p-3 border-b border-border shrink-0 flex-wrap">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/stores')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="font-semibold text-sm truncate">{store.name}</h2>

        <div className="ml-auto flex items-center gap-1 flex-wrap">
          {/* Grid controls */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground mr-2">
            <span>Lignes</span>
            <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => removeRow(store.id)}>
              <Minus className="h-3 w-3" />
            </Button>
            <span className="w-5 text-center">{store.rows}</span>
            <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => addRow(store.id)}>
              <Plus className="h-3 w-3" />
            </Button>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span>Col</span>
            <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => removeCol(store.id)}>
              <Minus className="h-3 w-3" />
            </Button>
            <span className="w-5 text-center">{store.cols}</span>
            <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => addCol(store.id)}>
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* Toolbar */}
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
          <span className="text-xs text-muted-foreground ml-1">Cliquez une cellule pour choisir sa catégorie</span>
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

      {/* Grid */}
      <div
        className="flex-1 overflow-auto p-4"
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <table
          className="border-collapse select-none"
          style={{ tableLayout: 'fixed' }}
        >
          {/* Col width header */}
          <thead>
            <tr>
              <th className="w-8" />
              {store.colWidths.map((w, ci) => (
                <th key={ci} style={{ width: w }} className="p-0">
                  <Input
                    type="number"
                    value={w}
                    onChange={(e) => updateColWidth(store.id, ci, parseInt(e.target.value) || 40)}
                    className="h-5 text-[10px] text-center p-0 border-0 bg-transparent w-full"
                    min={20}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {store.cells.map((row, ri) => (
              <tr key={ri}>
                {/* Row height control */}
                <td className="p-0 pr-1">
                  <Input
                    type="number"
                    value={store.rowHeights[ri]}
                    onChange={(e) => updateRowHeight(store.id, ri, parseInt(e.target.value) || 40)}
                    className="h-5 w-8 text-[10px] text-center p-0 border-0 bg-transparent"
                    min={20}
                  />
                </td>
                {row.map((cell, ci) => {
                  if (cell.merged) return null;
                  const span = cell.mergeSpan;
                  const cat = cell.categoryId ? categories.find((c) => c.id === cell.categoryId) : null;
                  const isEntrance = store.entrance?.row === ri && store.entrance?.col === ci;
                  const selected = isInSelection(ri, ci);

                  let bgColor = 'transparent';
                  let textContent = '';
                  if (cell.type === 'wall') {
                    bgColor = 'hsl(var(--foreground) / 0.75)';
                  } else if (cat) {
                    bgColor = cat.color + '40';
                  } else if (cell.type === 'aisle') {
                    bgColor = 'hsl(var(--primary) / 0.1)';
                  }

                  if (cat) textContent = cat.name;
                  if (isEntrance) textContent = '🚪';

                  return (
                    <td
                      key={ci}
                      colSpan={span?.cols}
                      rowSpan={span?.rows}
                      style={{
                        width: store.colWidths[ci],
                        height: store.rowHeights[ri],
                        backgroundColor: bgColor,
                        minWidth: store.colWidths[ci],
                      }}
                      className={`border border-border text-[9px] text-center cursor-pointer transition-colors overflow-hidden ${
                        selected ? 'ring-2 ring-primary ring-inset' : ''
                      } ${isEntrance ? 'text-lg' : 'text-muted-foreground'}`}
                      onMouseDown={() => handleMouseDown(ri, ci)}
                      onMouseEnter={() => handleMouseEnter(ri, ci)}
                      onClick={() => mode !== 'select' && handleCellClick(ri, ci)}
                    >
                      <span className="truncate block px-0.5 leading-tight">{textContent}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
