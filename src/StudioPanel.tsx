/**
 * StudioPanel — UI for the "Comments" tab in Remotion Studio's right sidebar.
 *
 * Rendered INSIDE the Studio chrome (not the composition preview), in the
 * same panel that hosts Props/Renders/Controls. Activated by patching
 * `@remotion/studio`'s `OptionsPanel.js` to render
 * `window.__remotionStudioPanels__.comments` when the new tab is selected.
 */

import React, { useEffect, useState, useCallback, useRef } from "react";
import { Comment, DEFAULT_FILE_PATH } from "./types.js";

const COMMENTS_FILE = DEFAULT_FILE_PATH;

const formatTime = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = (s - m * 60).toFixed(1);
  return `${m}:${sec.padStart(4, "0")}`;
};

type Filter = "pending" | "resolved" | "all";

const StudioPanel: React.FC = () => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [filter, setFilter] = useState<Filter>("pending");
  const editRef = useRef<HTMLTextAreaElement | null>(null);

  const refresh = useCallback(async () => {
    try {
      const remotion = await import(/* @vite-ignore */ "remotion");
      const url = remotion.staticFile(COMMENTS_FILE) + "?t=" + Date.now();
      const r = await fetch(url);
      if (!r.ok) {
        setComments([]);
        return;
      }
      const t = await r.text();
      if (!t.trim()) {
        setComments([]);
        return;
      }
      const parsed = JSON.parse(t);
      if (Array.isArray(parsed)) setComments(parsed);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[remotion-comments] StudioPanel could not load", err);
    }
  }, []);

  useEffect(() => {
    refresh();
    const i = setInterval(refresh, 1500);
    return () => clearInterval(i);
  }, [refresh]);

  const persist = useCallback(async (next: Comment[]) => {
    try {
      const studio = await import(/* @vite-ignore */ "@remotion/studio");
      await studio.writeStaticFile({
        filePath: COMMENTS_FILE,
        contents: JSON.stringify(next, null, 2),
      });
      setComments(next);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[remotion-comments] persist failed", err);
    }
  }, []);

  const remove = useCallback(
    (id: string) => persist(comments.filter((c) => c.id !== id)),
    [comments, persist]
  );

  const toggleResolved = useCallback(
    async (c: Comment) => {
      const now = Math.floor(Date.now() / 1000);
      const next = comments.map((x) => {
        if (x.id !== c.id) return x;
        if (c.resolvedAt) {
          // unresolve: strip resolvedAt + resolvedNote
          const { resolvedAt: _r, resolvedNote: _n, ...rest } = x;
          return { ...rest, updatedAt: now };
        }
        return { ...x, resolvedAt: now, updatedAt: now };
      });
      await persist(next);
    },
    [comments, persist]
  );

  const startEdit = (c: Comment) => {
    setEditingId(c.id);
    setEditText(c.text);
    setTimeout(() => editRef.current?.focus(), 50);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText("");
  };

  const saveEdit = useCallback(async () => {
    if (!editingId) return;
    const text = editText.trim();
    if (!text) {
      cancelEdit();
      return;
    }
    const now = Math.floor(Date.now() / 1000);
    const next = comments.map((c) =>
      c.id === editingId ? { ...c, text, updatedAt: now } : c
    );
    await persist(next);
    setEditingId(null);
    setEditText("");
  }, [editingId, editText, comments, persist]);

  const onEditKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      saveEdit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelEdit();
    }
  };

  const seekTo = useCallback(async (c: Comment) => {
    try {
      const studio = await import(/* @vite-ignore */ "@remotion/studio");
      const fps = c.fps ?? 25;
      try {
        studio.goToComposition(c.compositionId);
      } catch {
        /* noop if already in that composition */
      }
      // Wait briefly for composition switch before seek.
      setTimeout(() => studio.seek(Math.round(c.atSec * fps)), 200);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[remotion-comments] seek failed", err);
    }
  }, []);

  const matchesFilter = (c: Comment) => {
    if (filter === "all") return true;
    if (filter === "pending") return !c.resolvedAt;
    return Boolean(c.resolvedAt);
  };

  // Group by composition (after filter)
  const byComp: Record<string, Comment[]> = {};
  for (const c of comments) {
    if (!matchesFilter(c)) continue;
    if (!byComp[c.compositionId]) byComp[c.compositionId] = [];
    byComp[c.compositionId].push(c);
  }
  for (const k of Object.keys(byComp)) {
    byComp[k].sort((a, b) => a.atSec - b.atSec);
  }

  const totalCount = comments.length;
  const pendingCount = comments.filter((c) => !c.resolvedAt).length;
  const resolvedCount = totalCount - pendingCount;
  const filteredCount = Object.values(byComp).reduce((a, b) => a + b.length, 0);

  return (
    <div
      style={{
        height: "100%",
        overflowY: "auto",
        padding: 12,
        fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
        color: "#fafafa",
        fontSize: 13,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <div
          style={{
            color: "rgba(255,255,255,0.55)",
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.18em",
          }}
        >
          {totalCount} comment{totalCount === 1 ? "" : "s"}
        </div>
        <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10 }}>
          public/{COMMENTS_FILE}
        </div>
      </div>

      {/* Filter pills */}
      <div
        style={{
          display: "flex",
          gap: 6,
          marginBottom: 12,
          paddingBottom: 10,
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {(
          [
            ["pending", "Pending", pendingCount],
            ["resolved", "Resolved", resolvedCount],
            ["all", "All", totalCount],
          ] as const
        ).map(([key, label, count]) => {
          const isActive = filter === key;
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              style={{
                background: isActive
                  ? "rgba(165, 180, 252, 0.18)"
                  : "rgba(255,255,255,0.04)",
                border: `1px solid ${isActive ? "rgba(165, 180, 252, 0.5)" : "rgba(255,255,255,0.08)"}`,
                color: isActive ? "#A5B4FC" : "rgba(255,255,255,0.55)",
                padding: "3px 10px",
                borderRadius: 999,
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.05em",
              }}
            >
              {label} <span style={{ opacity: 0.6, marginLeft: 2 }}>{count}</span>
            </button>
          );
        })}
      </div>

      {totalCount === 0 ? (
        <div
          style={{
            color: "rgba(255,255,255,0.4)",
            fontStyle: "italic",
            padding: "24px 12px",
            textAlign: "center",
          }}
        >
          Press{" "}
          <kbd
            style={{
              background: "rgba(0,0,0,0.4)",
              padding: "1px 6px",
              borderRadius: 3,
              fontSize: 11,
              fontFamily: "monospace",
            }}
          >
            C
          </kbd>{" "}
          on the preview to drop a pin.
        </div>
      ) : filteredCount === 0 ? (
        <div
          style={{
            color: "rgba(255,255,255,0.4)",
            fontStyle: "italic",
            padding: "24px 12px",
            textAlign: "center",
          }}
        >
          No {filter} comments.
        </div>
      ) : (
        Object.entries(byComp).map(([compId, list]) => (
          <div key={compId} style={{ marginBottom: 16 }}>
            <div
              onClick={async () => {
                try {
                  const studio = await import(/* @vite-ignore */ "@remotion/studio");
                  studio.goToComposition(compId);
                } catch (err) {
                  // eslint-disable-next-line no-console
                  console.error(err);
                }
              }}
              style={{
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                color: "#A5B4FC",
                marginBottom: 6,
                cursor: "pointer",
                padding: "4px 0",
              }}
            >
              {compId}{" "}
              <span style={{ color: "rgba(255,255,255,0.3)" }}>
                · {list.length}
              </span>
            </div>
            {list.map((c) => {
              const isEditing = editingId === c.id;
              const isResolved = Boolean(c.resolvedAt);
              return (
                <div
                  key={c.id}
                  style={{
                    background: isEditing
                      ? "rgba(165, 180, 252, 0.08)"
                      : isResolved
                        ? "rgba(110, 207, 156, 0.04)"
                        : "rgba(255,255,255,0.03)",
                    border: `1px solid ${
                      isEditing
                        ? "rgba(165, 180, 252, 0.5)"
                        : isResolved
                          ? "rgba(110, 207, 156, 0.25)"
                          : "rgba(165, 180, 252, 0.18)"
                    }`,
                    borderRadius: 8,
                    padding: 10,
                    marginBottom: 6,
                    cursor: isEditing ? "default" : "pointer",
                    opacity: isResolved ? 0.7 : 1,
                  }}
                  onClick={() => {
                    if (!isEditing) seekTo(c);
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 4,
                    }}
                  >
                    <span
                      style={{
                        color: "#A5B4FC",
                        fontSize: 11,
                        fontWeight: 600,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      ⏺ {formatTime(c.atSec)}
                      {c.posX !== undefined && (
                        <span
                          style={{
                            color: "rgba(255,255,255,0.4)",
                            fontWeight: 400,
                            marginLeft: 6,
                          }}
                        >
                          @{(c.posX as number).toFixed(0)}%,{" "}
                          {(c.posY as number).toFixed(0)}%
                        </span>
                      )}
                      {c.updatedAt && (
                        <span
                          style={{
                            color: "rgba(255,255,255,0.3)",
                            fontWeight: 400,
                            marginLeft: 6,
                            fontSize: 10,
                          }}
                          title="edited"
                        >
                          edited
                        </span>
                      )}
                    </span>
                    <div style={{ display: "flex", gap: 6 }}>
                      {!isEditing && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleResolved(c);
                          }}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: isResolved ? "#6ECF9C" : "rgba(255,255,255,0.45)",
                            cursor: "pointer",
                            fontSize: 13,
                            padding: 0,
                            lineHeight: 1,
                          }}
                          title={isResolved ? "Reopen" : "Mark resolved"}
                        >
                          {isResolved ? "✓" : "○"}
                        </button>
                      )}
                      {!isEditing && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            startEdit(c);
                          }}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "rgba(255,255,255,0.45)",
                            cursor: "pointer",
                            fontSize: 11,
                            padding: 0,
                          }}
                          title="Edit"
                        >
                          ✎
                        </button>
                      )}
                      {!isEditing && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            remove(c.id);
                          }}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "rgba(255,255,255,0.35)",
                            cursor: "pointer",
                            fontSize: 11,
                            padding: 0,
                          }}
                          title="Delete"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>

                  {isEditing ? (
                    <div onClick={(e) => e.stopPropagation()}>
                      <textarea
                        ref={editRef}
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={onEditKey}
                        style={{
                          width: "100%",
                          background: "rgba(0,0,0,0.3)",
                          border: "1px solid rgba(165, 180, 252, 0.3)",
                          borderRadius: 4,
                          padding: 8,
                          color: "#fafafa",
                          fontFamily: "inherit",
                          fontSize: 12,
                          minHeight: 60,
                          resize: "vertical",
                          outline: "none",
                          boxSizing: "border-box",
                        }}
                      />
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginTop: 6,
                          fontSize: 10,
                          color: "rgba(255,255,255,0.4)",
                        }}
                      >
                        <span>⌘+Enter saves · Esc cancels</span>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            onClick={cancelEdit}
                            style={{
                              background: "rgba(255,255,255,0.06)",
                              border: "1px solid rgba(255,255,255,0.1)",
                              color: "#fafafa",
                              padding: "3px 10px",
                              borderRadius: 4,
                              cursor: "pointer",
                              fontFamily: "inherit",
                              fontSize: 11,
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            onClick={saveEdit}
                            style={{
                              background: "#A5B4FC",
                              color: "#0F1114",
                              border: "none",
                              padding: "3px 12px",
                              borderRadius: 4,
                              cursor: "pointer",
                              fontFamily: "inherit",
                              fontSize: 11,
                              fontWeight: 600,
                            }}
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div
                        style={{
                          fontSize: 12,
                          lineHeight: 1.4,
                          color: "rgba(255,255,255,0.85)",
                          textDecoration: isResolved ? "line-through" : "none",
                          textDecorationColor: "rgba(110, 207, 156, 0.5)",
                        }}
                      >
                        {c.text}
                      </div>
                      {isResolved && c.resolvedNote && (
                        <div
                          style={{
                            marginTop: 6,
                            paddingTop: 6,
                            borderTop: "1px dashed rgba(110, 207, 156, 0.18)",
                            fontSize: 11,
                            lineHeight: 1.4,
                            color: "#6ECF9C",
                            fontStyle: "italic",
                          }}
                        >
                          ✓ {c.resolvedNote}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ))
      )}
    </div>
  );
};

// Auto-register on import. The patched OptionsPanel reads from this global.
if (typeof window !== "undefined") {
  const w = window as unknown as {
    __remotionStudioPanels__?: { comments?: React.FC };
  };
  if (!w.__remotionStudioPanels__) w.__remotionStudioPanels__ = {};
  w.__remotionStudioPanels__.comments = StudioPanel;
}

export { StudioPanel };
