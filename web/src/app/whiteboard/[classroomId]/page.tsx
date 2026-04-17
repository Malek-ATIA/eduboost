"use client";
import Link from "next/link";
import { use, useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { currentSession } from "@/lib/cognito";

type Point = [number, number];

type Stroke = {
  points: Point[];
  color: string;
  width: number;
  authorId: string;
  at: string;
};

type BoardResponse = {
  classroomId: string;
  strokes: Stroke[];
  version: number;
};

type ClassroomResponse = {
  classroomId: string;
  teacherId: string;
};

const CANVAS_W = 10_000;
const CANVAS_H = 5625;
const DISPLAY_W = 1000;
const DISPLAY_H = 562;
const POLL_MS = 2500;
const MAX_POINTS_PER_STROKE = 250;

const PALETTE = ["#111111", "#d72638", "#1f7a8c", "#f79824", "#4caf50", "#ffffff"];

export default function WhiteboardPage({
  params,
}: {
  params: Promise<{ classroomId: string }>;
}) {
  const { classroomId } = use(params);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const versionRef = useRef<number>(0);
  const pendingRef = useRef<Stroke[]>([]);
  const drawingRef = useRef<Stroke | null>(null);
  const [color, setColor] = useState(PALETTE[0]);
  const [width, setWidth] = useState(3);
  const [error, setError] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [isTeacher, setIsTeacher] = useState(false);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, DISPLAY_W, DISPLAY_H);
    const all: Stroke[] = [
      ...strokesRef.current,
      ...pendingRef.current,
      ...(drawingRef.current ? [drawingRef.current] : []),
    ];
    for (const s of all) {
      if (s.points.length === 0) continue;
      ctx.strokeStyle = s.color;
      // Stroke width is stored in display pixels directly — the canvas is a
      // fixed 1000x562 viewport in this MVP, so no canvas/display ratio scaling
      // is needed here (point x/y are rescaled below because they use the full
      // 10000-unit canvas coordinate space).
      ctx.lineWidth = s.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      const first = s.points[0];
      if (!first) continue;
      ctx.moveTo((first[0] / CANVAS_W) * DISPLAY_W, (first[1] / CANVAS_H) * DISPLAY_H);
      for (let i = 1; i < s.points.length; i++) {
        const p = s.points[i];
        if (!p) continue;
        ctx.lineTo((p[0] / CANVAS_W) * DISPLAY_W, (p[1] / CANVAS_H) * DISPLAY_H);
      }
      ctx.stroke();
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const r = await api<BoardResponse>(`/whiteboard/classroom/${classroomId}`);
      // Use strict > so an identical-version refresh doesn't trigger a
      // redundant re-render (common: we just posted a stroke and the board's
      // version hasn't advanced from another client in the intervening 2.5s).
      if (r.version > versionRef.current) {
        strokesRef.current = r.strokes;
        versionRef.current = r.version;
        render();
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }, [classroomId, render]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await currentSession();
        const sub = (s?.getIdToken().payload.sub as string | undefined) ?? null;
        const classroom = await api<ClassroomResponse>(`/classrooms/${classroomId}`);
        if (!cancelled) setIsTeacher(sub !== null && sub === classroom.teacherId);
      } catch {
        // Non-teachers without classroom-get access just see a disabled button.
        if (!cancelled) setIsTeacher(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [classroomId]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, POLL_MS);
    return () => clearInterval(t);
  }, [refresh]);

  function toCanvasCoords(e: React.PointerEvent<HTMLCanvasElement>): Point {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * CANVAS_W);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * CANVAS_H);
    return [
      Math.max(0, Math.min(CANVAS_W, x)),
      Math.max(0, Math.min(CANVAS_H, y)),
    ];
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = toCanvasCoords(e);
    drawingRef.current = {
      points: [p],
      color,
      width,
      authorId: "me",
      at: new Date().toISOString(),
    };
    render();
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const p = toCanvasCoords(e);
    const last = drawingRef.current.points[drawingRef.current.points.length - 1];
    if (last && last[0] === p[0] && last[1] === p[1]) return;
    if (drawingRef.current.points.length >= MAX_POINTS_PER_STROKE) return;
    drawingRef.current.points.push(p);
    render();
  }

  async function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.releasePointerCapture(e.pointerId);
    const s = drawingRef.current;
    drawingRef.current = null;
    if (!s || s.points.length < 1) return;
    pendingRef.current.push(s);
    render();
    try {
      await api(`/whiteboard/classroom/${classroomId}/strokes`, {
        method: "POST",
        body: JSON.stringify({ points: s.points, color: s.color, width: s.width }),
      });
      // Remove from pending (server refresh will bring it back)
      pendingRef.current = pendingRef.current.filter((p) => p !== s);
      await refresh();
    } catch (err) {
      pendingRef.current = pendingRef.current.filter((p) => p !== s);
      setError((err as Error).message);
      render();
    }
  }

  async function clearBoard() {
    if (!confirm("Clear the whiteboard for everyone?")) return;
    setClearing(true);
    setError(null);
    try {
      await api(`/whiteboard/classroom/${classroomId}`, { method: "DELETE" });
      strokesRef.current = [];
      pendingRef.current = [];
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setClearing(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Whiteboard</h1>
          <p className="mt-1 text-xs text-gray-500">
            Classroom <span className="font-mono">{classroomId}</span> · changes
            sync every {POLL_MS / 1000}s.
          </p>
        </div>
        <button
          onClick={clearBoard}
          disabled={clearing || !isTeacher}
          title={!isTeacher ? "Only the classroom teacher can clear the board" : undefined}
          className="rounded border px-3 py-1 text-sm text-red-600 disabled:opacity-50"
        >
          {clearing ? "Clearing..." : "Clear board (teacher)"}
        </button>
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-3 rounded border px-3 py-2">
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500">Color:</span>
          {PALETTE.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`h-6 w-6 rounded border-2 ${
                c === color ? "border-black dark:border-white" : "border-transparent"
              }`}
              style={{ backgroundColor: c }}
              aria-label={`color ${c}`}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Width:</span>
          <input
            type="range"
            min={1}
            max={40}
            value={width}
            onChange={(e) => setWidth(Number(e.target.value))}
          />
          <span className="w-6 text-xs">{width}</span>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded border bg-white">
        <canvas
          ref={canvasRef}
          width={DISPLAY_W}
          height={DISPLAY_H}
          className="block w-full touch-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      </div>

      <p className="mt-6 text-sm">
        <Link href="/dashboard" className="text-gray-500 underline">
          ← Dashboard
        </Link>
      </p>
    </main>
  );
}
