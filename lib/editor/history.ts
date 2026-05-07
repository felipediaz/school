"use client";

import * as fabric from "fabric";

const MAX_DEPTH = 50;

export interface HistoryHandle {
  /** Capture a snapshot — call after a user-driven change. */
  push(): void;
  /** Apply the previous snapshot. */
  undo(): Promise<void>;
  /** Re-apply a snapshot that was undone. */
  redo(): Promise<void>;
  canUndo(): boolean;
  canRedo(): boolean;
  /** Reset the stacks (e.g. after applying a template). */
  reset(): void;
  dispose(): void;
}

/**
 * Snapshot-based history. We serialize the canvas (excluding guides via
 * `excludeFromExport: true`) and replay JSON on undo/redo.
 *
 * `redrawGuides` is invoked after each restore so the bleed/trim/safe lines
 * re-appear on top.
 */
export function makeHistory(
  getCanvas: () => fabric.Canvas | null,
  redrawGuides: () => void,
): HistoryHandle {
  const past: object[] = [];
  const future: object[] = [];
  let suppress = false;

  const onChange = () => {
    if (suppress) return;
    const c = getCanvas();
    if (!c) return;
    past.push(c.toJSON());
    if (past.length > MAX_DEPTH) past.shift();
    future.length = 0;
  };

  const apply = async (snapshot: object) => {
    const c = getCanvas();
    if (!c) return;
    suppress = true;
    try {
      await c.loadFromJSON(snapshot);
      c.requestRenderAll();
      redrawGuides();
    } finally {
      suppress = false;
    }
  };

  // Snapshot starting state once a canvas is present.
  const initial = getCanvas();
  if (initial) past.push(initial.toJSON());

  return {
    push: onChange,
    canUndo: () => past.length > 1,
    canRedo: () => future.length > 0,
    async undo() {
      if (past.length <= 1) return;
      const current = past.pop();
      if (current) future.push(current);
      const target = past[past.length - 1];
      if (target) await apply(target);
    },
    async redo() {
      const target = future.pop();
      if (!target) return;
      past.push(target);
      await apply(target);
    },
    reset() {
      const c = getCanvas();
      past.length = 0;
      future.length = 0;
      if (c) past.push(c.toJSON());
    },
    dispose() {
      past.length = 0;
      future.length = 0;
    },
  };
}
