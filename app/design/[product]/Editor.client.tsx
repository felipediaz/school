"use client";

import * as fabric from "fabric";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  drawGuides,
  initCanvas,
  loadSide,
  serializeSide,
} from "@/lib/editor/fabricInit";
import { PRINT_FONTS, DEFAULT_FONT } from "@/lib/editor/fonts";
import { emptyDesign, type DesignDocument, type FabricSide } from "@/lib/editor/serialize";
import { addSvgFromString } from "@/lib/editor/svg";
import { makeHistory, type HistoryHandle } from "@/lib/editor/history";
import { templatesFor } from "@/lib/templates/library";
import { templateToFabricSides } from "@/lib/templates/apply";
import type { TemplateDef } from "@/lib/templates/types";
import {
  ELEMENT_CATEGORIES,
  elementsByCategory,
  type ElementCategory,
} from "@/lib/elements/library";
import type { ProductSpec } from "@/lib/products/specs";

interface Props {
  spec: ProductSpec;
  initialDesignId: string | null;
}

type Sheet = null | "templates" | "elements" | "text" | "fonts" | "color" | "ai";
type SidebarTab = "ai" | "templates" | "elements" | "tools";

export default function Editor({ spec, initialDesignId }: Props) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasEl = useRef<HTMLCanvasElement | null>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  const guidesRef = useRef<fabric.Object[]>([]);
  const ppiRef = useRef<number>(spec.dpi);
  const historyRef = useRef<HistoryHandle | null>(null);
  const initedRef = useRef(false);

  const [side, setSide] = useState(0);
  const [doc, setDoc] = useState<DesignDocument>(() => emptyDesign(spec.key, spec.sides));
  const [designId, setDesignId] = useState<string | null>(initialDesignId);
  const [name, setName] = useState("Untitled design");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [textValue, setTextValue] = useState("Your text");
  const [fontFamily, setFontFamily] = useState(DEFAULT_FONT.family);
  const [fillColor, setFillColor] = useState("#111111");
  const [openSheet, setOpenSheet] = useState<Sheet>(initialDesignId ? null : "templates");
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("tools");
  const [hasSelection, setHasSelection] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const skipNextChangeRef = useRef(false);
  const templates = useMemo(() => templatesFor(spec), [spec]);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiState, setAiState] = useState<"idle" | "loading" | "error">("idle");
  const [aiError, setAiError] = useState<string | null>(null);

  const sideLabel = useMemo(
    () => (spec.sides === 2 ? (side === 0 ? "Front" : "Back") : "Single side"),
    [spec.sides, side],
  );

  function syncHistoryButtons() {
    const h = historyRef.current;
    setCanUndo(!!h?.canUndo());
    setCanRedo(!!h?.canRedo());
  }

  // Build canvas + ResizeObserver to keep the canvas the right size for the
  // viewport. We rebuild the Fabric canvas on size change because changing
  // the display ppi mid-flight breaks coordinate math.
  useEffect(() => {
    if (!canvasEl.current || !stageRef.current) return;

    function build() {
      const stage = stageRef.current;
      const el = canvasEl.current;
      if (!stage || !el) return;
      const w = stage.clientWidth - 16;
      const h = stage.clientHeight - 16;
      if (fabricRef.current) {
        const json = serializeSide(fabricRef.current) as FabricSide;
        json.ppi = ppiRef.current;
        setDoc((d) => {
          const next = { ...d, sides: d.sides.slice() };
          next.sides[side] = json;
          return next;
        });
        fabricRef.current.dispose();
        fabricRef.current = null;
      }
      const chrome = initCanvas(el, {
        viewportWidthPx: w,
        viewportHeightPx: h,
        side,
        spec,
      });
      fabricRef.current = chrome.canvas;
      guidesRef.current = chrome.guides;
      ppiRef.current = chrome.displayPpi;

      attachListeners(chrome.canvas);
      void loadSide(chrome.canvas, chrome.guides, doc.sides[side] ?? null).then(() => {
        guidesRef.current = drawGuides(chrome.canvas, spec, chrome.displayPpi);
        // Initialise history once after first build.
        if (!historyRef.current) {
          historyRef.current = makeHistory(
            () => fabricRef.current,
            () => {
              const c = fabricRef.current;
              if (!c) return;
              for (const g of guidesRef.current) c.remove(g);
              guidesRef.current = drawGuides(c, spec, ppiRef.current);
            },
          );
          syncHistoryButtons();
        }
      });
      attachPinch(chrome.canvas, el);
    }

    function attachListeners(canvas: fabric.Canvas) {
      const onChange = () => {
        if (skipNextChangeRef.current) {
          skipNextChangeRef.current = false;
          return;
        }
        const json = serializeSide(canvas) as FabricSide;
        json.ppi = ppiRef.current;
        setDoc((d) => {
          const next = { ...d, sides: d.sides.slice() };
          next.sides[side] = json;
          return next;
        });
        historyRef.current?.push();
        syncHistoryButtons();
      };
      const onSel = () => setHasSelection(!!canvas.getActiveObject());
      canvas.on("object:added", onChange);
      canvas.on("object:modified", onChange);
      canvas.on("object:removed", onChange);
      canvas.on("selection:created", onSel);
      canvas.on("selection:updated", onSel);
      canvas.on("selection:cleared", onSel);
    }

    function attachPinch(canvas: fabric.Canvas, el: HTMLCanvasElement) {
      const upper = (canvas as unknown as { upperCanvasEl: HTMLCanvasElement }).upperCanvasEl ?? el;
      let lastDist = 0;
      let lastMid = { x: 0, y: 0 };
      let pinching = false;

      const start = (e: TouchEvent) => {
        if (e.touches.length === 2) {
          pinching = true;
          canvas.discardActiveObject();
          canvas.requestRenderAll();
          lastDist = dist(e.touches);
          lastMid = mid(e.touches);
        }
      };
      const move = (e: TouchEvent) => {
        if (!pinching || e.touches.length !== 2) return;
        e.preventDefault();
        const d = dist(e.touches);
        const m = mid(e.touches);
        const rect = upper.getBoundingClientRect();
        const point = new fabric.Point(m.x - rect.left, m.y - rect.top);
        const z = Math.max(0.4, Math.min(5, canvas.getZoom() * (d / lastDist)));
        canvas.zoomToPoint(point, z);
        const vp = canvas.viewportTransform;
        if (vp) {
          vp[4] += m.x - lastMid.x;
          vp[5] += m.y - lastMid.y;
          canvas.setViewportTransform(vp);
        }
        lastDist = d;
        lastMid = m;
      };
      const end = (e: TouchEvent) => {
        if (e.touches.length < 2) pinching = false;
      };
      upper.addEventListener("touchstart", start, { passive: true });
      upper.addEventListener("touchmove", move, { passive: false });
      upper.addEventListener("touchend", end, { passive: true });
      upper.addEventListener("touchcancel", end, { passive: true });
    }

    function dist(t: TouchList) {
      return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    }
    function mid(t: TouchList) {
      return { x: (t[0].clientX + t[1].clientX) / 2, y: (t[0].clientY + t[1].clientY) / 2 };
    }

    build();
    initedRef.current = true;

    let raf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(build);
    });
    if (stageRef.current) ro.observe(stageRef.current);

    if (initialDesignId) void loadDesign(initialDesignId);

    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
      historyRef.current?.dispose();
      historyRef.current = null;
      fabricRef.current?.dispose();
      fabricRef.current = null;
      initedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard shortcuts: Cmd/Ctrl+Z = undo, Cmd/Ctrl+Shift+Z = redo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isUndoCombo = (e.metaKey || e.ctrlKey) && !e.shiftKey && (e.key === "z" || e.key === "Z");
      const isRedoCombo = (e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === "z" || e.key === "Z");
      if (!isUndoCombo && !isRedoCombo) return;
      e.preventDefault();
      void (isRedoCombo ? historyRef.current?.redo() : historyRef.current?.undo()).then(() => {
        const c = fabricRef.current;
        if (c) {
          const json = serializeSide(c) as FabricSide;
          json.ppi = ppiRef.current;
          setDoc((d) => {
            const next = { ...d, sides: d.sides.slice() };
            next.sides[side] = json;
            return next;
          });
        }
        syncHistoryButtons();
      });
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [side]);

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
      historyRef.current?.reset();
      syncHistoryButtons();
    }
  }, [spec]);

  // Switch sides → swap artwork
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || !initedRef.current) return;
    skipNextChangeRef.current = true;
    void loadSide(canvas, guidesRef.current, doc.sides[side] ?? null).then(() => {
      for (const g of guidesRef.current) canvas.remove(g);
      guidesRef.current = drawGuides(canvas, spec, ppiRef.current);
      historyRef.current?.reset();
      syncHistoryButtons();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [side]);

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

  function applyTemplate(tmpl: TemplateDef) {
    const sides = templateToFabricSides(tmpl, spec, ppiRef.current);
    applyFabricSides(sides);
  }

  function applyFabricSides(sides: FabricSide[]) {
    setDoc((d) => ({ ...d, sides }));
    setSide(0);
    setOpenSheet(null);
    const canvas = fabricRef.current;
    if (canvas) {
      skipNextChangeRef.current = true;
      void loadSide(canvas, guidesRef.current, sides[0]).then(() => {
        for (const g of guidesRef.current) canvas.remove(g);
        guidesRef.current = drawGuides(canvas, spec, ppiRef.current);
        historyRef.current?.reset();
        syncHistoryButtons();
      });
    }
  }

  async function generateWithAi() {
    if (!aiPrompt.trim() || aiState === "loading") return;
    setAiState("loading");
    setAiError(null);
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: aiPrompt.trim(),
          productKey: spec.key,
          ppi: ppiRef.current,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.formErrors?.[0] || json.error || "generation failed");
      applyFabricSides(json.sides as FabricSide[]);
      setAiState("idle");
    } catch (err) {
      setAiError(err instanceof Error ? err.message : String(err));
      setAiState("error");
    }
  }

  async function addElement(svg: string) {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const targetWidth = (spec.widthIn / 4) * ppiRef.current;
    await addSvgFromString(canvas, svg, { fill: fillColor, targetWidthPx: targetWidth });
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
    setOpenSheet(null);
  }

  function addRect() {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const rect = new fabric.Rect({ left: 80, top: 80, width: 200, height: 120, fill: fillColor });
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

  function resetZoom() {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.setZoom(1);
    const vp = canvas.viewportTransform;
    if (vp) {
      vp[4] = 0;
      vp[5] = 0;
      canvas.setViewportTransform(vp);
    }
    canvas.requestRenderAll();
  }

  return (
    <div className="editor-shell flex h-[calc(100dvh-65px)] flex-col bg-paper">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-2 border-b border-ink/10 bg-white px-3 py-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="min-w-0 flex-1 rounded border border-transparent px-2 py-1 text-sm font-medium hover:border-ink/20 focus:border-ink/40 focus:outline-none"
        />
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => historyRef.current?.undo().then(syncHistoryButtons)}
            disabled={!canUndo}
            className="rounded p-1 text-base disabled:opacity-30"
            title="Undo (⌘Z)"
            aria-label="Undo"
          >
            ↶
          </button>
          <button
            type="button"
            onClick={() => historyRef.current?.redo().then(syncHistoryButtons)}
            disabled={!canRedo}
            className="rounded p-1 text-base disabled:opacity-30"
            title="Redo (⌘⇧Z)"
            aria-label="Redo"
          >
            ↷
          </button>
        </div>
        {spec.sides === 2 && (
          <div className="flex shrink-0 overflow-hidden rounded border border-ink/20 text-xs">
            <button type="button" onClick={() => setSide(0)} className={`px-2 py-1 ${side === 0 ? "bg-ink text-white" : ""}`}>
              Front
            </button>
            <button type="button" onClick={() => setSide(1)} className={`px-2 py-1 ${side === 1 ? "bg-ink text-white" : ""}`}>
              Back
            </button>
          </div>
        )}
        <span className="hidden text-xs text-ink/60 sm:inline">
          {saveState === "saving" && "Saving…"}
          {saveState === "saved" && "Saved"}
          {saveState === "error" && <span className="text-red-600">Save failed</span>}
        </span>
      </div>

      {/* Stage + desktop sidebar */}
      <div className="grid min-h-0 flex-1 lg:grid-cols-[1fr_340px]">
        <div
          ref={stageRef}
          className="relative flex min-h-0 items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_center,#ececea_0,#fafaf7_70%)] p-2 [touch-action:none]"
        >
          <canvas ref={canvasEl} className="block touch-none shadow-md" />
          <button
            type="button"
            onClick={resetZoom}
            className="absolute right-3 top-3 rounded-full border border-ink/20 bg-white/90 px-2 py-1 text-xs shadow"
            aria-label="Reset zoom"
          >
            Fit
          </button>
        </div>

        {/* Desktop sidebar */}
        <aside className="hidden border-l border-ink/10 bg-white lg:flex lg:flex-col">
          <div className="flex border-b border-ink/10 text-xs">
            {(["ai", "templates", "elements", "tools"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setSidebarTab(t)}
                className={`flex-1 px-3 py-2 capitalize ${sidebarTab === t ? "border-b-2 border-ink font-medium" : "text-ink/60"}`}
              >
                {t === "ai" ? "AI ✨" : t}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {sidebarTab === "ai" && (
              <AiPanel
                prompt={aiPrompt}
                setPrompt={setAiPrompt}
                onGenerate={generateWithAi}
                state={aiState}
                error={aiError}
              />
            )}
            {sidebarTab === "templates" && (
              <TemplateGrid templates={templates} onPick={applyTemplate} />
            )}
            {sidebarTab === "elements" && (
              <ElementsPanel onPick={(svg) => void addElement(svg)} />
            )}
            {sidebarTab === "tools" && (
              <Controls
                textValue={textValue}
                setTextValue={setTextValue}
                fontFamily={fontFamily}
                setFontFamily={applyFontToSelection}
                fillColor={fillColor}
                setFillColor={applyFillToSelection}
                onAddText={addText}
                onAddRect={addRect}
                onAddCircle={addCircle}
                onUpload={uploadImage}
                onDelete={deleteSelected}
                hasSelection={hasSelection}
              />
            )}
          </div>
          <div className="border-t border-ink/10 p-4">
            <Legend />
            {designId && (
              <Link
                href={{ pathname: "/cart", query: { add: designId, product: spec.key } }}
                className="btn-primary mt-3 w-full"
              >
                Add to cart →
              </Link>
            )}
          </div>
        </aside>
      </div>

      {/* Mobile bottom dock */}
      <div className="border-t border-ink/10 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
        {openSheet === "ai" && (
          <Sheet onClose={() => setOpenSheet(null)} title="Generate with AI ✨">
            <AiPanel
              prompt={aiPrompt}
              setPrompt={setAiPrompt}
              onGenerate={generateWithAi}
              state={aiState}
              error={aiError}
            />
          </Sheet>
        )}
        {openSheet === "templates" && (
          <Sheet onClose={() => setOpenSheet(null)} title="Pick a template">
            <TemplateGrid templates={templates} onPick={applyTemplate} compact />
            <button type="button" onClick={() => setOpenSheet(null)} className="btn mt-3 w-full">
              Start from blank
            </button>
          </Sheet>
        )}
        {openSheet === "elements" && (
          <Sheet onClose={() => setOpenSheet(null)} title="Elements">
            <ElementsPanel onPick={(svg) => { void addElement(svg); setOpenSheet(null); }} />
          </Sheet>
        )}
        {openSheet === "text" && (
          <Sheet onClose={() => setOpenSheet(null)} title="Add text">
            <input
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              placeholder="Type your text"
              className="w-full rounded border border-ink/20 px-3 py-2 text-base"
            />
            <div className="mt-3 flex gap-2">
              <button type="button" className="btn flex-1" onClick={() => setOpenSheet(null)}>Cancel</button>
              <button type="button" className="btn-primary flex-1" onClick={addText}>Add</button>
            </div>
          </Sheet>
        )}
        {openSheet === "fonts" && (
          <Sheet onClose={() => setOpenSheet(null)} title="Font">
            <div className="grid grid-cols-2 gap-2">
              {PRINT_FONTS.map((f) => (
                <button
                  key={f.family}
                  type="button"
                  className={`rounded border px-3 py-3 text-left text-base ${fontFamily === f.family ? "border-ink bg-ink text-white" : "border-ink/20"}`}
                  style={{ fontFamily: f.cssStack }}
                  onClick={() => { applyFontToSelection(f.family); setOpenSheet(null); }}
                >
                  {f.family}
                </button>
              ))}
            </div>
          </Sheet>
        )}
        {openSheet === "color" && (
          <Sheet onClose={() => setOpenSheet(null)} title="Color">
            <div className="flex items-center gap-3">
              <input type="color" value={fillColor} onChange={(e) => applyFillToSelection(e.target.value)} className="h-12 w-16 cursor-pointer rounded border border-ink/20" />
              <input type="text" value={fillColor} onChange={(e) => applyFillToSelection(e.target.value)} className="flex-1 rounded border border-ink/20 px-3 py-3 text-base font-mono" />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {["#0f172a", "#ffffff", "#ec4899", "#facc15", "#14b8a6", "#dc2626", "#2563eb", "#7c3aed"].map((c) => (
                <button key={c} type="button" onClick={() => applyFillToSelection(c)} className="h-9 w-9 rounded-full border border-ink/20" style={{ background: c }} aria-label={`Color ${c}`} />
              ))}
            </div>
          </Sheet>
        )}

        <div className="flex items-stretch gap-1 overflow-x-auto px-2 py-2">
          <DockBtn label="AI" icon="✨" onClick={() => setOpenSheet("ai")} />
          <DockBtn label="Templates" icon="✦" onClick={() => setOpenSheet("templates")} />
          <DockBtn label="Elements" icon="❖" onClick={() => setOpenSheet("elements")} />
          <DockBtn label="Text" icon="T" onClick={() => setOpenSheet("text")} />
          <DockBtn label="Rect" icon="▭" onClick={addRect} />
          <DockBtn label="Circle" icon="◯" onClick={addCircle} />
          <DockBtn
            label="Image"
            icon="🖼"
            asLabel
            input={
              <input
                type="file"
                accept="image/png,image/jpeg,image/svg+xml"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadImage(f);
                  e.target.value = "";
                }}
              />
            }
          />
          <DockBtn label="Font" icon="Aa" onClick={() => setOpenSheet("fonts")} disabled={!hasSelection} />
          <DockBtn label="Color" icon="●" onClick={() => setOpenSheet("color")} />
          <DockBtn label="Delete" icon="✕" onClick={deleteSelected} disabled={!hasSelection} />
        </div>
        <div className="flex items-center justify-between border-t border-ink/10 px-3 py-2 text-xs text-ink/60">
          <span>
            {saveState === "saving" && "Saving…"}
            {saveState === "saved" && `Saved · ${sideLabel}`}
            {saveState === "error" && <span className="text-red-600">Save failed</span>}
          </span>
          {designId && (
            <Link href={{ pathname: "/cart", query: { add: designId, product: spec.key } }} className="btn-primary px-3 py-1 text-xs">
              Add to cart →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- subcomponents ------------------------------ */

function TemplateGrid({
  templates,
  onPick,
  compact,
}: {
  templates: TemplateDef[];
  onPick: (t: TemplateDef) => void;
  compact?: boolean;
}) {
  return (
    <div className={`grid gap-2 ${compact ? "grid-cols-2" : "grid-cols-2"}`}>
      {templates.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onPick(t)}
          className="group flex flex-col gap-1 rounded border border-ink/15 p-2 text-left transition hover:border-ink"
        >
          <div className="flex h-16 overflow-hidden rounded">
            {t.swatch.map((c, i) => (
              <div key={i} className="flex-1" style={{ background: c }} />
            ))}
          </div>
          <div className="text-xs font-medium">{t.name}</div>
        </button>
      ))}
    </div>
  );
}

function AiPanel({
  prompt,
  setPrompt,
  onGenerate,
  state,
  error,
}: {
  prompt: string;
  setPrompt: (v: string) => void;
  onGenerate: () => void | Promise<void>;
  state: "idle" | "loading" | "error";
  error: string | null;
}) {
  const examples = [
    "Bold business card for Maya, a yoga instructor in Brooklyn — sage green and cream",
    "Postcard for a coffee roaster: warm tones, big '20% off' offer, modern serif type",
    "Architect's business card — black background, neon accent, ultra minimal",
  ];
  return (
    <div className="space-y-3">
      <div className="text-xs text-ink/70">
        Describe the design and the AI will fill the canvas. Editing afterwards
        works exactly like a hand-built design — undo/redo included.
      </div>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="e.g. Bold business card for Maya, a yoga instructor — sage green and cream, calming feel"
        rows={5}
        className="w-full resize-none rounded border border-ink/20 px-3 py-2 text-sm"
        disabled={state === "loading"}
      />
      <button
        type="button"
        onClick={() => void onGenerate()}
        disabled={state === "loading" || !prompt.trim()}
        className="btn-primary w-full disabled:opacity-50"
      >
        {state === "loading" ? "Generating… (5–15s)" : "Generate ✨"}
      </button>
      {state === "error" && error && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}
      <div className="space-y-1">
        <div className="text-[10px] uppercase tracking-wide text-ink/50">Try one</div>
        {examples.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => setPrompt(ex)}
            disabled={state === "loading"}
            className="block w-full rounded border border-ink/10 bg-ink/5 px-2 py-1 text-left text-[11px] text-ink/70 hover:border-ink/30"
          >
            {ex}
          </button>
        ))}
      </div>
      <div className="text-[10px] text-ink/50">
        Generated designs replace the current canvas. Use Undo (⌘Z) to revert.
      </div>
    </div>
  );
}

function ElementsPanel({ onPick }: { onPick: (svg: string) => void }) {
  const [activeCat, setActiveCat] = useState<ElementCategory>("shapes");
  const items = elementsByCategory(activeCat);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1 text-xs">
        {ELEMENT_CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setActiveCat(c.id)}
            className={`rounded px-2 py-1 ${activeCat === c.id ? "bg-ink text-white" : "bg-ink/5 text-ink/70"}`}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-2">
        {items.map((el) => (
          <button
            key={el.id}
            type="button"
            onClick={() => onPick(el.svg)}
            className="flex aspect-square items-center justify-center rounded border border-ink/15 bg-white p-2 text-ink hover:border-ink"
            title={el.name}
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: el.svg }}
          />
        ))}
      </div>
    </div>
  );
}

function Controls(props: {
  textValue: string;
  setTextValue: (v: string) => void;
  fontFamily: string;
  setFontFamily: (v: string) => void;
  fillColor: string;
  setFillColor: (v: string) => void;
  onAddText: () => void;
  onAddRect: () => void;
  onAddCircle: () => void;
  onUpload: (f: File) => void;
  onDelete: () => void;
  hasSelection: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="text-xs font-medium uppercase tracking-wide text-ink/60">Add</div>
        <input
          value={props.textValue}
          onChange={(e) => props.setTextValue(e.target.value)}
          placeholder="Text content"
          className="w-full rounded border border-ink/20 px-2 py-1 text-sm"
        />
        <div className="grid grid-cols-3 gap-2">
          <button type="button" className="btn" onClick={props.onAddText}>Text</button>
          <button type="button" className="btn" onClick={props.onAddRect}>Rect</button>
          <button type="button" className="btn" onClick={props.onAddCircle}>Circle</button>
        </div>
        <label className="btn block cursor-pointer text-center">
          Upload image
          <input
            type="file"
            accept="image/png,image/jpeg,image/svg+xml"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) props.onUpload(f);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      <div className="space-y-2">
        <div className="text-xs font-medium uppercase tracking-wide text-ink/60">Style</div>
        <select
          value={props.fontFamily}
          onChange={(e) => props.setFontFamily(e.target.value)}
          className="w-full rounded border border-ink/20 px-2 py-1 text-sm"
        >
          {PRINT_FONTS.map((f) => (
            <option key={f.family} value={f.family}>{f.family}</option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <input type="color" value={props.fillColor} onChange={(e) => props.setFillColor(e.target.value)} className="h-8 w-8 cursor-pointer rounded border border-ink/20" />
          <input type="text" value={props.fillColor} onChange={(e) => props.setFillColor(e.target.value)} className="flex-1 rounded border border-ink/20 px-2 py-1 text-sm font-mono" />
        </div>
        <button type="button" className="btn w-full" onClick={props.onDelete} disabled={!props.hasSelection}>
          Delete selected
        </button>
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="text-xs text-ink/60 space-y-1">
      <div><span className="inline-block h-2 w-3 align-middle border border-red-500 mr-1" />Bleed</div>
      <div><span className="inline-block h-2 w-3 align-middle border border-ink mr-1" />Trim</div>
      <div><span className="inline-block h-2 w-3 align-middle border border-blue-500 mr-1" />Safe</div>
    </div>
  );
}

function Sheet({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="max-h-[60vh] overflow-y-auto border-b border-ink/10 bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-medium">{title}</div>
        <button type="button" onClick={onClose} className="text-sm text-ink/60">Close</button>
      </div>
      {children}
    </div>
  );
}

function DockBtn({
  label,
  icon,
  onClick,
  disabled,
  asLabel,
  input,
}: {
  label: string;
  icon: string;
  onClick?: () => void;
  disabled?: boolean;
  asLabel?: boolean;
  input?: React.ReactNode;
}) {
  const cls =
    "flex min-w-[64px] flex-col items-center justify-center gap-0.5 rounded px-3 py-2 text-[11px] font-medium text-ink active:bg-ink/10 disabled:opacity-40";
  if (asLabel) {
    return (
      <label className={cls}>
        <span className="text-lg leading-none">{icon}</span>
        {label}
        {input}
      </label>
    );
  }
  return (
    <button type="button" className={cls} onClick={onClick} disabled={disabled}>
      <span className="text-lg leading-none">{icon}</span>
      {label}
    </button>
  );
}
