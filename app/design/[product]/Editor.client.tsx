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

type Tool = null | "text" | "style" | "fonts";

export default function Editor({ spec, initialDesignId }: Props) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasEl = useRef<HTMLCanvasElement | null>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  const guidesRef = useRef<fabric.Object[]>([]);
  const ppiRef = useRef<number>(spec.dpi);
  const initedRef = useRef(false);

  const [side, setSide] = useState(0);
  const [doc, setDoc] = useState<DesignDocument>(() => emptyDesign(spec.key, spec.sides));
  const [designId, setDesignId] = useState<string | null>(initialDesignId);
  const [name, setName] = useState("Untitled design");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [textValue, setTextValue] = useState("Your text");
  const [fontFamily, setFontFamily] = useState(DEFAULT_FONT.family);
  const [fillColor, setFillColor] = useState("#111111");
  const [openTool, setOpenTool] = useState<Tool>(null);
  const [hasSelection, setHasSelection] = useState(false);
  const skipNextChangeRef = useRef(false);

  const sideLabel = useMemo(
    () => (spec.sides === 2 ? (side === 0 ? "Front" : "Back") : "Single side"),
    [spec.sides, side],
  );

  // Build canvas + ResizeObserver to keep the canvas the right size for the
  // viewport. We rebuild the Fabric canvas on size change because changing
  // the display ppi mid-flight breaks coordinate math.
  useEffect(() => {
    if (!canvasEl.current || !stageRef.current) return;

    function build() {
      const stage = stageRef.current;
      const el = canvasEl.current;
      if (!stage || !el) return;
      // Available space for the artwork inside the stage padding.
      const w = stage.clientWidth - 16;
      const h = stage.clientHeight - 16;
      // Tear down previous instance before rebuilding (size changed).
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
      // Re-hydrate current side
      void loadSide(chrome.canvas, chrome.guides, doc.sides[side] ?? null).then(() => {
        guidesRef.current = drawGuides(chrome.canvas, spec, chrome.displayPpi);
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
        // zoom
        const z = Math.max(0.4, Math.min(5, canvas.getZoom() * (d / lastDist)));
        canvas.zoomToPoint(point, z);
        // pan (delta of midpoint)
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

    if (initialDesignId) {
      void loadDesign(initialDesignId);
    }

    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
      fabricRef.current?.dispose();
      fabricRef.current = null;
      initedRef.current = false;
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
    if (!canvas || !initedRef.current) return;
    skipNextChangeRef.current = true;
    void loadSide(canvas, guidesRef.current, doc.sides[side] ?? null).then(() => {
      for (const g of guidesRef.current) canvas.remove(g);
      guidesRef.current = drawGuides(canvas, spec, ppiRef.current);
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
    setOpenTool(null);
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
        {spec.sides === 2 && (
          <div className="flex shrink-0 overflow-hidden rounded border border-ink/20 text-xs">
            <button
              type="button"
              onClick={() => setSide(0)}
              className={`px-2 py-1 ${side === 0 ? "bg-ink text-white" : ""}`}
            >
              Front
            </button>
            <button
              type="button"
              onClick={() => setSide(1)}
              className={`px-2 py-1 ${side === 1 ? "bg-ink text-white" : ""}`}
            >
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
      <div className="grid min-h-0 flex-1 lg:grid-cols-[1fr_320px]">
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
        <aside className="hidden border-l border-ink/10 bg-white p-4 lg:block">
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
          <Legend className="mt-4" />
          {designId && (
            <Link
              href={{ pathname: "/cart", query: { add: designId, product: spec.key } }}
              className="btn-primary mt-4 w-full"
            >
              Add to cart →
            </Link>
          )}
        </aside>
      </div>

      {/* Mobile bottom dock */}
      <div className="border-t border-ink/10 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
        {openTool === "text" && (
          <Sheet onClose={() => setOpenTool(null)} title="Add text">
            <input
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              placeholder="Type your text"
              className="w-full rounded border border-ink/20 px-3 py-2 text-base"
            />
            <div className="mt-3 flex gap-2">
              <button type="button" className="btn flex-1" onClick={() => setOpenTool(null)}>
                Cancel
              </button>
              <button type="button" className="btn-primary flex-1" onClick={addText}>
                Add
              </button>
            </div>
          </Sheet>
        )}
        {openTool === "fonts" && (
          <Sheet onClose={() => setOpenTool(null)} title="Font">
            <div className="grid grid-cols-2 gap-2">
              {PRINT_FONTS.map((f) => (
                <button
                  key={f.family}
                  type="button"
                  className={`rounded border px-3 py-3 text-left text-base ${fontFamily === f.family ? "border-ink bg-ink text-white" : "border-ink/20"}`}
                  style={{ fontFamily: f.cssStack }}
                  onClick={() => {
                    applyFontToSelection(f.family);
                    setOpenTool(null);
                  }}
                >
                  {f.family}
                </button>
              ))}
            </div>
          </Sheet>
        )}
        {openTool === "style" && (
          <Sheet onClose={() => setOpenTool(null)} title="Color">
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={fillColor}
                onChange={(e) => applyFillToSelection(e.target.value)}
                className="h-12 w-16 cursor-pointer rounded border border-ink/20"
              />
              <input
                type="text"
                value={fillColor}
                onChange={(e) => applyFillToSelection(e.target.value)}
                className="flex-1 rounded border border-ink/20 px-3 py-3 text-base font-mono"
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {["#111111", "#ffffff", "#dc2626", "#ea580c", "#facc15", "#16a34a", "#2563eb", "#7c3aed"].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => applyFillToSelection(c)}
                  className="h-9 w-9 rounded-full border border-ink/20"
                  style={{ background: c }}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
          </Sheet>
        )}

        <div className="flex items-stretch gap-1 overflow-x-auto px-2 py-2">
          <DockBtn label="Text" onClick={() => setOpenTool("text")} icon="T" />
          <DockBtn label="Rect" onClick={addRect} icon="▭" />
          <DockBtn label="Circle" onClick={addCircle} icon="◯" />
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
          <DockBtn label="Font" onClick={() => setOpenTool("fonts")} icon="Aa" disabled={!hasSelection} />
          <DockBtn label="Color" onClick={() => setOpenTool("style")} icon="●" />
          <DockBtn label="Delete" onClick={deleteSelected} icon="✕" disabled={!hasSelection} />
        </div>
        <div className="flex items-center justify-between border-t border-ink/10 px-3 py-2 text-xs text-ink/60">
          <span>
            {saveState === "saving" && "Saving…"}
            {saveState === "saved" && `Saved · ${sideLabel}`}
            {saveState === "error" && <span className="text-red-600">Save failed</span>}
          </span>
          {designId && (
            <Link
              href={{ pathname: "/cart", query: { add: designId, product: spec.key } }}
              className="btn-primary px-3 py-1 text-xs"
            >
              Add to cart →
            </Link>
          )}
        </div>
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
            <option key={f.family} value={f.family}>
              {f.family}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={props.fillColor}
            onChange={(e) => props.setFillColor(e.target.value)}
            className="h-8 w-8 cursor-pointer rounded border border-ink/20"
          />
          <input
            type="text"
            value={props.fillColor}
            onChange={(e) => props.setFillColor(e.target.value)}
            className="flex-1 rounded border border-ink/20 px-2 py-1 text-sm font-mono"
          />
        </div>
        <button type="button" className="btn w-full" onClick={props.onDelete} disabled={!props.hasSelection}>
          Delete selected
        </button>
      </div>
    </div>
  );
}

function Legend({ className = "" }: { className?: string }) {
  return (
    <div className={`text-xs text-ink/60 space-y-1 ${className}`}>
      <div>
        <span className="inline-block h-2 w-3 align-middle border border-red-500 mr-1" />
        Bleed (extend artwork to here)
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
  );
}

function Sheet({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="border-b border-ink/10 bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-medium">{title}</div>
        <button type="button" onClick={onClose} className="text-sm text-ink/60">
          Close
        </button>
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
