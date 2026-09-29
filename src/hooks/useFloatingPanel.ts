import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

type Offset = { right: number; bottom: number };
type PanelState = Offset & { collapsed: boolean };

const EDGE_GAP = 16;
const DEFAULT_STATE: PanelState = { right: EDGE_GAP, bottom: EDGE_GAP, collapsed: false };

function readState(key: string): PanelState {
  try {
    const stored = JSON.parse(window.localStorage.getItem(key) ?? 'null');
    if (stored && typeof stored.right === 'number' && typeof stored.bottom === 'number') {
      return { right: stored.right, bottom: stored.bottom, collapsed: stored.collapsed === true };
    }
  } catch {
    // Storage can be blocked or hold junk; the default corner is fine.
  }
  return DEFAULT_STATE;
}

function writeState(key: string, state: PanelState): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(state));
  } catch {
    // Position memory is a convenience only.
  }
}

/** Keeps the panel fully on screen, anchored by its bottom-right corner. */
function clampOffset(offset: Offset, panel: HTMLElement | null): Offset {
  const width = panel?.offsetWidth ?? 0;
  const height = panel?.offsetHeight ?? 0;
  return {
    right: Math.min(Math.max(offset.right, EDGE_GAP), Math.max(EDGE_GAP, window.innerWidth - width - EDGE_GAP)),
    bottom: Math.min(Math.max(offset.bottom, EDGE_GAP), Math.max(EDGE_GAP, window.innerHeight - height - EDGE_GAP)),
  };
}

/** Position and collapsed state for a draggable overlay panel, remembered per browser. */
export function useFloatingPanel(storageKey: string) {
  const panelRef = useRef<HTMLElement>(null);
  const [state, setState] = useState(() => readState(storageKey));
  const drag = useRef<{ pointerX: number; pointerY: number; origin: Offset } | null>(null);

  useEffect(() => writeState(storageKey, state), [storageKey, state]);

  useEffect(() => {
    const keepOnScreen = () => setState((current) => ({ ...current, ...clampOffset(current, panelRef.current) }));
    keepOnScreen();
    window.addEventListener('resize', keepOnScreen);
    return () => window.removeEventListener('resize', keepOnScreen);
  }, [state.collapsed]);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest('button, a, input')) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointerX: event.clientX, pointerY: event.clientY, origin: { right: state.right, bottom: state.bottom } };
  }, [state.right, state.bottom]);

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const active = drag.current;
    if (!active) return;
    const next = clampOffset({
      right: active.origin.right - (event.clientX - active.pointerX),
      bottom: active.origin.bottom - (event.clientY - active.pointerY),
    }, panelRef.current);
    setState((current) => ({ ...current, ...next }));
  }, []);

  const onPointerUp = useCallback(() => {
    drag.current = null;
  }, []);

  const toggleCollapsed = useCallback(() => {
    setState((current) => ({ ...current, collapsed: !current.collapsed }));
  }, []);

  return {
    panelRef,
    collapsed: state.collapsed,
    toggleCollapsed,
    style: { right: state.right, bottom: state.bottom },
    handleProps: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
  };
}
