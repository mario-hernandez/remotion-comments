# remotion-comments

> **The missing review loop for AI-generated video.**
> Click anywhere on the Remotion preview, drop a pin, write what you want changed. Each pin is anchored to `(compositionId, atSec, posX%, posY%)` and persisted as JSON. The same LLM that generated your composition reads the file and applies the fix.

[![npm](https://img.shields.io/npm/v/remotion-comments.svg)](https://www.npmjs.com/package/remotion-comments)
[![MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

```tsx
import { CommentsPanel, CommentSequences } from "remotion-comments";

export const MyComposition = () => (
  <AbsoluteFill>
    {/* ...your content... */}
    <CommentsPanel compositionId="MyVideo" />
    <CommentSequences compositionId="MyVideo" fps={30} />
  </AbsoluteFill>
);
```

That's it. **Click anywhere on the preview** → a pin drops at exact `(x%, y%)` of the frame, anchored to the playhead time → write feedback → Enter saves. The comment also appears as a named clip on the Studio timeline.

---

## The problem this solves

Programmatic video has a great forward path: an LLM (via [`@remotion/mcp`](https://www.remotion.dev/docs/mcp), Claude Code, Cursor…) generates compositions, animations, captions. **The review path is broken.**

When the reviewer wants to iterate, they have to:

1. Pause at the right moment.
2. Memorize the timestamp.
3. Switch to chat / Slack / a doc.
4. Type *"at minute 2:13, the title in the upper-right is too big — shrink it"*.
5. Wait. The LLM has to **guess** which composition, which frame, which element. Half the time it doesn't know what "upper-right" means in a 4K composition.

That's afunctional. With `remotion-comments` it becomes:

1. **Click on the title in the preview.**
2. *"shrink to 60%"*. Enter.

`public/comments.json` now contains:

```json
{ "compositionId": "S1Noche", "atSec": 23.4, "posX": 62.3, "posY": 31.0, "text": "shrink to 60%" }
```

The LLM reads the file. It knows: *which composition* (the Sequence/component to edit), *which frame*, *which element* (because it knows what's at `(62%, 31%)` at that frame from its own code). It applies a precise change.

This package closes the **bidirectional loop** between LLMs and Remotion:

```
LLM ──(generates code)──▶ Remotion
LLM ◀───(reads JSON)─── reviewer clicks pin
```

---

## What you get

- **Click on the preview** → pin at exact `(x%, y%, atSec)`. No estimation.
- **Press `C`** for a time-only pin (no spatial anchor).
- **Pins are visible on the frame** while the playhead is within their lifetime window.
- **Comments appear as named clips on the official Studio timeline** (each is a real `<Sequence>`). Click a clip → seek.
- **Persisted in the repo.** `public/comments.json` is plain JSON you can commit, diff, or PR.
- **Render-safe.** All UI is hidden during render via `getRemotionEnvironment().isRendering`. Comments do **not** end up in the final MP4.
- **No external server.** Uses `@remotion/studio` APIs (`writeStaticFile`, `watchStaticFile`).

---

## Install

```bash
npm install remotion-comments
# requires peer deps:
npm install remotion @remotion/studio react
```

Tested with Remotion `4.0.448+`.

---

## API

### `<CommentsPanel/>`

Floating modal UI rendered inside your composition. Press the keyboard shortcut to add a comment at the current frame.

```tsx
<CommentsPanel
  compositionId="MyVideo"  // required
  scale={4}                 // multiplier for 4K compositions (default 4)
  autoHideMs={2000}         // hide indicator after N ms inactivity (default 2000, 0 = always visible)
  shortcut="c"              // key to open the form (default "c")
  titlePrefix="Comment at"  // i18n
  filePath="comments.json"  // path inside public/ (default)
/>
```

### `<CommentSequences/>`

Renders each saved comment as a native `<Sequence>` with the comment text as `name`. Comments appear as named clips in the official Studio timeline.

```tsx
<CommentSequences
  compositionId="MyVideo"  // required
  fps={30}                  // required, your composition's fps
  emoji="💬 "               // prefix for clip names
  truncateAt={40}           // max chars in clip name
  lifetimeSec={2}           // clip duration in seconds (default 2)
/>
```

### `useComments(config?)`

Low-level hook. Use it to build your own UI.

```tsx
import { useComments } from "remotion-comments";

const Sidebar = () => {
  const { comments, add, remove, byComposition } = useComments();
  const mine = byComposition("MyVideo");
  return (
    <ul>
      {mine.map(c => (
        <li key={c.id}>
          {c.atSec.toFixed(1)}s — {c.text}
          <button onClick={() => remove(c.id)}>×</button>
        </li>
      ))}
    </ul>
  );
};
```

---

## Storage format

Comments live in `public/comments.json` (configurable). Format:

```json
[
  {
    "id": "a3b9c1d2",
    "compositionId": "MyVideo",
    "atSec": 23.4,
    "posX": 62.3,
    "posY": 31.0,
    "text": "shrink to 60%",
    "createdAt": 1730000000
  }
]
```

| Field | Type | Meaning |
|---|---|---|
| `id` | string | random 8-char id |
| `compositionId` | string | which `<Composition id="…">` |
| `atSec` | number | when on the timeline (seconds, float) |
| `posX`, `posY` | number? | where on the frame (% of width/height). Absent if added via `C` shortcut |
| `text` | string | free-form note |
| `createdAt` | number | unix timestamp in seconds |

You can edit the file by hand, commit it, sync it across teammates, or hand it to an AI:

```bash
cat public/comments.json | claude "apply each comment as a code change"
```

---

## How does it work under the hood?

- **Read:** [`staticFile()`](https://www.remotion.dev/docs/staticfile) loads the file via the dev server.
- **Watch:** [`watchStaticFile()`](https://www.remotion.dev/docs/studio/watch-static-file) keeps the panel in sync if multiple windows are open or if the file is edited externally.
- **Write:** [`writeStaticFile()`](https://www.remotion.dev/docs/studio/write-static-file) persists changes through the Studio backend (no separate server).
- **Hide on render:** [`getRemotionEnvironment().isRendering`](https://www.remotion.dev/docs/get-remotion-environment) early-returns `null` so the panel never appears in the final video.
- **Timeline clips:** standard `<Sequence name="…">` — the Studio renders them in the timeline track for free.

No external server. No extra dependencies. 100% Remotion APIs.

---

## Use case: AI-assisted video editing

The killer use case is treating `comments.json` as a **bridge between humans and an LLM**:

1. Designer watches the video, leaves comments at frames they want changed.
2. LLM reads `comments.json` and the timeline source files.
3. LLM proposes / applies code changes.
4. Designer reviews the next render.

This is what the package was built for.

---

## Contributing

Issues and PRs welcome at [github.com/mario-hernandez/remotion-comments](https://github.com/mario-hernandez/remotion-comments).

If you'd like to see this functionality merged upstream into `@remotion/comments`, +1 the issue at [remotion-dev/remotion#XXXX](https://github.com/remotion-dev/remotion/issues) (TBD).

---

## License

MIT © Mario Hernández
