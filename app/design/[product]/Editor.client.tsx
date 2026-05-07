"use client";

import * as fabric from "fabric";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  clearArtwork,
  drawGuides,
  initCanvas,
  loadSide,
  serializeSide,
} from "@/lib/editor/fabricInit";
import { PRINT_FONTS, DEFAULT_FONT } from "@/lib/editor/fonts";
import { emptyDesign, type DesignDocument, type FabricSide } from "@/lib/editor/serialize";
import type { ProductSpec } from "@/lib/products/specs";

interface Props {
  spec: ProductSpec;
  initialDesignId: string | null;
}

export default function Editor({ spec, initialDesignId }: Props) {
  const canvasEl = useRef<HTMLCanvasElement | null>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  const guidesRef = useRef<fabric.Object[]>([]);
  const ppiRef = useRef<number>(spec.dpi);

  const [side, setSide] = useState(0);
  const [doc, setDoc] = useState<DesignDocument>(() => emptyDesign(spec.key, spec.sides));
  const [designId, setDesignId] = useState<string | null>(initialDesignId);
  const [name, setName] = useState("Untitled design");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [textValue, setTextValue] = useState("Your text");
  const [fontFamily, setFontFamily] = useState(DEFAULT_FONT.family);
  const [fillColor, setFillColor] = useState("#111111");
  const skipNextChangeRef = useRef(false);

  const sideLabel = useMemo(() => (spec.sides === 2 ? (side === 0 ? "Front" : "Back") : "Single side"), [spec.sides, side]);

  // Initial mount: build canvas + load existing design if id is in URL.
  useEffect(() => {
    if (!canvasEl.current) return;
    const viewportWidth = Math.min(960, window.innerWidth - 320);
    const chrome = initCanvas(canvasEl.current, {
      viewportWidthPx: viewportWidth,
      side: 0,
      spec,
    });
    fabricRef.current = chrome.canvas;
    guidesRef.current = chrome.guides;
    ppiRef.current = chrome.displayPpi;

    const onChange = () => {
      if (skipNextChangeRef.current) {
        skipNextChangeRef.current = false;
        return;
      }
      const json = serializeSide(chrome.canvas) as FabricSide;
      json.ppi = chrome.displayPpi;
      setDoc((d) => {
        const next = { ...d, sides: d.sides.slice() };
        next.sides[side] = json;
        return next;
      });
    };
    chrome.canvas.on("object:added", onChange);
    chrome.canvas.on("object:modified", onChange);
    chrome.canvas.on("object:removed", onChange);

    if (initialDesignId) {
      void loadDesign(initialDesignId);
    }

    return () => {
      chrome.canvas.dispose();
      fabricRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadDesign = useCallback(async (id: string) => {
    const res = await fetch(`/api/designs/${id}`);
    if (!res.ok) return;
    const json = (await res.json()) as { design: { id: string; name: string; data: DesignDocument } };
    setDesignId(json.design.id);
    setName(json.design.name);
    setDoc(json.design.data);
    if (fabricRef.current) {
      skipNextChangeRef.current = true;
      await loadSide(fabricRef.current, guidesRef.current, json.design.data.sides[0] ?? null);
      guidesRef.current = drawGuides(fabricRef.current, spec, ppiRef.current);
    }
  }, [spec]);

  // Switch sides → swap artwork
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    skipNextChangeRef.current = true;
    void loadSide(canvas, guidesRef.current, doc.sides[side] ?? null).then(() => {
      // Re-draw guides on top after JSON load.
      clearGuidesAndRedraw();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [side]);

  function clearGuidesAndRedraw() {
    const canvas = fabricRef.current;
    if (!canvas) return;
    for (const g of guidesRef.current) canvas.remove(g);
    guidesRef.current = drawGuides(canvas, spec, ppiRef.current);
  }

  // Debounced autosave
  useEffect(() => {
    if (saveState === "saving") return;
    const t = setTimeout(() => void persist(), 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, name]);

  async function persist() {
    setSaveState("saving");
    try {
      const res = await fetch("/api/designs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: designId, name, productKey: spec.key, data: doc }),
      });
      if (!res.ok) throw new Error("save failed");
      const json = (await res.json()) as { design: { id: string } };
      setDesignId(json.design.id);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  function addText() {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const text = new fabric.Textbox(textValue || "Your text", {
      left: 50,
      top: 50,
      fontFamily,
      fontSize: 28,
      fill: fillColor,
      width: 280,
      editable: true,
    });
    canvas.add(text);
    canvas.setActiveObject(text);
    canvas.requestRenderAll();
  }

  function addRect() {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const rect = new fabric.Rect({
      left: 80,
      top: 80,
      width: 200,
      height: 120,
      fill: fillColor,
    });
    canvas.add(rect);
    canvas.setActiveObject(rect);
    canvas.requestRenderAll();
  }

  function addCircle() {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const c = new fabric.Circle({ left: 100, top: 100, radius: 60, fill: fillColor });
    canvas.add(c);
    canvas.setActiveObject(c);
    canvas.requestRenderAll();
  }

  async function uploadImage(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/uploads", { method: "POST", body: fd });
    if (!res.ok) return;
    const json = (await res.json()) as { url: string };
    const canvas = fabricRef.current;
    if (!canvas) return;
    const img = await fabric.FabricImage.fromURL(json.url, { crossOrigin: "anonymous" });
    img.set({ left: 60, top: 60 });
    // Scale image to a sensible default (about 1/3 of the trim width)
    const targetW = (spec.widthIn / 3) * ppiRef.current;
    const scale = targetW / (img.width ?? targetW);
    img.scale(scale);
    canvas.add(img);
    canvas.setActiveObject(img);
    canvas.requestRenderAll();
  }

  function deleteSelected() {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const obj = canvas.getActiveObject();
    if (!obj) return;
    canvas.remove(obj);
    canvas.discardActiveObject();
    canvas.requestRenderAll();
  }

  function applyFontToSelection(family: string) {
    setFontFamily(family);
    const canvas = fabricRef.current;
    if (!canvas) return;
    const obj = canvas.getActiveObject();
    if (!obj) return;
    if (obj.type === "textbox" || obj.type === "i-text" || obj.type === "text") {
      (obj as unknown as { set: (v: Record<string, unknown>) => void }).set({ fontFamily: family });
      canvas.requestRenderAll();
    }
  }

  function applyFillToSelection(color: string) {
    setFillColor(color);
    const canvas = fabricRef.current;
    if (!canvas) return;
    const obj = canvas.getActiveObject();
    if (!obj) return;
    (obj as unknown as { set: (v: Record<string, unknown>) => void }).set({ fill: color });
    canvas.requestRenderAll();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <aside className="card space-y-4">
        <div>
          <label className="block text-xs font-medium text-ink/60">Design name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded border border-ink/20 px-2 py-1 text-sm"
          />
        </div>
        {spec.sides === 2 && (
          <div className="flex gap-2">
            <button
              type="button"
              className={`btn flex-1 ${side === 0 ? "bg-ink text-white" : ""}`}
              onClick={() => setSide(0)}
            >
              Front
            </button>
            <button
              type="button"
              className={`btn flex-1 ${side === 1 ? "bg-ink text-white" : ""}`}
              onClick={() => setSide(1)}
            >
              Back
            </button>
          </div>
        )}
        <div className="space-y-2">
          <div className="text-xs font-medium uppercase tracking-wide text-ink/60">Add</div>
          <input
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            placeholder="Text content"
            className="w-full rounded border border-ink/20 px-2 py-1 text-sm"
          />
          <div className="grid grid-cols-3 gap-2">
            <button type="button" className="btn" onClick={addText}>Text</button>
            <button type="button" className="btn" onClick={addRect}>Rect</button>
            <button type="button" className="btn" onClick={addCircle}>Circle</button>
          </div>
          <label className="btn block cursor-pointer text-center">
            Upload image
            <input
              type="file"
              accept="image/png,image/jpeg,image/svg+xml"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadImage(f);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        <div className="space-y-2">
          <div className="text-xs font-medium uppercase tracking-wide text-ink/60">Style</div>
          <select
            value={fontFamily}
            onChange={(e) => applyFontToSelection(e.target.value)}
            className="w-full rounded border border-ink/20 px-2 py-1 text-sm"
          >
            {PRINT_FONTS.map((f) => (
              <option key={f.family} value={f.family}>
                {f.family}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={fillColor}
              onChange={(e) => applyFillToSelection(e.target.value)}
              className="h-8 w-8 cursor-pointer rounded border border-ink/20"
            />
            <input
              type="text"
              value={fillColor}
              onChange={(e) => applyFillToSelection(e.target.value)}
              className="flex-1 rounded border border-ink/20 px-2 py-1 text-sm font-mono"
            />
          </div>
          <button type="button" className="btn w-full" onClick={deleteSelected}>
            Delete selected
          </button>
        </div>
        <div className="text-xs text-ink/60 space-y-1">
          <div>
            <span className="inline-block h-2 w-3 align-middle border border-red-500 mr-1" />
            Bleed (artwork must reach this edge)
          </div>
          <div>
            <span className="inline-block h-2 w-3 align-middle border border-ink mr-1" />
            Trim (final cut)
          </div>
          <div>
            <span className="inline-block h-2 w-3 align-middle border border-blue-500 mr-1" />
            Safe (keep text inside)
          </div>
        </div>
        <div className="text-xs">
          {saveState === "saving" && <span className="text-ink/60">Saving…</span>}
          {saveState === "saved" && <span className="text-emerald-700">Saved · {sideLabel}</span>}
          {saveState === "error" && <span className="text-red-600">Save failed</span>}
        </div>
        {designId && (
          <Link
            href={{ pathname: "/cart", query: { add: designId, product: spec.key } }}
            className="btn-primary w-full"
          >
            Add to cart →
          </Link>
        )}
      </aside>

      <div className="card overflow-auto">
        <div className="mb-3 text-xs text-ink/60">{sideLabel}</div>
        <div className="inline-block bg-paper p-4">
          <canvas ref={canvasEl} className="block shadow" />
        </div>
      </div>
    </div>
  );
}
