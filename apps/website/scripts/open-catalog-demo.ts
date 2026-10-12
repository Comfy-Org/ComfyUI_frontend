import { readFile } from 'node:fs/promises'
import { chromium, expect } from '@playwright/test'

// Local-only demo window. The actual backend verifies this signed fixture
// account; no credentials enter a URL, browser script, clipboard or log.
const website = 'http://127.0.0.1:4349'
const file = process.env.CCC_DEMO_CREDENTIAL_FILE
if (!file) throw new Error('Private local demo credential filepath required')
const credential = (await readFile(file, 'utf8')).trim()
const browser = await chromium.launch({ headless: false })
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
const session = await context.request.post(`${website}/admin/content-session`, { headers: { Origin: website, Authorization: `Bearer ${credential}` } })
if (session.status() !== 204) { await browser.close(); throw new Error('Verified local staff session unavailable') }
const page = await context.newPage()
await page.goto(`${website}/admin/catalog`)
await expect(page.getByRole('heading', { name: 'Draft changes' })).toBeVisible()
const editor = await context.newPage()
await editor.goto(`${website}/admin/content/2cca3e98-4b4f-425e-8882-8f10e5ff921e/edit`)
await expect(editor.locator('[data-editor-ready=true]')).toBeVisible()
await page.bringToFront()
console.log('Verified local staff demo window open: Draft review and saved-content editor. Publish is unavailable.')
process.once('SIGTERM', () => { void browser.close() })
process.once('SIGINT', () => { void browser.close() })
await new Promise<void>((resolve) => browser.once('disconnected', resolve))
