# ⚡ dsh-model-auto-hot-switch

**Automatic per-task model hot-switching for DeepSeek Harness (dsh).** Image-aware tasks route to the vision model automatically; every other task keeps the default model you chose. Zero extra tokens, zero context disturbance, one click to enable.

[![License](https://img.shields.io/github/license/SHUJILAI/dsh-model-auto-hot-switch)](LICENSE)
[![npm version](https://img.shields.io/npm/v/dsh-model-auto-hot-switch)](https://www.npmjs.com/package/dsh-model-auto-hot-switch)

[中文说明](README.zh.md)

---

## What it does

DeepSeek Harness models do not all accept images. When you ask the agent to read a screenshot, an OCR job, or any image file, the request should go to a vision-capable model — while plain chat and coding keep the fast default model. This plugin makes that switch **automatic and per-task**, inside the same session:

- **Vision task** (the step's messages carry an image) → routed to the discovered vision model, e.g. `deepseek-v4-flash-vision-exp`
- **Everything else** → the exact default model you selected, configuration returned untouched

## Why it costs nothing

- **Zero extra tokens.** Task classification is pure local code (does the step contain an image block?). No classifier model call, no prompt rewrite, no duplicated requests.
- **No context disturbance.** Only the `provider`/`model` fields of the frozen per-step call configuration are replaced, through the harness's own `agent/request` extension point. Messages, system prompt, tools, and session state are never rewritten.
- **No overhead on normal tasks.** Non-image steps restore the session's default route in one field swap when a previous step left the vision model in the held request header (and return the configuration untouched otherwise) — no classifier call, no extra request.

## Installation

Requires DeepSeek Harness (`dsh`) with a Web profile.

```bash
# from npm
dsh plugin --profile web add dsh-model-auto-hot-switch

# or straight from GitHub
dsh plugin --profile web add github:SHUJILAI/dsh-model-auto-hot-switch
```

Restart `dsh web`, then click the floating **⚡** button (bottom-right) to switch automatic hot-switching on. The readout shows:

- the routing target for vision tasks (the first discovered model whose capability declares image input),
- the default model all other tasks keep using,
- the most recent hot-switch event.

The toggle persists in `config.json` beside the package and survives restarts.

## Prerequisites

- A vision-capable model in your provider catalog. The plugin auto-discovers it through `llm.listModels` / `llm.resolveModelInfo` — no configuration needed. For the official DeepSeek provider this is `deepseek-v4-flash-vision-exp` (available on the DeepSeek API). Without any vision model, the toggle still works but vision routing stays idle and the readout says so.
- The `read_image` tool's own gate must also see the vision model, which requires the dsh build whose DeepSeek adapter declares image input for it.

## How it works

```
user sends an image task
   │
   ▼
agent/pre-step ──► contains image? ── yes ──► mark this step as vision
   │                    │
   │                    no
   ▼                    ▼
agent/request ──► return the default config   return config with provider/model
                 (untouched, zero overhead)   swapped to the vision model
```

The classification runs per `(session, turn, step)` and is consumed by the matching `agent/request` call, so a later step of the same turn re-classifies independently. Subagents get the same treatment under their own sessions.

## Configuration

None. The single toggle is the whole surface:

| Field | Meaning |
| --- | --- |
| `enabled` (in `config.json`) | `true` routes image tasks to the vision model; `false` leaves every request on the default model |

The preferred vision model id is `deepseek-v4-flash-vision-exp`; if absent, the first discovered image-capable model wins.

## Compatibility

- Works with dsh Web profiles (routes under `/plugins/dsh-model-auto-hot-switch/state`).
- Headless profiles: routes are skipped, the hot-switch logic still runs from the persisted toggle.
- Does not depend on any official `@deepseek-ai/*` runtime package; no `peerDependencies`.

## Development

```bash
npm test          # package-shape + syntax smoke checks
```

## License

MIT — see [LICENSE](LICENSE).
