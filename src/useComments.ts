import { useCallback, useEffect, useState } from "react";
import { staticFile, getRemotionEnvironment } from "remotion";
import { writeStaticFile, watchStaticFile } from "@remotion/studio";
import {
  Comment,
  CommentsConfig,
  DEFAULT_FILE_PATH,
} from "./types.js";

const newId = () => Math.random().toString(36).slice(2, 10);

export interface UseCommentsResult {
  /** All comments, across all compositions, sorted by `atSec` then `createdAt` */
  comments: Comment[];
  /** Add a new comment. Resolves once persisted to disk. */
  add: (params: {
    compositionId: string;
    atSec: number;
    text: string;
    /** Optional spatial anchor (% of composition width). */
    posX?: number;
    /** Optional spatial anchor (% of composition height). */
    posY?: number;
    /** FPS of the composition. Persisted so the sidebar can compute the
     * correct `seek(frame)` even if compositions in the same project have
     * different fps. */
    fps?: number;
  }) => Promise<Comment>;
  /** Update text (and other mutable fields) of an existing comment. */
  update: (
    id: string,
    patch: {
      text?: string;
      resolvedAt?: number;
      resolvedNote?: string;
    },
  ) => Promise<void>;
  /** Mark a comment as resolved with an optional note explaining what was
   * fixed. Idempotent: re-resolving updates the timestamp & note. */
  resolve: (id: string, note?: string) => Promise<void>;
  /** Re-open a previously resolved comment. */
  unresolve: (id: string) => Promise<void>;
  /** Remove a single comment by id. */
  remove: (id: string) => Promise<void>;
  /** Force a re-read from disk. Usually not needed — `watchStaticFile` keeps
   * us in sync automatically. */
  refresh: () => Promise<void>;
  /** Comments filtered to a specific composition, sorted by `atSec`. */
  byComposition: (compositionId: string) => Comment[];
}

/**
 * React hook that loads, watches and mutates a `comments.json` file in
 * Remotion's `public/` folder.
 *
 * Internally uses `staticFile()` for reads and `@remotion/studio`'s
 * `writeStaticFile()` / `watchStaticFile()` for writes / live updates. That
 * means the hook only works inside the Studio (it returns an empty list
 * during render).
 *
 * @example
 * ```tsx
 * const { comments, add } = useComments();
 * await add({ compositionId: "MyVideo", atSec: 12.3, text: "..." });
 * ```
 */
export const useComments = (config: CommentsConfig = {}): UseCommentsResult => {
  const filePath = config.filePath ?? DEFAULT_FILE_PATH;
  const [comments, setComments] = useState<Comment[]>([]);

  const refresh = useCallback(async () => {
    if (getRemotionEnvironment().isRendering) return;
    try {
      const r = await fetch(`${staticFile(filePath)}?t=${Date.now()}`);
      if (!r.ok) {
        // file may not exist yet
        setComments([]);
        return;
      }
      const text = await r.text();
      if (!text.trim()) {
        setComments([]);
        return;
      }
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) setComments(parsed);
    } catch (err) {
      // log but don't crash
      // eslint-disable-next-line no-console
      console.warn("[remotion-comments] could not load", filePath, err);
    }
  }, [filePath]);

  useEffect(() => {
    if (getRemotionEnvironment().isRendering) return;
    refresh();
    const w = watchStaticFile(filePath, () => refresh());
    return () => w.cancel();
  }, [filePath, refresh]);

  const persist = useCallback(
    async (next: Comment[]) => {
      setComments(next);
      await writeStaticFile({
        filePath,
        contents: JSON.stringify(next, null, 2),
      });
    },
    [filePath]
  );

  const add = useCallback<UseCommentsResult["add"]>(
    async ({ compositionId, atSec, text, posX, posY, fps }) => {
      const c: Comment = {
        id: newId(),
        compositionId,
        atSec,
        text,
        createdAt: Math.floor(Date.now() / 1000),
        ...(posX !== undefined ? { posX } : {}),
        ...(posY !== undefined ? { posY } : {}),
        ...(fps !== undefined ? { fps } : {}),
      };
      await persist([...comments, c]);
      return c;
    },
    [comments, persist]
  );

  const update = useCallback<UseCommentsResult["update"]>(
    async (id, patch) => {
      const next = comments.map((c) =>
        c.id === id
          ? { ...c, ...patch, updatedAt: Math.floor(Date.now() / 1000) }
          : c,
      );
      await persist(next);
    },
    [comments, persist]
  );

  const resolve = useCallback<UseCommentsResult["resolve"]>(
    async (id: string, note?: string) => {
      const next = comments.map((c) =>
        c.id === id
          ? {
              ...c,
              resolvedAt: Math.floor(Date.now() / 1000),
              ...(note !== undefined ? { resolvedNote: note } : {}),
              updatedAt: Math.floor(Date.now() / 1000),
            }
          : c,
      );
      await persist(next);
    },
    [comments, persist]
  );

  const unresolve = useCallback<UseCommentsResult["unresolve"]>(
    async (id: string) => {
      const next = comments.map((c) => {
        if (c.id !== id) return c;
        const { resolvedAt: _r, resolvedNote: _n, ...rest } = c;
        return { ...rest, updatedAt: Math.floor(Date.now() / 1000) };
      });
      await persist(next);
    },
    [comments, persist]
  );

  const remove = useCallback<UseCommentsResult["remove"]>(
    async (id: string) => {
      await persist(comments.filter((c) => c.id !== id));
    },
    [comments, persist]
  );

  const byComposition = useCallback(
    (compositionId: string) =>
      comments
        .filter((c) => c.compositionId === compositionId)
        .sort((a, b) => a.atSec - b.atSec || a.createdAt - b.createdAt),
    [comments]
  );

  return { comments, add, update, resolve, unresolve, remove, refresh, byComposition };
};
