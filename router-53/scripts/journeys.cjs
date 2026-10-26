// Browser journeys through the local router. Usage: node journeys.cjs <journeys.json> <outdir>
// journeys.json: [{ "id": "...", "label": "...", "url": "/workflows/..." }]
const { chromium } = require(process.env.PW_MODULE || '@playwright/test')
const fs = require('fs')
const ROUTER = process.env.ROUTER || 'http://127.0.0.1:8771'
const [, , file, out] = process.argv
;(async () => {
  const journeys = JSON.parse(fs.readFileSync(file, 'utf8'))
  fs.mkdirSync(`${out}/shots`, { recursive: true })
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await context.tracing.start({ screenshots: true, snapshots: true })
  const results = []
  for (const j of journeys) {
    const page = await context.newPage()
    const hops = []
    page.on('response', (r) => {
      if (r.request().isNavigationRequest() && r.request().frame() === page.mainFrame())
        hops.push(`${r.status()} ${new URL(r.url()).pathname}${new URL(r.url()).search}`)
    })
    const resp = await page.goto(ROUTER + j.url, { waitUntil: 'networkidle', timeout: 90000 })
    const finalUrl = new URL(page.url())
    const landed = finalUrl.pathname + finalUrl.search
    const heading = (await page.locator('h1').first().textContent({ timeout: 5000 }).catch(() => '')) || ''
    const source = resp ? resp.headers()['x-comfy-content-source'] : ''
    await page.evaluate(
      ({ typed, landed, status, hops }) => {
        const bar = document.createElement('div')
        bar.style.cssText =
          'position:fixed;left:0;right:0;bottom:0;z-index:2147483647;background:#111;color:#fff;font:14px/1.45 ui-monospace,Menlo,monospace;padding:10px 16px;border-top:3px solid #f5c400'
        bar.textContent = `Opened: ${typed}\nLanded: ${landed}  (HTTP ${status})\nHops: ${hops.join('  >  ')}`
        bar.style.whiteSpace = 'pre'
        document.body.appendChild(bar)
      },
      { typed: j.url, landed, status: resp ? resp.status() : 'none', hops }
    )
    await page.screenshot({ path: `${out}/shots/${j.id}.png` })
    results.push({ ...j, landed, status: resp && resp.status(), source, heading: heading.trim(), hops, pass: j.expect ? landed.replace(/\/$/, '') === j.expect.replace(/\/$/, '') && resp.status() === 200 : resp.status() === 200 })
    await page.close()
  }
  await context.tracing.stop({ path: `${out}/trace.zip` })
  await browser.close()
  fs.writeFileSync(`${out}/journeys-result.json`, JSON.stringify(results, null, 1))
  for (const r of results) console.log(r.pass ? 'PASS' : 'FAIL', r.id, r.url, '->', r.landed, r.status, r.source, '|', r.heading)
})()
