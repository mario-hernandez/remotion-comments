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
  /** Free-form text. Can include @mentions, markdown, anything */
  text: string;
  /** Unix timestamp in seconds when the comment was created */
  createdAt: number;
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
