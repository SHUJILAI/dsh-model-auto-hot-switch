/**
 * dsh-model-auto-hot-switch — browser half.
 *
 * A small floating toggle (bottom-right) that switches the automatic
 * per-task model hot-switching on or off, plus a compact status readout:
 *   - auto hot-switch: on/off
 *   - vision task routing target (the discovered vision model)
 *   - the default model every other task keeps using
 *   - the most recent hot-switch event
 *
 * State comes from the node half at
 * GET/POST /plugins/dsh-model-auto-hot-switch/state (same origin). The
 * readout polls every 2s; polling is plain JSON — no LLM, no tokens.
 *
 * The widget is deliberately self-contained: it floats above the app frame
 * and never touches internal page structure, so it keeps working across DSH
 * UI revisions. When the state endpoint is unreachable the button still
 * renders but shows "unavailable" instead of failing.
 */
window.__ModuleLoader__.load({
  id: 'dsh-model-auto-hot-switch',
  factory: (require) => {
    const STATE_URL = './plugins/dsh-model-auto-hot-switch/state'
    const POLL_MS = 2000

    let root = null
    let open = false
    let state = null
    let unavailable = false

    const style = document.createElement('style')
    style.textContent = `
      .dsh-hs-btn{position:fixed;right:18px;bottom:18px;z-index:2147483000;width:44px;height:44px;
        border-radius:50%;border:1px solid rgba(77,107,254,.55);background:rgba(20,22,32,.92);
        color:#fff;font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center;
        box-shadow:0 2px 10px rgba(0,0,0,.35);transition:transform .12s}
      .dsh-hs-btn:hover{transform:scale(1.08)}
      .dsh-hs-btn.on{background:#4D6BFE;border-color:#4D6BFE}
      .dsh-hs-panel{position:fixed;right:18px;bottom:70px;z-index:2147483000;width:280px;max-width:calc(100vw - 36px);
        background:rgba(22,24,34,.97);color:#e8eaf2;border:1px solid rgba(255,255,255,.12);border-radius:12px;
        padding:12px 14px;font:12px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
        box-shadow:0 8px 28px rgba(0,0,0,.45)}
      .dsh-hs-panel h4{margin:0 0 8px;font-size:13px}
      .dsh-hs-panel .row{display:flex;justify-content:space-between;gap:10px;padding:3px 0;border-top:1px solid rgba(255,255,255,.08)}
      .dsh-hs-panel .row:first-of-type{border-top:none}
      .dsh-hs-panel .label{color:#9aa0b5;white-space:nowrap}
      .dsh-hs-panel .value{text-align:right;word-break:break-all}
      .dsh-hs-panel .warn{color:#f2b24c}
      .dsh-hs-switch{margin-top:10px;display:flex;align-items:center;gap:8px;cursor:pointer;user-select:none}
      .dsh-hs-track{width:34px;height:18px;border-radius:9px;background:#3a3f52;position:relative;transition:background .15s}
      .dsh-hs-track.on{background:#4D6BFE}
      .dsh-hs-thumb{position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:#fff;transition:left .15s}
      .dsh-hs-track.on .dsh-hs-thumb{left:18px}
    `
    document.head.appendChild(style)

    async function fetchState() {
      try {
        const res = await fetch(STATE_URL, { headers: { accept: 'application/json' } })
        if (!res.ok) throw new Error(String(res.status))
        state = await res.json()
        unavailable = false
      } catch {
        unavailable = true
      }
      render()
    }

    async function setEnabled(next) {
      try {
        const res = await fetch(STATE_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ enabled: next }),
        })
        if (!res.ok) throw new Error(String(res.status))
        state = await res.json()
        unavailable = false
      } catch {
        unavailable = true
      }
      render()
    }

    function render() {
      if (root === null) return
      const btn = root.querySelector('.dsh-hs-btn')
      if (btn !== null) {
        btn.classList.toggle('on', state !== null && state.enabled === true)
        btn.title = state !== null && state.enabled === true
          ? 'Auto hot-switch: on (vision tasks → vision model)'
          : 'Auto hot-switch: off'
      }
      const panel = root.querySelector('.dsh-hs-panel')
      if (panel === null || !open) return
      const enabled = state !== null && state.enabled === true
      const vision = state !== null && state.vision !== null && state.vision !== undefined ? state.vision : null
      const def = state !== null && state.defaultModel !== null && state.defaultModel !== undefined ? state.defaultModel : null
      const last = state !== null && state.lastSwitch !== null && state.lastSwitch !== undefined ? state.lastSwitch : null
      panel.innerHTML = ''
      const h = document.createElement('h4')
      h.textContent = '⚡ Model Auto Hot-Switch'
      panel.appendChild(h)
      const rows = []
      rows.push(['状态', unavailable ? '不可达' : (enabled ? '开' : '关')])
      rows.push(['识图任务', vision !== null ? vision.model : '未发现视觉模型'])
      rows.push(['其他任务', def !== null ? def.model : '—'])
      rows.push(['最近切换', last !== null ? `${last.kind} → ${last.model}` : '—'])
      for (const [label, value] of rows) {
        const row = document.createElement('div')
        row.className = 'row'
        const l = document.createElement('span')
        l.className = 'label'
        l.textContent = label
        const v = document.createElement('span')
        v.className = 'value'
        v.textContent = String(value)
        row.append(l, v)
        panel.appendChild(row)
      }
      if (vision === null && !unavailable) {
        const warn = document.createElement('div')
        warn.className = 'warn'
        warn.textContent = '未发现支持识图的模型：请确认 dsh 已更新到含 vision 模型的版本并重启 dsh web。'
        panel.appendChild(warn)
      }
      const sw = document.createElement('div')
      sw.className = 'dsh-hs-switch'
      const track = document.createElement('div')
      track.className = 'dsh-hs-track' + (enabled ? ' on' : '')
      const thumb = document.createElement('div')
      thumb.className = 'dsh-hs-thumb'
      track.appendChild(thumb)
      const label = document.createElement('span')
      label.textContent = enabled ? '自动热切：开' : '自动热切：关'
      sw.append(track, label)
      sw.addEventListener('click', () => setEnabled(!enabled))
      panel.appendChild(sw)
    }

    function ensureRoot() {
      if (root !== null && document.body.contains(root)) return
      root = document.createElement('div')
      const btn = document.createElement('button')
      btn.className = 'dsh-hs-btn'
      btn.textContent = '⚡'
      btn.setAttribute('aria-label', 'Model auto hot-switch')
      btn.addEventListener('click', () => {
        open = !open
        render()
      })
      const panel = document.createElement('div')
      panel.className = 'dsh-hs-panel'
      panel.style.display = 'none'
      root.append(btn, panel)
      document.body.appendChild(root)
      render()
    }

    const observer = new MutationObserver(() => ensureRoot())
    observer.observe(document.body, { childList: true })

    // The panel body swaps between open/closed by display, not by removal,
    // so the observer above only needs to fight for the root's presence.
    const originalRender = render
    render = () => {
      originalRender()
      const panel = root === null ? null : root.querySelector('.dsh-hs-panel')
      if (panel !== null) panel.style.display = open ? 'block' : 'none'
    }

    ensureRoot()
    fetchState()
    const timer = setInterval(fetchState, POLL_MS)
    return () => {
      clearInterval(timer)
      observer.disconnect()
      if (root !== null) root.remove()
      style.remove()
    }
  },
})
