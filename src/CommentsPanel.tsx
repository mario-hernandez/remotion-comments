import React, { useEffect, useRef, useState } from "react";
import {
  AbsoluteFill,
  getRemotionEnvironment,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { useComments } from "./useComments";
import { Comment, CommentsConfig, DEFAULT_LIFETIME_SEC } from "./types";

interface Props extends CommentsConfig {
  compositionId: string;
  /** SCALE multiplier so the panel renders well at typical 25% Studio zoom on
   * 4K compositions. Default: 4. Use 1 for 1080p compositions, 2 for 2K. */
  scale?: number;
  /** Hide the floating "click to comment" indicator after this many ms of
   * inactivity. Default: 2000. Set to 0 to keep visible always. */
  autoHideMs?: number;
  /** Keyboard shortcut to open the form at the playhead (no spatial anchor).
   * Default: "c" */
  shortcut?: string;
  /** i18n */
  hintText?: string;
  /** When the playhead passes within this many seconds of a pin's anchor, the
   * pin is highlighted. Default: 2 (also doubles as Sequence clip duration in
   * `<CommentSequences/>`). */
  lifetimeSec?: number;
}

const formatTime = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = (s - m * 60).toFixed(1);
  return `${m}:${sec.padStart(4, "0")}`;
};

/**
 * Floating UI rendered inside a Remotion composition that lets the reviewer:
 *
 * 1. **Click anywhere on the preview** → drops a pin at exact `(posX%, posY%)`
 *    of the frame, anchored to the current frame in time.
 * 2. **Press `C`** → drops a pin without spatial anchor (just the timestamp).
 *
 * Pins are visible on top of the preview when the playhead is within
 * `lifetimeSec` of their anchor, so you see at a glance what feedback was
 * left on the part of the video you're watching.
 *
 * The panel is hidden during render. Pair with `<CommentSequences/>` to also
 * see the comments as named clips on the official Studio timeline.
 */
export const CommentsPanel: React.FC<Props> = ({
  compositionId,
  scale = 4,
  autoHideMs = 2000,
  shortcut = "c",
  hintText = "Click on the preview or press",
  filePath,
  lifetimeSec = DEFAULT_LIFETIME_SEC,
}) => {
  if (getRemotionEnvironment().isRendering) return null;

  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const atSec = frame / fps;

  const px = (n: number) => n * scale;

  const { comments, add, remove } = useComments({ filePath });

  const [open, setOpen] = useState(false);
  const [formText, setFormText] = useState("");
  const [formAt, setFormAt] = useState<{
    atSec: number;
    posX?: number;
    posY?: number;
  }>({ atSec: 0 });
  const [visible, setVisible] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
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
        if (!open) setVisible(false);
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
  }, [open, autoHideMs]);

  // Keyboard shortcut: open form at playhead, NO spatial anchor
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT") return;
      if (e.key.toLowerCase() === shortcut.toLowerCase()) {
        e.preventDefault();
        setFormAt({ atSec });
        setOpen(true);
        setTimeout(() => textareaRef.current?.focus(), 50);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [atSec, shortcut]);

  // Click on the preview → drop pin at (x%, y%, atSec)
  const onPreviewClick = (e: React.MouseEvent) => {
    if (open) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const posX = ((e.clientX - rect.left) / rect.width) * 100;
    const posY = ((e.clientY - rect.top) / rect.height) * 100;
    setFormAt({ atSec, posX, posY });
    setOpen(true);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const submit = async () => {
    const text = formText.trim();
    if (!text) return;
    await add({ compositionId, ...formAt, text });
    setFormText("");
    setOpen(false);
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

  // A pin is "active" when the playhead is within lifetimeSec of its atSec.
  const isActive = (c: Comment) =>
    atSec >= c.atSec && atSec - c.atSec < lifetimeSec;

  const showIndicator = visible || open;

  return (
    <AbsoluteFill style={{ pointerEvents: "none", zIndex: 9999 }}>
      {/* Click-catcher layer. Only enabled when form is closed. */}
      <div
        ref={containerRef}
        onClick={onPreviewClick}
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: open ? "none" : "auto",
          cursor: open ? "default" : "crosshair",
        }}
      />

      {/* Render existing pins (only the active ones, by lifetimeSec window) */}
      {myComments
        .filter((c) => c.posX !== undefined && c.posY !== undefined && isActive(c))
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
              <div style={{ display: "flex", justifyContent: "space-between", gap: px(8), alignItems: "center" }}>
                <span style={{ fontSize: px(10), opacity: 0.7, fontVariantNumeric: "tabular-nums" }}>
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
            {/* Pin tip pointer */}
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
            {/* Anchor dot */}
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

      {/* Floating "click or press C" indicator */}
      <div
        style={{
          position: "absolute",
          top: px(32),
          right: px(32),
          background: "rgba(15, 17, 20, 0.85)",
          backdropFilter: "blur(40px)",
          border: `${px(1)}px solid rgba(232, 199, 108, 0.4)`,
          borderRadius: px(14),
          padding: `${px(14)}px ${px(20)}px`,
          color: "#E8C76C",
          fontSize: px(15),
          fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
          fontWeight: 500,
          pointerEvents: "none",
          display: "flex",
          alignItems: "center",
          gap: px(12),
          boxShadow: `0 ${px(8)}px ${px(24)}px rgba(0,0,0,0.5)`,
          opacity: showIndicator ? 1 : 0,
          transition: "opacity 400ms ease",
        }}
      >
        <span style={{ fontSize: px(20) }}>📍</span>
        <span>
          {hintText}{" "}
          <kbd
            style={{
              background: "rgba(0,0,0,0.4)",
              padding: `${px(2)}px ${px(10)}px`,
              borderRadius: px(5),
              fontFamily: "monospace",
              fontSize: px(13),
              border: `${px(1)}px solid rgba(232, 199, 108, 0.3)`,
              marginLeft: px(4),
              textTransform: "uppercase",
            }}
          >
            {shortcut}
          </kbd>
          {" "}@ {formatTime(atSec)}
        </span>
        {myComments.length > 0 && (
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
          <div style={{ display: "flex", gap: px(10), marginTop: px(14), justifyContent: "flex-end" }}>
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
