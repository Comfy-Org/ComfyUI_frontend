import { chromium } from '@playwright/test'
const browser = await chromium.launch()
const page = await browser.newPage()
await page.addInitScript(() => {
  localStorage.setItem('Comfy.userId', 'playwright-test-0_97463489-4bcc-4649-bfd2-913d2a926c1c')
})
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded' })
await page.waitForFunction(() => window['app']?.graph?._nodes?.length > 0, null, { timeout: 60000 })
await page.waitForTimeout(2000)
const r = await page.evaluate(() => {
  const g = window['app'].graph
  const l = [...g.links.values()].find((x) => g.getNodeById(x.origin_id) && g.getNodeById(x.target_id))
  const src = g.getNodeById(l.origin_id)
  let ret, threw = null
  try { ret = src.connect(l.origin_slot, undefined, l.target_slot) } catch (e) { threw = String(e) }
  return { head: 'f1bfb313d6 branch', call: 'connect(slot, undefined, slot)', returned: ret === null ? 'null' : String(ret), threw }
})
console.log(JSON.stringify(r))
await browser.close()
