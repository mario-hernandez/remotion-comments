/**
 * remotion-comments
 * =================
 *
 * Timed comments for Remotion compositions. The reviewer presses a key during
 * preview, leaves a note anchored to the exact frame, and the comment becomes
 * a real `<Sequence>` clip on the official Studio timeline. Every comment is
 * persisted to `public/comments.json` — readable by humans, LLMs, or CI.
 *
 * Acts as a **bridge between video reviewers and AI**: a designer/director
 * leaves natural-language feedback while watching, and an LLM reads the JSON
 * to apply changes (move element, adjust timing, replace text...).
 *
 * @example
 * ```tsx
 * import { CommentsPanel, CommentSequences } from "remotion-comments";
 *
 * export const MyComposition = () => (
 *   <AbsoluteFill>
 *     {/* ...your content... *\/}
 *     <CommentsPanel compositionId="MyVideo" />
 *     <CommentSequences compositionId="MyVideo" fps={30} />
 *   </AbsoluteFill>
 * );
 * ```
 */

export { CommentsPanel } from "./CommentsPanel";
export { CommentSequences } from "./CommentSequences";
export { useComments } from "./useComments";
export type { UseCommentsResult } from "./useComments";
export type { Comment, CommentsConfig } from "./types";
export { DEFAULT_FILE_PATH, DEFAULT_LIFETIME_SEC } from "./types";
