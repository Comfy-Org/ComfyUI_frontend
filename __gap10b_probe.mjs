// gap-10-b browser probe: by-id connect() overload on main (00b9a9c64c)
// Run: ~/.nvm/versions/node/v24.15.0/bin/node __gap10b_probe.mjs
import { chromium } from '@playwright/test'

const URL = 'http://127.0.0.1:5199/'
const browser = await chromium.launch()
const page = await browser.newPage()
const consoleMsgs = []
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning')
    consoleMsgs.push({ type: m.type(), text: m.text().slice(0, 200) })
})
const pageErrors = []
page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 200)))

await page.addInitScript(() => {
  localStorage.setItem(
    'Comfy.userId',
    'playwright-test-0_97463489-4bcc-4649-bfd2-913d2a926c1c'
  )
  localStorage.setItem('Comfy.userName', 'playwright-test-0')
})
await page.goto(URL, { waitUntil: 'domcontentloaded' })
await page.waitForFunction(
  () => window['app']?.graph?._nodes?.length > 0,
  null,
  { timeout: 60000 }
)
// let the workflow settle
await page.waitForTimeout(2000)
consoleMsgs.length = 0 // only count errors during the probes

const result = await page.evaluate(() => {
  const app = window['app']
  const graph = app.graph
  const nodes = graph._nodes
  const byType = (t) => nodes.find((n) => n.type === t)
  const src = byType('CheckpointLoaderSimple') ?? byType('CLIPLoader')
  const tgt = nodes.filter((n) => n.type === 'CLIPTextEncode')[0]
  if (!src || !tgt) return { error: 'default workflow nodes not found', types: nodes.map((n) => n.type) }

  const linkCount = () => Object.keys(graph.links ?? {}).length || graph.links?.size || 0
  const lc = () => (graph.links instanceof Map ? graph.links.size : Object.keys(graph.links).length)

  const out = {
    head: '00b9a9c64c (origin/main)',
    idTypeofSrc: typeof src.id,
    idTypeofTgt: typeof tgt.id,
    tgtIdValue: String(tgt.id),
    liteGraphDebug: window['LiteGraph'] ? window['LiteGraph'].debug : 'no-global',
    arms: {}
  }

  // CLIP output slot on CheckpointLoaderSimple
  const clipOut = src.outputs.findIndex((o) => o.name === 'CLIP')
  // clear target input 0 (clip) so each arm starts unlinked
  tgt.disconnectInput(0)

  // Arm A: by-id with the minted (string) id — the ComfyUI-Custom-Scripts pattern
  const beforeA = lc()
  let retA, threwA = null
  try {
    retA = src.connect(clipOut, tgt.id, 0)
  } catch (e) {
    threwA = String(e)
  }
  out.arms.A_stringId = {
    call: `src.connect(${clipOut}, tgt.id /* "${String(tgt.id)}" */, 0)`,
    returned: retA === null ? 'null' : retA === undefined ? 'undefined' : 'LLink',
    threw: threwA,
    linksDelta: lc() - beforeA,
    tgtInput0HasLink: tgt.inputs[0].link != null
  }

  // Arm B: numeric coercion of the same id (legacy numeric-id caller shape)
  const beforeB = lc()
  let retB, threwB = null
  try {
    retB = src.connect(clipOut, Number(tgt.id), 0)
  } catch (e) {
    threwB = String(e)
  }
  out.arms.B_numericId = {
    call: `src.connect(${clipOut}, Number(tgt.id) /* ${Number(tgt.id)} */, 0)`,
    returned: retB === null ? 'null' : retB === undefined ? 'undefined' : retB ? 'LLink' : String(retB),
    threw: threwB,
    linksDelta: lc() - beforeB,
    tgtInput0HasLink: tgt.inputs[0].link != null
  }

  // Arm C (control): instance overload
  const beforeC = lc()
  let retC, threwC = null
  try {
    retC = src.connect(clipOut, tgt, 0)
  } catch (e) {
    threwC = String(e)
  }
  out.arms.C_instance = {
    call: `src.connect(${clipOut}, tgt /* instance */, 0)`,
    returned: retC === null ? 'null' : retC === undefined ? 'undefined' : 'LLink',
    threw: threwC,
    linksDelta: lc() - beforeC,
    tgtInput0HasLink: tgt.inputs[0].link != null
  }
  return out
})

console.log(JSON.stringify({ result, consoleMsgs, pageErrors }, null, 2))
await browser.close()
