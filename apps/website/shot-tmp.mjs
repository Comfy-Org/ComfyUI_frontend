import { chromium } from 'playwright'

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 3 })

await page.route('**://raw.githubusercontent.com/**', (r) => r.abort())
await page.route('**://media.comfy.org/**', (r) => r.abort())

await page.goto('http://localhost:4321/hub/', { waitUntil: 'networkidle', timeout: 90000 })
await page.waitForSelector('[data-testid="hub-type-badge"]', { timeout: 30000 })

const badge = page.locator('[data-testid="hub-type-badge"]').first()
await badge.screenshot({ path: '/tmp/claude-0/shots/badge-closed.png' })

const card = page.locator('[data-testid="catalogue-card"]').first()
await card.hover()
await page.waitForTimeout(600)
await card.screenshot({ path: '/tmp/claude-0/shots/card-hover.png' })

await browser.close()
