export interface Comment {
  id: string;
  compositionId: string;
  /** Anchor point in seconds (relative to the composition start) */
  atSec: number;
  /** Horizontal pin position as a percentage of the composition width
   * (0 = left edge, 100 = right edge). `undefined` if the comment was added
   * via keyboard shortcut without clicking on the preview. */
  posX?: number;
  /** Vertical pin position as a percentage of the composition height
   * (0 = top, 100 = bottom). `undefined` if the comment is not spatially
   * anchored. */
  posY?: number;
  /** FPS of the composition the comment was created in. Used by the sidebar
   * panel to compute the right `seek(frame)` for jumps. */
  fps?: number;
  /** Free-form text. Can include @mentions, markdown, anything */
  text: string;
  /** Unix timestamp in seconds when the comment was created */
  createdAt: number;
  /** Unix timestamp in seconds of the last edit. Absent if never edited. */
  updatedAt?: number;
  /** Unix timestamp in seconds when the comment was marked as resolved.
   * Resolved comments stay in the JSON for history but are visually muted
   * (struck-through, faded) and can be filtered out from the panel. */
  resolvedAt?: number;
  /** Free-form note explaining how/why the comment was resolved. Useful for
   * auditing what an AI agent or developer actually changed in response. */
  resolvedNote?: string;
}

export interface CommentsConfig {
  /** Path inside `public/` where comments are persisted. Default: `comments.json` */
  filePath?: string;
  /** Visibility window in seconds. Default: 2. After this many seconds the
   * comment fades from preview overlays (if using highlight features). It's
   * NOT deleted from storage. */
  lifetimeSec?: number;
}

export const DEFAULT_FILE_PATH = "comments.json";
export const DEFAULT_LIFETIME_SEC = 2;
