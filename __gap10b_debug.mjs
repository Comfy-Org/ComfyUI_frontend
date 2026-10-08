import { chromium } from '@playwright/test'
const browser = await chromium.launch()
const page = await browser.newPage()
page.on('console', (m) => console.log('[console]', m.type(), m.text().slice(0, 300)))
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 300)))
page.on('requestfailed', (r) => console.log('[reqfail]', r.url().slice(0, 120), r.failure()?.errorText))
await page.goto('http://127.0.0.1:5199/', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(20000)
const state = await page.evaluate(() => ({
  hasApp: !!window['app'],
  hasComfyApp: !!window['comfyAPI'],
  graphNodes: window['app']?.graph?._nodes?.length ?? 'n/a',
  title: document.title,
  bodyPreview: document.body?.innerText?.slice(0, 200)
}))
console.log(JSON.stringify(state, null, 2))
await page.screenshot({ path: '/tmp/gap10b-debug.png' })
await browser.close()
