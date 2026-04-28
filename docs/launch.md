# Launch kit — `remotion-comments`

Drafts for distributing the package across the usual channels. Pick the ones you want to use, ignore the rest.

---

## 🐦 Twitter / X — main thread

```
1/ I let an LLM write a Remotion video for me. It nailed 90%.

The other 10% — minor visual tweaks — I had to type out as a chat
message: "at minute 2:13, the title in the upper-right is too big".
The AI guesses. I re-render. We loop.

There had to be a better way.

[image: hero.jpg]
```

```
2/ Today I'm releasing remotion-comments.

Click on the Remotion Studio preview, drop a pin, write what you
want changed. Each pin is anchored to (compositionId, atSec, posX%, posY%)
and saved as plain JSON.

The same LLM that generated the video reads the file and applies
the fix. Click. Pin. Comment.

[image: hero-real.png]
```

```
3/ Three things in one tiny package:

• <CommentsPanel/> — click on the preview to drop a pin
• <CommentSequences/> — comments appear as native clips on the
  Studio timeline (with the comment text as the clip name)
• "Comments" tab in the Studio sidebar, next to Props and Renders

100% Remotion APIs. Tab activated via a 23-line patch I'm proposing
upstream as a proper extension API.
```

```
4/ npm install remotion-comments

→ https://github.com/mario-hernandez/remotion-comments
→ https://www.npmjs.com/package/remotion-comments

Built because @JNYBGR's Remotion + MCP made the forward pass feel
like magic, and the review pass felt like 1998.

Curious to know if this resonates.
```

---

## 🟠 HackerNews — Show HN

**Title** (max 80 chars):

```
Show HN: I built the missing review loop for AI-generated video (Remotion)
```

**Text post**:

```
I've been generating video compositions with Remotion + an LLM in my
terminal (Claude Code, Cursor, Gemini CLI…). Forward pass: amazing.
Review pass: terrible. To tell the AI "the title at 2:13 is too big"
I had to leave the editor, type a guess of the timestamp into chat,
and hope the LLM correctly identified the element. Half the time it
didn't.

remotion-comments turns the review pass into a click on the video.
You drop a pin at exact (compositionId, atSec, posX%, posY%), write
a note, hit Enter. The note persists as plain JSON in the project's
public/ folder. Then you tell your AI "read public/comments.json and
apply each one as a code change". It opens the file, sees the pixel
each comment was anchored to, and edits the right Sequence.

Three pieces:
- <CommentsPanel/>: click-to-pin UI rendered inside the composition,
  hidden during render.
- <CommentSequences/>: each comment becomes a native <Sequence> with
  its text as the clip name on the Studio's timeline.
- A "Comments" tab in the Studio's right sidebar, next to Props and
  Renders.

Honest disclosure: the third piece needs a 23-line patch to
@remotion/studio's compiled OptionsPanel.js applied via
patch-package, because the Studio doesn't yet expose a way to
register custom tabs. I've opened a proposal upstream for a proper
extension API (registerStudioPanel) and the patch will be deprecated
once it lands.

The whole thing is one of those tools that probably "should have
existed already" — but it didn't, so I shipped it.

GitHub: https://github.com/mario-hernandez/remotion-comments
npm: npm install remotion-comments
Issue upstream: https://github.com/remotion-dev/remotion/issues/7200

Happy to answer anything.
```

---

## 💬 Remotion Discord — `#showcase`

```
Hey 👋 — just shipped remotion-comments, an open-source review tool
for Remotion compositions:

🔗 https://github.com/mario-hernandez/remotion-comments
📦 npm install remotion-comments

What it does: click anywhere on the Studio preview, drop a pin at
(compositionId, atSec, posX%, posY%), leave a note. Comments
persist as JSON, show as named clips on the official timeline, and
become a bridge between humans and the LLMs that generate the
video.

Built it because the AI-generated-video forward pass is great but
the iteration pass was painful — chat messages with vague
timestamps. Now: click → pin → comment → AI reads the JSON →
applies fixes. 30 seconds round-trip.

It also adds a "Comments" tab to the Studio's right sidebar (next
to Props/Renders). That part needs a small patch on
@remotion/studio because there's no extension API yet — I've
opened a proposal: https://github.com/remotion-dev/remotion/issues/7200

Would love feedback. Especially: am I missing an obvious use case
or extension point?
```

---

## 📣 Reddit — r/sideproject

**Title**:

```
I built remotion-comments — click on the video, drop a pin, the AI applies the fix
```

**Body**:

Same as the HN body, slightly chattier intro:

> If you've ever tried to generate videos with an LLM (Remotion + Claude Code / Cursor / etc.), you know the forward pass is magic and the review pass is hell. You spot something at minute 2:13, switch to chat, type "hey, the title's too big at 2:13", and the AI has to guess what you mean.
>
> So I built remotion-comments…

[continue same as HN]

---

## 📝 Dev.to / Hashnode

Long-form post idea:

> **Title**: "Closing the LLM↔video review loop with remotion-comments"
>
> **Outline**:
> 1. Hook: 2 short paragraphs on AI video generation today
> 2. The asymmetry: forward pass (great) vs review pass (broken)
> 3. The unlock: anchored feedback as plain JSON
> 4. Walkthrough with screenshots of the workflow
> 5. The Studio patch: an honest section + the path to upstream API
> 6. What's next: schema-aware comments (pin → which Sequence?), batch apply, multiplayer

Aim for ~1500 words, 4-5 screenshots. Submit to Dev.to and Hashnode same day.

---

## ✅ Awesome lists to PR

(Searched — none specifically for Remotion exists yet. Could be an opportunity to start one!)

- `awesome-react-components` — submit under "Video / Remotion"
- `awesome-llm-tools` — under "Tooling / Bridge"
- `awesome-claude-code` — under "Workflows"

---

## 📅 Suggested launch order

1. **Day 0** — npm publish ✅ (done), GitHub repo public ✅ (done), upstream issue ✅ (done)
2. **Day 0** — Discord post (low risk, friendly audience)
3. **Day 1 morning** — Twitter thread (with hero image and the link to the issue)
4. **Day 1 afternoon** — HN Show post (better at 9-11am EST midweek)
5. **Day 2** — Reddit posts
6. **Week 2** — Long-form post on Dev.to + 2 awesome list PRs
