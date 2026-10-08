// gap-10-b probe 2: the verbatim ComfyUI-Custom-Scripts chain on main
import { chromium } from '@playwright/test'
const browser = await chromium.launch()
const page = await browser.newPage()
const consoleMsgs = []
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning')
    consoleMsgs.push({ type: m.type(), text: m.text().slice(0, 200) })
})
await page.addInitScript(() => {
  localStorage.setItem(
    'Comfy.userId',
    'playwright-test-0_97463489-4bcc-4649-bfd2-913d2a926c1c'
  )
})
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded' })
await page.waitForFunction(() => window['app']?.graph?._nodes?.length > 0, null, {
  timeout: 60000
})
await page.waitForTimeout(2000)
consoleMsgs.length = 0

const result = await page.evaluate(() => {
  const app = window['app']
  const g = app.graph
  const out = { head: 'f1bfb313d6 (feature/ecs-migration)' }

  // a real live link from the loaded workflow whose both ends resolve
  const anyLink = [...g.links.values()].find(
    (l) => g.getNodeById(l.origin_id) && g.getNodeById(l.target_id)
  )
  if (!anyLink)
    return {
      error: 'no fully-resolvable link',
      linkEnds: [...g.links.values()].map((l) => [String(l.origin_id), String(l.target_id)])
    }
  out.linkShape = {
    id: String(anyLink.id),
    typeofId: typeof anyLink.id,
    typeofTargetId: typeof anyLink.target_id,
    typeofOriginId: typeof anyLink.origin_id
  }
  // legacy index access (Custom-Scripts does graph.links[l])
  const legacy = g.links[anyLink.id]
  out.legacyIndexAccess = legacy
    ? 'works (returns link)'
    : String(legacy)
  out.windowGraphGlobal = typeof window['graph']

  // verbatim Custom-Scripts pattern: spread-copy the link, connect by target_id
  const srcNode = g.getNodeById(anyLink.origin_id)
  const spread = legacy ? { ...legacy } : null
  out.spreadCopy = spread
    ? {
        keys: Object.keys(spread),
        target_id: String(spread.target_id),
        typeofTargetId: typeof spread.target_id
      }
    : 'legacy index access failed'
  // fall back to live fields so the connect arm still runs when spread is lossy
  const copy = {
    target_id:
      spread && spread.target_id !== undefined ? spread.target_id : anyLink.target_id,
    target_slot:
      spread && spread.target_slot !== undefined ? spread.target_slot : anyLink.target_slot
  }
  const tgtNode = g.getNodeById(copy.target_id)
  tgtNode.disconnectInput(copy.target_slot)
  const before = g.links.size
  let ret, threw = null
  try {
    ret = srcNode.connect(anyLink.origin_slot, copy.target_id, copy.target_slot)
  } catch (e) {
    threw = String(e)
  }
  out.customScriptsPattern = {
    call: `srcNode.connect(${anyLink.origin_slot}, copy.target_id /* ${typeof copy.target_id} "${String(copy.target_id)}" */, ${String(copy.target_slot)})`,
    returned: ret === null ? 'null' : ret === undefined ? 'undefined' : 'LLink',
    threw,
    linksDelta: g.links.size - before,
    targetInputRestored: tgtNode.inputs[copy.target_slot].link != null
  }
  // restore for cleanliness
  srcNode.connect(anyLink.origin_slot, tgtNode, copy.target_slot)
  return out
})
console.log(JSON.stringify({ result, consoleMsgs }, null, 2))
await browser.close()
