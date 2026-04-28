import React, { useEffect, useRef, useState } from "react";
import {
  AbsoluteFill,
  getRemotionEnvironment,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { useComments } from "./useComments.js";
import { Comment, CommentsConfig, DEFAULT_LIFETIME_SEC } from "./types.js";

interface Props extends CommentsConfig {
  compositionId: string;
  /** Multiplier so the panel renders well at typical 25% Studio zoom on 4K
   * compositions. Default: 4. Use 1 for 1080p, 2 for 2K. */
  scale?: number;
  /** Hide the floating indicator after this many ms of inactivity. Default
   * 2000. Set to 0 to keep visible always. */
  autoHideMs?: number;
  /** Keyboard shortcut to enter pinning mode. Default: "c" */
  shortcut?: string;
  /** When the playhead passes within this many seconds of a pin's anchor, the
   * pin is shown. Default: 2. */
  lifetimeSec?: number;
}

const formatTime = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = (s - m * 60).toFixed(1);
  return `${m}:${sec.padStart(4, "0")}`;
};

export const CommentsPanel: React.FC<Props> = ({
  compositionId,
  scale = 4,
  autoHideMs = 2000,
  shortcut = "c",
  filePath,
  lifetimeSec = DEFAULT_LIFETIME_SEC,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const atSec = frame / fps;
  const isRendering = getRemotionEnvironment().isRendering;

  const px = (n: number) => n * scale;

  const { comments, add, remove } = useComments({ filePath });

  const [open, setOpen] = useState(false);
  /** Pinning mode: when true, clicks on the preview drop a pin */
  const [pinning, setPinning] = useState(false);
  const [formText, setFormText] = useState("");
  const [formAt, setFormAt] = useState<{
    atSec: number;
    posX?: number;
    posY?: number;
  }>({ atSec: 0 });
  const [visible, setVisible] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const catcherRef = useRef<HTMLDivElement | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-hide indicator
  useEffect(() => {
    if (autoHideMs <= 0) {
      setVisible(true);
      return;
    }
    const reset = () => {
      setVisible(true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => {
        if (!open && !pinning) setVisible(false);
      }, autoHideMs);
    };
    reset();
    window.addEventListener("mousemove", reset);
    window.addEventListener("keydown", reset);
    return () => {
      window.removeEventListener("mousemove", reset);
      window.removeEventListener("keydown", reset);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [open, pinning, autoHideMs]);

  // Keyboard: shortcut → enter pinning mode. Esc → cancel pinning or form.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT") return;
      if (e.key.toLowerCase() === shortcut.toLowerCase()) {
        e.preventDefault();
        setPinning(true);
      } else if (e.key === "Escape") {
        if (pinning) {
          setPinning(false);
        } else if (open) {
          setOpen(false);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [shortcut, pinning, open]);

  // Click in pinning mode → drop pin at (x%, y%, atSec) and open form
  const onCatcherClick = (e: React.MouseEvent) => {
    if (!pinning) return;
    const rect = catcherRef.current?.getBoundingClientRect();
    if (!rect) return;
    const posX = ((e.clientX - rect.left) / rect.width) * 100;
    const posY = ((e.clientY - rect.top) / rect.height) * 100;
    setFormAt({ atSec, posX, posY });
    setPinning(false);
    setOpen(true);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const submit = async () => {
    const text = formText.trim();
    if (!text) return;
    // Cerrar el form ANTES del await — así si writeStaticFile lanza,
    // la ventana ya está cerrada. Antes (v0.1.0) un fallo del write
    // dejaba el form abierto sin feedback al usuario.
    setFormText("");
    setOpen(false);
    try {
      await add({ compositionId, ...formAt, text, fps });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[remotion-comments] could not persist comment", e);
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  };

  const myComments = comments.filter((c) => c.compositionId === compositionId);
  const isActive = (c: Comment) =>
    atSec >= c.atSec && atSec - c.atSec < lifetimeSec;

  const showIndicator = visible || open || pinning;

  // Hide all UI during render — but AFTER all hooks have run (rules-of-hooks).
  if (isRendering) return null;

  return (
    <AbsoluteFill style={{ pointerEvents: "none", zIndex: 9999 }}>
      {/* Click-catcher: SOLO interactivo en modo pinning (no rompe nada en reposo) */}
      <div
        ref={catcherRef}
        onClick={onCatcherClick}
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: pinning ? "auto" : "none",
          cursor: pinning ? "crosshair" : "default",
          background: pinning ? "rgba(165, 180, 252, 0.05)" : "transparent",
          transition: "background 200ms",
        }}
      />

      {/* Pines visibles cuando playhead está cerca de su atSec
          (los resueltos no se muestran sobre el preview) */}
      {myComments
        .filter(
          (c) =>
            c.posX !== undefined &&
            c.posY !== undefined &&
            isActive(c) &&
            !c.resolvedAt,
        )
        .map((c) => (
          <div
            key={c.id}
            style={{
              position: "absolute",
              left: `${c.posX}%`,
              top: `${c.posY}%`,
              transform: "translate(-50%, -100%)",
              pointerEvents: "auto",
              zIndex: 10000,
            }}
          >
            <div
              style={{
                background: "rgba(165, 180, 252, 0.95)",
                color: "#0F1114",
                padding: `${px(8)}px ${px(12)}px`,
                borderRadius: px(10),
                fontSize: px(13),
                fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
                fontWeight: 500,
                maxWidth: px(360),
                boxShadow: `0 ${px(6)}px ${px(20)}px rgba(0,0,0,0.5)`,
                border: `${px(1)}px solid rgba(255,255,255,0.5)`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: px(8),
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    fontSize: px(10),
                    opacity: 0.7,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  ⏺ {formatTime(c.atSec)}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(c.id);
                  }}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "rgba(15,17,20,0.5)",
                    cursor: "pointer",
                    fontSize: px(11),
                    padding: 0,
                    fontFamily: "inherit",
                  }}
                >
                  ✕
                </button>
              </div>
              <div style={{ marginTop: px(2), lineHeight: 1.35 }}>{c.text}</div>
            </div>
            <div
              style={{
                width: px(14),
                height: px(14),
                margin: `0 auto -${px(7)}px auto`,
                background: "rgba(165, 180, 252, 0.95)",
                transform: "rotate(45deg) translateY(-50%)",
                border: `${px(1)}px solid rgba(255,255,255,0.5)`,
                borderTop: "none",
                borderLeft: "none",
              }}
            />
            <div
              style={{
                width: px(10),
                height: px(10),
                background: "#A5B4FC",
                borderRadius: "50%",
                margin: "0 auto",
                boxShadow: `0 0 ${px(8)}px rgba(165, 180, 252, 0.8)`,
                border: `${px(2)}px solid #FAFAFA`,
              }}
            />
          </div>
        ))}

      {/* Indicator: cambia de "📍 add comment" a "click anywhere" en modo pinning */}
      <div
        onClick={() => {
          if (pinning) {
            setPinning(false);
          } else {
            setPinning(true);
          }
        }}
        style={{
          position: "absolute",
          top: px(32),
          right: px(32),
          background: pinning
            ? "rgba(165, 180, 252, 0.95)"
            : "rgba(15, 17, 20, 0.85)",
          backdropFilter: "blur(40px)",
          border: `${px(1)}px solid ${
            pinning ? "rgba(165, 180, 252, 1)" : "rgba(232, 199, 108, 0.4)"
          }`,
          borderRadius: px(14),
          padding: `${px(14)}px ${px(20)}px`,
          color: pinning ? "#0F1114" : "#E8C76C",
          fontSize: px(15),
          fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
          fontWeight: 600,
          pointerEvents: "auto",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: px(12),
          boxShadow: `0 ${px(8)}px ${px(24)}px rgba(0,0,0,0.5)`,
          opacity: showIndicator ? 1 : 0,
          transition: "opacity 400ms ease, background 200ms, color 200ms",
        }}
      >
        <span style={{ fontSize: px(20) }}>📍</span>
        {pinning ? (
          <span>
            Click on the preview · {formatTime(atSec)}{" "}
            <span style={{ fontSize: px(11), opacity: 0.6, marginLeft: px(6) }}>
              Esc to cancel
            </span>
          </span>
        ) : (
          <span>
            <kbd
              style={{
                background: "rgba(0,0,0,0.4)",
                padding: `${px(2)}px ${px(10)}px`,
                borderRadius: px(5),
                fontFamily: "monospace",
                fontSize: px(13),
                border: `${px(1)}px solid rgba(232, 199, 108, 0.3)`,
                marginRight: px(6),
                textTransform: "uppercase",
              }}
            >
              {shortcut}
            </kbd>
            comment @ {formatTime(atSec)}
          </span>
        )}
        {myComments.length > 0 && !pinning && (
          <span
            style={{
              background: "rgba(165, 180, 252, 0.2)",
              color: "#A5B4FC",
              padding: `${px(3)}px ${px(10)}px`,
              borderRadius: 999,
              fontSize: px(12),
              fontWeight: 700,
            }}
          >
            {myComments.length}
          </span>
        )}
      </div>

      {/* Form */}
      {open && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: px(560),
            background: "rgba(15, 17, 20, 0.96)",
            backdropFilter: "blur(40px)",
            border: `${px(2)}px solid rgba(165, 180, 252, 0.5)`,
            borderRadius: px(16),
            padding: px(28),
            color: "#FAFAFA",
            fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
            pointerEvents: "auto",
            boxShadow: `0 ${px(20)}px ${px(60)}px rgba(0,0,0,0.7)`,
          }}
        >
          <div
            style={{
              fontSize: px(15),
              color: "#A5B4FC",
              marginBottom: px(14),
              fontWeight: 600,
            }}
          >
            ⏺ {formatTime(formAt.atSec)} · {compositionId}
            {formAt.posX !== undefined && formAt.posY !== undefined && (
              <span style={{ fontSize: px(12), opacity: 0.7, marginLeft: px(8) }}>
                @ {formAt.posX.toFixed(1)}%, {formAt.posY.toFixed(1)}%
              </span>
            )}
          </div>
          <textarea
            ref={textareaRef}
            value={formText}
            onChange={(e) => setFormText(e.target.value)}
            onKeyDown={onKey}
            placeholder="What would you change here? (Enter saves, Shift+Enter newline, Esc cancels)"
            style={{
              width: "100%",
              background: "rgba(255,255,255,0.04)",
              border: `${px(1)}px solid rgba(255,255,255,0.1)`,
              borderRadius: px(8),
              padding: px(14),
              color: "#FAFAFA",
              fontFamily: "inherit",
              fontSize: px(14),
              minHeight: px(120),
              resize: "vertical",
              outline: "none",
            }}
          />
          <div
            style={{
              display: "flex",
              gap: px(10),
              marginTop: px(14),
              justifyContent: "flex-end",
            }}
          >
            <button
              onClick={() => setOpen(false)}
              style={{
                background: "rgba(255,255,255,0.06)",
                border: `${px(1)}px solid rgba(255,255,255,0.1)`,
                color: "#FAFAFA",
                padding: `${px(10)}px ${px(20)}px`,
                borderRadius: px(8),
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: px(13),
              }}
            >
              Cancel
            </button>
            <button
              onClick={submit}
              style={{
                background: "#A5B4FC",
                color: "#0F1114",
                border: "none",
                padding: `${px(10)}px ${px(24)}px`,
                borderRadius: px(8),
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: px(13),
                fontWeight: 700,
              }}
            >
              Save (Enter)
            </button>
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
