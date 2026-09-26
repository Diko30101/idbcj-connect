"use client";

import { useRef, useEffect, useState } from "react";

// Electronic signature pad — canvas na nagse-save ng base64 PNG sa hidden input.
// Ginagamit sa Humiling ng Hiram form bilang katunayan ng pananagutan ng nanghihiram.
export function SignaturePad({ name }: { name: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [hasDrawn, setHasDrawn] = useState(false);
  const drawing = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = r.width * dpr;
      canvas.height = 160 * dpr;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(dpr, dpr);
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.strokeStyle = "#111827";
      }
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  const pos = (e: React.MouseEvent | React.TouchEvent): [number, number] => {
    const canvas = canvasRef.current!;
    const r = canvas.getBoundingClientRect();
    if ("touches" in e && e.touches.length > 0) {
      return [e.touches[0].clientX - r.left, e.touches[0].clientY - r.top];
    }
    const m = e as React.MouseEvent;
    return [m.clientX - r.left, m.clientY - r.top];
  };

  const start = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    drawing.current = true;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const [x, y] = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const move = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing.current) return;
    e.preventDefault();
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const [x, y] = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!hasDrawn) setHasDrawn(true);
  };

  const end = () => {
    if (drawing.current && canvasRef.current && inputRef.current) {
      drawing.current = false;
      inputRef.current.value = canvasRef.current.toDataURL("image/png");
    } else {
      drawing.current = false;
    }
  };

  const clear = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (inputRef.current) inputRef.current.value = "";
    setHasDrawn(false);
  };

  return (
    <div>
      <div className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50">
        <canvas
          ref={canvasRef}
          className="block h-40 w-full cursor-crosshair touch-none"
          onMouseDown={start}
          onMouseMove={move}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={start}
          onTouchMove={move}
          onTouchEnd={end}
        />
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-gray-500">
          {hasDrawn ? "✓ May pirma na" : "Pirmahan gamit ang daliri o mouse sa kahon."}
        </span>
        <button type="button" onClick={clear} className="rounded-md border border-gray-300 bg-gray-100 px-3 py-1 text-xs text-gray-700 hover:bg-gray-200">
          Burahin ang pirma
        </button>
      </div>
      <input ref={inputRef} type="hidden" name={name} />
    </div>
  );
}
