import {
  Circle,
  Download,
  ImagePlus,
  Info,
  Play,
  Square,
  Trash2,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface CharacterData {
  id: string;
  img: HTMLImageElement;
  x: number;
  y: number;
  w: number;
  h: number;
  name: string;
}

let charIdCounter = 0;
function nextCharId() {
  charIdCounter += 1;
  return `char-${charIdCounter}`;
}

type StudioStatus = "idle" | "running" | "recording";

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const backgroundRef = useRef<HTMLImageElement | null>(null);
  const charactersRef = useRef<CharacterData[]>([]);
  const selectedRef = useRef<CharacterData | null>(null);
  const runningRef = useRef(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const rafRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);

  const [status, setStatus] = useState<StudioStatus>("idle");
  const [isRecording, setIsRecording] = useState(false);
  const [bgName, setBgName] = useState<string | null>(null);
  const [charList, setCharList] = useState<{ id: string; name: string }[]>([]);
  const [charCount, setCharCount] = useState(0);
  const [recordReady, setRecordReady] = useState(false);
  const fps = 30;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background
    const bg = backgroundRef.current;
    if (bg?.complete && bg.naturalWidth > 0) {
      ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);
    } else {
      // Default gradient background
      const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      grad.addColorStop(0, "#0d0d1a");
      grad.addColorStop(0.5, "#1a1a2e");
      grad.addColorStop(1, "#0d0d1a");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Grid lines for empty state
      ctx.strokeStyle = "rgba(100, 200, 255, 0.04)";
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
    }

    // Draw characters
    for (const c of charactersRef.current) {
      if (c.img.complete && c.img.naturalWidth > 0) {
        ctx.drawImage(c.img, c.x, c.y, c.w, c.h);

        // Selection highlight
        if (c === selectedRef.current) {
          ctx.strokeStyle = "rgba(100, 220, 255, 0.9)";
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 3]);
          ctx.strokeRect(c.x - 2, c.y - 2, c.w + 4, c.h + 4);
          ctx.setLineDash([]);
        }
      }
    }
  }, []);

  const animate = useCallback(() => {
    if (!runningRef.current) return;
    draw();
    rafRef.current = requestAnimationFrame(animate);
  }, [draw]);

  const start = useCallback(() => {
    if (runningRef.current) return;
    runningRef.current = true;
    setStatus(isRecording ? "recording" : "running");
    animate();
  }, [animate, isRecording]);

  const stop = useCallback(() => {
    runningRef.current = false;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setStatus(isRecording ? "recording" : "idle");
    draw(); // final draw so canvas isn't blank
  }, [draw, isRecording]);

  const handleRecord = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    chunksRef.current = [];
    const stream = canvas.captureStream(fps);

    let mimeType = "video/webm;codecs=vp9";
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = "video/webm;codecs=vp8";
    }
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = "video/webm";
    }

    const rec = new MediaRecorder(stream, { mimeType });
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };
    rec.start(100);
    recorderRef.current = rec;

    setIsRecording(true);
    setRecordReady(false);
    setStatus("recording");

    // Auto-start animation if not running
    if (!runningRef.current) {
      runningRef.current = true;
      animate();
    }
  }, [animate]);

  const handleDownloadVideo = useCallback(() => {
    const rec = recorderRef.current;
    if (!rec) return;

    rec.stop();
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "animation.webm";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setIsRecording(false);
      setRecordReady(false);
      setStatus(runningRef.current ? "running" : "idle");
    };
  }, []);

  // Keyboard control
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const chars = charactersRef.current;
      if (!chars.length) return;
      const c = chars[0];
      const speed = 8;
      let moved = false;
      if (e.key === "ArrowRight") {
        c.x += speed;
        moved = true;
      }
      if (e.key === "ArrowLeft") {
        c.x -= speed;
        moved = true;
      }
      if (e.key === "ArrowUp") {
        c.y -= speed;
        moved = true;
      }
      if (e.key === "ArrowDown") {
        c.y += speed;
        moved = true;
      }
      if (moved) {
        e.preventDefault();
        if (!runningRef.current) draw();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [draw]);

  // Canvas mouse interactions
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const mx = (e.clientX - rect.left) * scaleX;
      const my = (e.clientY - rect.top) * scaleY;

      selectedRef.current = null;
      const chars = [...charactersRef.current].reverse(); // top-to-bottom click priority
      for (const c of chars) {
        if (mx > c.x && mx < c.x + c.w && my > c.y && my < c.y + c.h) {
          selectedRef.current = c;
          isDraggingRef.current = true;
          break;
        }
      }
      if (!runningRef.current) draw();
    },
    [draw],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDraggingRef.current || !selectedRef.current) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const c = selectedRef.current;
      c.x = (e.clientX - rect.left) * scaleX - c.w / 2;
      c.y = (e.clientY - rect.top) * scaleY - c.h / 2;
      if (!runningRef.current) draw();
    },
    [draw],
  );

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;
    selectedRef.current = null;
    if (!runningRef.current) draw();
  }, [draw]);

  // Background upload
  const handleBgUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          backgroundRef.current = img;
          setBgName(file.name);
          if (!runningRef.current) draw();
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
      e.target.value = ""; // allow re-upload of same file
    },
    [draw],
  );

  // Character upload
  const handleCharUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;
      const newEntries: { id: string; name: string }[] = [];
      let loaded = 0;
      const total = files.length;

      for (const file of Array.from(files)) {
        const charId = nextCharId();
        const charName = file.name.replace(/\.[^.]+$/, "");
        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
            const char: CharacterData = {
              id: charId,
              img,
              x: 100 + Math.random() * 600,
              y: 150 + Math.random() * 200,
              w: 150,
              h: 150,
              name: charName,
            };
            charactersRef.current.push(char);
            newEntries.push({ id: charId, name: charName });
            loaded++;
            if (loaded === total) {
              setCharList((prev) => [...prev, ...newEntries]);
              setCharCount(charactersRef.current.length);
              if (!runningRef.current) draw();
            }
          };
          img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
      }
      e.target.value = "";
    },
    [draw],
  );

  const removeCharacter = useCallback(
    (id: string) => {
      const idx = charactersRef.current.findIndex((c) => c.id === id);
      if (idx !== -1) charactersRef.current.splice(idx, 1);
      setCharList((prev) => prev.filter((c) => c.id !== id));
      setCharCount(charactersRef.current.length);
      if (!runningRef.current) draw();
    },
    [draw],
  );

  const clearBackground = useCallback(() => {
    backgroundRef.current = null;
    setBgName(null);
    if (!runningRef.current) draw();
  }, [draw]);

  // Initial draw
  useEffect(() => {
    draw();
  }, [draw]);

  // Update record ready state
  useEffect(() => {
    if (isRecording) setRecordReady(true);
  }, [isRecording]);

  const statusLabel = {
    idle: "IDLE",
    running: "PLAYING",
    recording: "RECORDING",
  }[status];

  const currentYear = new Date().getFullYear();

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: "#0d0d18" }}
    >
      {/* Header */}
      <header
        className="flex items-center justify-between px-6 py-3 border-b border-border"
        style={{ backgroundColor: "#0d0d18" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-7 h-7 rounded flex items-center justify-center"
            style={{
              background:
                "linear-gradient(135deg, oklch(0.78 0.18 195), oklch(0.72 0.22 310))",
            }}
          >
            <Play size={14} className="text-white ml-0.5" />
          </div>
          <h1
            className="font-display font-bold text-lg tracking-tight glow-text-cyan"
            style={{ color: "oklch(0.94 0.04 195)" }}
          >
            Browser Anime Studio
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="status-dot"
            style={{ display: "inline-block" }}
            aria-hidden="true"
          >
            <span
              className={`status-dot ${status === "recording" ? "recording" : status === "running" ? "running" : "idle"}`}
            />
          </span>
          <span
            className="font-mono text-xs tracking-widest"
            style={{
              color:
                status === "recording"
                  ? "oklch(0.65 0.22 25)"
                  : status === "running"
                    ? "oklch(0.75 0.2 120)"
                    : "oklch(0.4 0.01 255)",
            }}
          >
            {statusLabel}
          </span>
        </div>
      </header>

      {/* Main layout */}
      <main className="flex flex-1 overflow-hidden">
        {/* Left sidebar - controls */}
        <aside
          className="w-64 flex-shrink-0 flex flex-col border-r border-border overflow-y-auto"
          style={{ backgroundColor: "#0e0e1a" }}
        >
          <div className="p-4 space-y-5">
            {/* Background Section */}
            <section>
              <p className="section-label mb-2">Background</p>
              <div className="space-y-2">
                <label
                  htmlFor="bgUpload"
                  className="upload-label w-full justify-center"
                  data-ocid="studio.upload_button"
                >
                  <ImagePlus size={14} />
                  {bgName ? "Change BG" : "Load Background"}
                </label>
                <input
                  type="file"
                  id="bgUpload"
                  accept="image/*"
                  className="file-input-styled"
                  onChange={handleBgUpload}
                  data-ocid="studio.upload_button"
                />
                {bgName && (
                  <div className="flex items-center gap-1">
                    <span className="char-item flex-1 truncate" title={bgName}>
                      {bgName.length > 18 ? `${bgName.slice(0, 16)}…` : bgName}
                    </span>
                    <button
                      type="button"
                      className="studio-btn studio-btn-danger px-2 py-1"
                      onClick={clearBackground}
                      title="Remove background"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
              </div>
            </section>

            {/* Characters Section */}
            <section>
              <p className="section-label mb-2">Characters ({charCount})</p>
              <div className="space-y-2">
                <label
                  htmlFor="charUpload"
                  className="upload-label w-full justify-center"
                  data-ocid="studio.char_upload_button"
                >
                  <Users size={14} />
                  Add Characters
                </label>
                <input
                  type="file"
                  id="charUpload"
                  accept="image/*"
                  multiple
                  className="file-input-styled"
                  onChange={handleCharUpload}
                  data-ocid="studio.char_upload_button"
                />
                {charList.length > 0 ? (
                  <div className="space-y-1">
                    {charList.map((entry, i) => (
                      <div
                        key={entry.id}
                        className="char-item justify-between"
                        data-ocid={`studio.item.${i + 1}`}
                      >
                        <span className="truncate flex-1" title={entry.name}>
                          {entry.name.length > 14
                            ? `${entry.name.slice(0, 12)}…`
                            : entry.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeCharacter(entry.id)}
                          className="ml-1 opacity-50 hover:opacity-100 transition-opacity"
                          title={`Remove ${entry.name}`}
                          data-ocid={`studio.delete_button.${i + 1}`}
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    className="char-item text-center justify-center opacity-40"
                    data-ocid="studio.empty_state"
                  >
                    No characters yet
                  </div>
                )}
              </div>
            </section>

            {/* Playback Controls */}
            <section>
              <p className="section-label mb-2">Playback</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="studio-btn studio-btn-primary justify-center"
                  onClick={start}
                  disabled={runningRef.current}
                  data-ocid="studio.start_button"
                >
                  <Play size={13} />
                  Start
                </button>
                <button
                  type="button"
                  className="studio-btn justify-center"
                  onClick={stop}
                  data-ocid="studio.stop_button"
                >
                  <Square size={13} />
                  Stop
                </button>
              </div>
            </section>

            {/* Recording Controls */}
            <section>
              <p className="section-label mb-2">Recording</p>
              <div className="space-y-2">
                <button
                  type="button"
                  className={`studio-btn w-full justify-center ${isRecording ? "studio-btn-danger" : "studio-btn-accent"}`}
                  onClick={handleRecord}
                  disabled={isRecording}
                  data-ocid="studio.record_button"
                >
                  <Circle
                    size={13}
                    className={isRecording ? "fill-current" : ""}
                  />
                  {isRecording ? "Recording…" : "Record"}
                </button>
                <button
                  type="button"
                  className="studio-btn w-full justify-center"
                  onClick={handleDownloadVideo}
                  disabled={!recordReady}
                  style={{
                    opacity: recordReady ? 1 : 0.4,
                    cursor: recordReady ? "pointer" : "not-allowed",
                  }}
                  data-ocid="studio.download_button"
                >
                  <Download size={13} />
                  Download .webm
                </button>
              </div>
            </section>

            {/* Help */}
            <section>
              <p className="section-label mb-2">Controls</p>
              <div
                className="space-y-1.5 text-xs font-mono"
                style={{ color: "oklch(0.5 0.015 255)" }}
              >
                <div className="flex justify-between">
                  <span>Drag</span>
                  <span>Move character</span>
                </div>
                <div className="flex justify-between">
                  <span>↑↓←→</span>
                  <span>Move first char</span>
                </div>
                <div className="flex justify-between">
                  <span>Record → Stop</span>
                  <span>Capture video</span>
                </div>
              </div>
            </section>
          </div>
        </aside>

        {/* Canvas area */}
        <div
          className="flex-1 flex flex-col items-center justify-center p-6"
          style={{ backgroundColor: "#0a0a15" }}
        >
          <div
            className="relative canvas-scanlines rounded overflow-hidden glow-cyan"
            style={{ maxWidth: "100%", maxHeight: "calc(100vh - 130px)" }}
          >
            <canvas
              ref={canvasRef}
              id="scene"
              width={960}
              height={540}
              className="block cursor-crosshair"
              style={{
                background: "#1a1a2e",
                maxWidth: "100%",
                maxHeight: "calc(100vh - 130px)",
                width: "auto",
                height: "auto",
                display: "block",
              }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              data-ocid="studio.canvas_target"
            />
          </div>

          {/* Canvas info bar */}
          <div
            className="flex items-center gap-4 mt-3"
            style={{ color: "oklch(0.4 0.01 255)" }}
          >
            <span className="font-mono text-xs">960 × 540</span>
            <span className="font-mono text-xs">·</span>
            <span className="font-mono text-xs">{fps} fps</span>
            <span className="font-mono text-xs">·</span>
            <span className="font-mono text-xs">
              {charCount} character{charCount !== 1 ? "s" : ""}
            </span>
            {isRecording && (
              <>
                <span className="font-mono text-xs">·</span>
                <span
                  className="font-mono text-xs flex items-center gap-1.5"
                  style={{ color: "oklch(0.65 0.22 25)" }}
                >
                  <span className="status-dot recording inline-block" />
                  REC
                </span>
              </>
            )}
          </div>

          {/* Tip */}
          {charCount === 0 && !bgName && (
            <div
              className="flex items-center gap-2 mt-4 px-4 py-2 rounded border border-border text-xs font-mono"
              style={{
                color: "oklch(0.5 0.015 255)",
                backgroundColor: "oklch(0.12 0.01 265 / 0.5)",
              }}
            >
              <Info size={12} />
              Load a background and characters from the sidebar to get started
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer
        className="px-6 py-2 border-t border-border flex items-center justify-between"
        style={{ backgroundColor: "#0d0d18" }}
      >
        <span
          className="font-mono text-xs"
          style={{ color: "oklch(0.35 0.01 255)" }}
        >
          Browser Anime Studio — drag, animate, record
        </span>
        <span
          className="font-mono text-xs"
          style={{ color: "oklch(0.35 0.01 255)" }}
        >
          © {currentYear}.{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(typeof window !== "undefined" ? window.location.hostname : "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline transition-colors"
            style={{ color: "oklch(0.55 0.08 195)" }}
          >
            Built with ♥ using caffeine.ai
          </a>
        </span>
      </footer>
    </div>
  );
}
