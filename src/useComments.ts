import { useCallback, useEffect, useState } from "react";
import { staticFile, getRemotionEnvironment } from "remotion";
import { writeStaticFile, watchStaticFile } from "@remotion/studio";
import {
  Comment,
  CommentsConfig,
  DEFAULT_FILE_PATH,
} from "./types";

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
  }) => Promise<Comment>;
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
      if (r.ok) {
        const text = await r.text();
        if (text.trim()) setComments(JSON.parse(text));
      }
    } catch {
      // file might not exist yet → empty list
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
    async ({ compositionId, atSec, text, posX, posY }) => {
      const c: Comment = {
        id: newId(),
        compositionId,
        atSec,
        text,
        createdAt: Math.floor(Date.now() / 1000),
        ...(posX !== undefined ? { posX } : {}),
        ...(posY !== undefined ? { posY } : {}),
      };
      await persist([...comments, c]);
      return c;
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

  return { comments, add, remove, refresh, byComposition };
};
