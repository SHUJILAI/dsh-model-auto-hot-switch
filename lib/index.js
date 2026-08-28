/**
 * dsh-model-auto-hot-switch — node half.
 *
 * Automatic per-task model hot-switching for DeepSeek Harness:
 *   - `agent/pre-step` classifies each step locally (zero tokens): does the
 *     step's messages carry an image?
 *   - `agent/request` then swaps ONLY the provider/model fields of the frozen
 *     call configuration when the step needs vision; every other task keeps
 *     the default model and the config is returned untouched (zero overhead).
 *   - Nothing in the session is rewritten: messages, system prompt, tools and
 *     session state stay exactly as the harness produced them. The loop logs
 *     the changed header snapshot, which is its sanctioned channel.
 *
 * The browser half (lib/client.js) reads the toggle state from
 * GET/POST /plugins/dsh-model-auto-hot-switch/state. The toggle persists into
 * config.json next to the package (survives restarts; cleared only if the
 * file is removed). Without a webServer (headless profiles) the routes are
 * skipped but the hot-switch logic still runs from the persisted toggle.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

/** Cordis plugin name. */
export const name = 'dsh-model-auto-hot-switch'

/** Every service is optional: the plugin degrades instead of blocking the host. */
export const inject = []

const here = dirname(fileURLToPath(import.meta.url))
/** config.json sits at the package root, one level above lib/. */
const CONFIG_PATH = join(here, '..', 'config.json')

/** Request body cap for the toggle write (a tiny JSON document). */
const MAX_BODY_BYTES = 64 * 1024

/** The default vision model, preferred when present in the provider catalog. */
const PREFERRED_VISION_MODEL = 'deepseek-v4-flash-vision-exp'

/** Read the persisted toggle; a missing or corrupt file means "off". */
async function readPersisted() {
  try {
    const raw = await readFile(CONFIG_PATH, 'utf8')
    const parsed = JSON.parse(raw)
    return parsed !== null && typeof parsed === 'object' && parsed.enabled === true
  } catch {
    return false
  }
}

async function writePersisted(enabled) {
  try {
    await writeFile(CONFIG_PATH, JSON.stringify({ enabled }, null, 2), 'utf8')
  } catch (error) {
    // Persistence failure must never break a request; the toggle stays in memory.
    console.error('[dsh-model-auto-hot-switch] could not persist config.json', error)
  }
}

/** Recursively detect an image block, walking nested tool-result content. */
function hasImageBlocks(blocks) {
  if (!Array.isArray(blocks)) return false
  for (const block of blocks) {
    if (block === null || typeof block !== 'object') continue
    if (block.type === 'image') return true
    if (block.type === 'tool-result' && hasImageBlocks(block.content)) return true
  }
  return false
}

/** Extract the agent's session id defensively; undefined outside a live agent. */
function sessionIdOf(agent) {
  try {
    return agent !== null && typeof agent === 'object'
      && agent.session !== null && typeof agent.session === 'object'
      ? String(agent.session.id)
      : undefined
  } catch {
    return undefined
  }
}

export function apply(ctx) {
  // ── state ────────────────────────────────────────────────────────────────
  let enabled = false
  readPersisted().then((value) => { enabled = value }).catch(() => {})

  const llm = ctx.get('llm')
  const visionSteps = new Map() // `${sessionId}|${turn}|${step}` -> true
  let lastSwitch = null // display-only record of the most recent hot-switch
  let visionCache = undefined

  /** Discover the first vision-capable model across all registered providers. */
  async function discoverVisionModel() {
    if (visionCache !== undefined) return visionCache
    visionCache = null
    if (llm === undefined) return visionCache
    const found = []
    for (const provider of llm.listProviders()) {
      let models = []
      try { models = await llm.listModels(provider.id) } catch { continue }
      for (const model of models) {
        try {
          const info = await llm.resolveModelInfo(provider.id, model.id)
          if (Array.isArray(info.inputModalities) && info.inputModalities.includes('image')) {
            found.push({ provider: provider.id, model: model.id, name: model.name || model.id })
          }
        } catch { continue }
      }
    }
    visionCache = found.find((m) => m.model === PREFERRED_VISION_MODEL) ?? found[0] ?? null
    return visionCache
  }

  // ── hot-switch extension points ──────────────────────────────────────────
  ctx.on('agent/pre-step', (payload, next) => {
    try {
      const sessionId = sessionIdOf(payload.agent)
      if (enabled && sessionId !== undefined && hasImageBlocks(payload.messages)) {
        visionSteps.set(`${sessionId}|${payload.turn}|${payload.step}`, true)
      }
    } catch (error) {
      console.error('[dsh-model-auto-hot-switch] pre-step classification failed', error)
    }
    return next()
  })

  ctx.on('agent/request', async (payload, next) => {
    const sessionId = sessionIdOf(payload.agent)
    const key = `${sessionId}|${payload.turn}|${payload.step}`
    const needVision = visionSteps.get(key)
    if (needVision) visionSteps.delete(key)
    const config = await next()
    if (!enabled) return config

    const vision = await discoverVisionModel()
    if (needVision === true) {
      if (vision !== null && (config.provider !== vision.provider || config.model !== vision.model)) {
        lastSwitch = { at: Date.now(), kind: 'vision', model: vision.model }
        return { ...config, provider: vision.provider, model: vision.model }
      }
      return config
    }

    // Non-vision step: the loop builds later steps from the logged request
    // header, so a vision route switched above would stick to the whole
    // session. Restore the session's declared default route explicitly.
    const options = payload.agent !== null && typeof payload.agent === 'object' ? payload.agent.options : undefined
    const routeProvider = options !== undefined && options !== null ? options.provider : undefined
    const routeModel = options !== undefined && options !== null ? options.model : undefined
    if (routeProvider !== undefined && routeProvider !== null
      && routeModel !== undefined && routeModel !== null
      && (config.provider !== routeProvider || config.model !== routeModel)) {
      return { ...config, provider: routeProvider, model: routeModel }
    }
    return config
  })

  // ── state surface for the browser half ───────────────────────────────────
  async function stateFor() {
    let selection = null
    const defaultModel = ctx.get('agentDefaultModel')
    if (defaultModel !== undefined) {
      try {
        const current = defaultModel.currentSelection()
        if (current !== undefined && current !== null) {
          selection = {
            provider: current.provider,
            model: current.model,
            reasoningEffort: current.reasoningEffort,
          }
        }
      } catch { selection = null }
    }
    return {
      enabled,
      vision: await discoverVisionModel(),
      defaultModel: selection,
      lastSwitch,
    }
  }

  async function readBody(req) {
    const chunks = []
    let size = 0
    for await (const chunk of req) {
      size += chunk.length
      if (size > MAX_BODY_BYTES) throw new Error('body too large')
      chunks.push(chunk)
    }
    return Buffer.concat(chunks).toString('utf8')
  }

  const webServer = ctx.get('webServer')
  if (webServer !== undefined) {
    webServer.register({
      path: '/plugins/dsh-model-auto-hot-switch/state',
      async handler(req, res) {
        res.setHeader('content-type', 'application/json; charset=utf-8')
        if (req.method === 'GET' || req.method === 'HEAD') {
          res.end(JSON.stringify(await stateFor()))
          return
        }
        if (req.method === 'POST' || req.method === 'PUT') {
          let body
          try {
            body = JSON.parse(await readBody(req))
          } catch {
            res.statusCode = 400
            res.end(JSON.stringify({ error: 'invalid json body' }))
            return
          }
          if (typeof body.enabled !== 'boolean') {
            res.statusCode = 400
            res.end(JSON.stringify({ error: 'body.enabled must be a boolean' }))
            return
          }
          enabled = body.enabled
          await writePersisted(enabled)
          res.end(JSON.stringify(await stateFor()))
          return
        }
        res.statusCode = 405
        res.end(JSON.stringify({ error: 'method not allowed' }))
      },
    })
  }
}
