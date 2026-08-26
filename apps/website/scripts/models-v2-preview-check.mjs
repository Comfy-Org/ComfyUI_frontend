// E2E check for the /models-v2 A/B-test preview. Run against any base URL:
//   node scripts/models-v2-preview-check.mjs http://localhost:4321
//   node scripts/models-v2-preview-check.mjs https://<deployment>.vercel.app
// Uses the repo's @playwright/test with the installed Chrome channel.
import { chromium } from '@playwright/test'

const BASE = process.argv[2] ?? 'http://localhost:4321'
const results = []
const check = (name, ok, note = '') => {
  results.push([name, ok, note])
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${note ? ' — ' + note : ''}`)
}

const run = async () => {
  const browser = await chromium.launch({ channel: 'chrome' })
  const desktop = await (
    await browser.newContext({ viewport: { width: 1440, height: 900 } })
  ).newPage()

  // ---------- DIRECTORY ----------
  await desktop.goto(`${BASE}/models-v2`, { waitUntil: 'networkidle' })
  const visible = () =>
    desktop.$$eval(
      '.m-card',
      (els) => els.filter((e) => e.style.display !== 'none').length
    )

  const total = await visible()
  await desktop.fill('#model-search', 'flux')
  await desktop.waitForTimeout(300)
  const flux = await visible()
  check('search filters', flux > 3 && flux < total, `${flux}/${total}`)
  check(
    'match counter',
    /match/.test((await desktop.textContent('#match-count')) ?? ''),
    ''
  )
  await desktop.click('#search-clear')
  await desktop.waitForTimeout(200)
  check('search clear button', (await visible()) === total, '')
  await desktop.fill('#model-search', 'wan')
  await desktop.keyboard.press('Escape')
  await desktop.waitForTimeout(200)
  check('escape clears', (await visible()) === total, '')

  for (const pill of ['partner', 'loras', 'launch']) {
    await desktop.click(`[data-pill="${pill}"]`)
    await desktop.waitForTimeout(250)
    const n = await visible()
    check(`pill ${pill}`, n > 0 && n < total, `${n}`)
  }
  await desktop.click('[data-pill="all"]')
  await desktop.click('[data-try="q:flux"]')
  await desktop.waitForTimeout(300)
  check('try-chip q:flux', (await visible()) === flux, '')
  await desktop.click('#search-clear')

  // Scoped to <main>: the shared site footer links /p/supported-models by design.
  check(
    'no legacy links',
    (await desktop.$$eval(
      'main a[href*="/p/supported-models"]',
      (a) => a.length
    )) === 0,
    ''
  )
  const llms = await desktop.request.get(`${BASE}/models-v2/llms.txt`)
  check(
    'llms.txt',
    llms.status() === 200 && (await llms.text()).includes('FLUX 3'),
    ''
  )
  const wanAlias = await desktop.request.get(`${BASE}/models-v2/wan`)
  check('wan alias', wanAlias.status() === 200, '')

  // ---------- MODEL PAGE (client-side nav — the astro:page-load path) ----------
  await desktop.click('a[href="/models-v2/flux-3"]')
  await desktop.waitForURL('**/models-v2/flux-3')
  await desktop.waitForTimeout(400)

  // APP | GRAPH | JSON
  await desktop.click('[data-iview="graph"]')
  check(
    'graph view',
    await desktop.$eval(
      '#panel-graph',
      (el) => !el.classList.contains('hidden')
    ),
    ''
  )
  check(
    'graph svg',
    (await desktop.$$eval('#panel-graph svg g', (g) => g.length)) >= 5,
    ''
  )
  await desktop.click('[data-iview="json"]')
  const j1 = (await desktop.textContent('#input-json')) ?? ''
  check('json view payload', j1.includes('"workflow": "flux-3"'), '')
  await desktop.click('[data-iview="app"]')
  await desktop.fill('#pg-prompt', 'a red fox in the snow')
  await desktop.click('[data-iview="json"]')
  check(
    'prompt live-binds json',
    ((await desktop.textContent('#input-json')) ?? '').includes(
      'a red fox in the snow'
    ),
    ''
  )
  await desktop.click('[data-iview="graph"]')
  check(
    'prompt live-binds graph',
    ((await desktop.textContent('#g-prompt-1')) ?? '').includes('a red fox'),
    ''
  )
  await desktop.click('[data-iview="app"]')

  // repricing
  const costBefore = (await desktop.textContent('#cost-line')) ?? ''
  await desktop.selectOption('#sel-resolution', '1080p')
  const costAfter = (await desktop.textContent('#cost-line')) ?? ''
  check(
    'resolution reprices',
    costBefore !== costAfter && costAfter.includes('24'),
    costAfter
  )
  await desktop.selectOption('#sel-resolution', '720p')

  // reference image
  await desktop.click('#add-image-btn')
  await desktop.click('[data-iview="json"]')
  check(
    'reference image in payload',
    ((await desktop.textContent('#input-json')) ?? '').includes(
      'reference_image'
    ),
    ''
  )
  await desktop.click('[data-iview="app"]')

  // result JSON tab (pre-run receipt)
  await desktop.click('[data-rview="json"]')
  check(
    'result json example receipt',
    ((await desktop.textContent('#result-json')) ?? '').includes(
      '"status": "example"'
    ),
    ''
  )
  await desktop.click('[data-rview="preview"]')

  // LLMs menu
  await desktop.click('#llms-btn')
  check(
    'llms menu opens',
    await desktop.$eval('#llms-menu', (el) => !el.classList.contains('hidden')),
    ''
  )
  const mdHref = await desktop.$eval('#llms-menu a[href$=".md"]', (a) =>
    a.getAttribute('href')
  )
  const md = await desktop.request.get(`${BASE}${mdHref}`)
  check(
    'page .md twin',
    md.status() === 200 && (await md.text()).includes('FLUX 3'),
    mdHref ?? ''
  )
  check(
    'llm deep links',
    (await desktop.$$eval(
      '#llms-menu a[href*="claude.ai"], #llms-menu a[href*="chatgpt.com"]',
      (a) => a.length
    )) === 2,
    ''
  )
  await desktop.click('body', { position: { x: 10, y: 400 } })

  // gallery warm start
  await desktop.evaluate(() =>
    document.getElementById('gallery')?.scrollIntoView()
  )
  await desktop.waitForTimeout(300)
  const firstPrompt = await desktop.$eval(
    '[data-use-prompt]',
    (b) => b.dataset.usePrompt
  )
  await desktop.click('[data-use-prompt]')
  await desktop.waitForTimeout(600)
  check(
    'gallery use-prompt',
    (await desktop.inputValue('#pg-prompt')) === firstPrompt,
    ''
  )

  // journey: wall → auth → run → receipt → variations
  await desktop.click('#pg-run')
  await desktop.waitForSelector('#auth-modal:not(.hidden)', { timeout: 4000 })
  check('auth wall', true, '')
  await desktop.click('text=Continue with Google')
  await desktop.waitForTimeout(2900)
  check(
    'meter decrements',
    /4 left/i.test((await desktop.textContent('#free-meter')) ?? ''),
    ''
  )
  await desktop.click('[data-rview="json"]')
  const receipt = (await desktop.textContent('#result-json')) ?? ''
  check(
    'run receipt json',
    receipt.includes('job_id') && receipt.includes('credits_charged'),
    ''
  )
  await desktop.click('[data-rview="preview"]')
  await desktop.click('#queue-vars')
  await desktop.waitForTimeout(3400)
  const varsLoaded = await desktop.$$eval(
    '#var-strip img',
    (imgs) => imgs.filter((i) => !i.classList.contains('hidden')).length
  )
  check('variations queue', varsLoaded === 4, `${varsLoaded}/4`)
  await desktop.waitForSelector('#upgrade-overlay:not(.hidden)', {
    timeout: 4000
  })
  check(
    'upgrade moment at 0 runs',
    /used/i.test((await desktop.textContent('#free-meter')) ?? ''),
    ''
  )
  await desktop.click('#demo-reset')
  await desktop.waitForTimeout(300)
  check(
    'demo reset',
    /5 left/i.test((await desktop.textContent('#free-meter')) ?? ''),
    ''
  )

  // ---------- MOBILE ----------
  const mobile = await (
    await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true
    })
  ).newPage()
  await mobile.goto(`${BASE}/models-v2/minimax-h3`, {
    waitUntil: 'networkidle'
  })
  await mobile.click('#pg-run-mobile')
  await mobile.waitForSelector('#auth-modal:not(.hidden)', { timeout: 4000 })
  check('mobile sticky bar wall', true, '')
  await mobile.click('text=Continue with Google')
  await mobile.waitForTimeout(2900)
  check(
    'mobile journey',
    /4 left/i.test((await mobile.textContent('#free-meter')) ?? ''),
    ''
  )

  await browser.close()

  const pass = results.filter(([, ok]) => ok).length
  console.log(`\n${pass}/${results.length} checks passed against ${BASE}`)
  process.exit(pass === results.length ? 0 : 1)
}

run().catch((e) => {
  console.error('SUITE ERROR:', e.message)
  process.exit(1)
})
