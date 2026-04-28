import React from "react";
import { Sequence, getRemotionEnvironment } from "remotion";
import { useComments } from "./useComments";
import { CommentsConfig, DEFAULT_LIFETIME_SEC } from "./types";

interface Props extends CommentsConfig {
  /** Composition id this track belongs to */
  compositionId: string;
  /** Composition fps. Used to convert seconds → frames */
  fps: number;
  /** Optional emoji prefix for clip names. Default: "💬 " */
  emoji?: string;
  /** Maximum length of comment text shown in the clip name. Default: 40 */
  truncateAt?: number;
}

const Empty: React.FC = () => null;

/**
 * Renders each comment as a real Remotion `<Sequence>` with the comment text
 * as `name`. The sequences contain a no-op component, so they don't render
 * anything visible; they just *exist* — and that makes them appear as named
 * clips in the official Studio timeline. Click a clip → seek to its start.
 *
 * Returns `null` during render (so comments don't pollute the final output).
 *
 * @example
 * ```tsx
 * <Composition id="MyVideo" component={...}>
 *   <CommentSequences compositionId="MyVideo" fps={30} />
 * </Composition>
 * ```
 */
export const CommentSequences: React.FC<Props> = ({
  compositionId,
  fps,
  emoji = "💬 ",
  truncateAt = 40,
  filePath,
  lifetimeSec = DEFAULT_LIFETIME_SEC,
}) => {
  const { byComposition } = useComments({ filePath, lifetimeSec });

  if (getRemotionEnvironment().isRendering) return null;

  const myComments = byComposition(compositionId);

  return (
    <>
      {myComments.map((c) => {
        const truncated =
          c.text.length > truncateAt
            ? c.text.slice(0, truncateAt - 1) + "…"
            : c.text;
        return (
          <Sequence
            key={c.id}
            from={Math.round(c.atSec * fps)}
            durationInFrames={Math.round(lifetimeSec * fps)}
            name={`${emoji}${truncated}`}
            layout="absolute-fill"
          >
            <Empty />
          </Sequence>
        );
      })}
    </>
  );
};
