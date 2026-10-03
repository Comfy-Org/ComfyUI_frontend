import type { BrowserContext, Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'
import { waitForIsland } from './fixtures/islands'
import { emulateWindowsOnArm } from './fixtures/windowsOnArm'

const WINDOWS_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const LINUX_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const FREEBSD_UA =
  'Mozilla/5.0 (X11; FreeBSD amd64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const NVIDIA_RENDERER =
  'ANGLE (NVIDIA, NVIDIA GeForce RTX 5090 (0x00002B85) Direct3D11 vs_5_0 ps_5_0, D3D11)'

// Customer.io CDP request/response shapes (external API — no generated types).
interface CdpEventBody {
  userId?: string
  traits?: { email?: string }
  event?: string
  properties?: { locale?: string; page?: string }
}

interface CdpCapture {
  method: string
  path: string
  body?: CdpEventBody
}

async function routeCdp(
  context: BrowserContext,
  captured: CdpCapture[],
  { unreachable = false } = {}
) {
  await context.route('**/cdp.customer.io/**', async (route) => {
    const request = route.request()
    const method = request.method()
    const path = new URL(request.url()).pathname
    if (unreachable) {
      captured.push({ method, path })
      return route.abort('failed')
    }
    if (path.endsWith('/settings')) {
      captured.push({ method, path })
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          integrations: { 'Customer.io Data Pipelines': {} }
        })
      })
    }
    if (method === 'POST') {
      captured.push({
        method,
        path,
        body: request.postDataJSON() as CdpEventBody
      })
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      })
    }
    captured.push({ method, path })
    return route.abort('blockedbyclient')
  })
}

const HERO_HEADING = /Run on your hardware|在你的硬件上运行/i

function heroLocator(page: Page) {
  return page.locator('section', {
    has: page.getByRole('heading', { name: HERO_HEADING, level: 1 })
  })
}

async function expectAlignedButtons(buttons: Locator) {
  await expect
    .poll(() =>
      buttons.evaluateAll((elements) => {
        const boxes = elements.map((element) => element.getBoundingClientRect())
        if (boxes.length < 2) return Number.POSITIVE_INFINITY
        const heights = boxes.map(({ height }) => height)
        const bottoms = boxes.map(({ bottom }) => bottom)
        return Math.max(
          Math.max(...heights) - Math.min(...heights),
          Math.max(...bottoms) - Math.min(...bottoms)
        )
      })
    )
    .toBeLessThan(0.5)
}

test.describe('Download page @smoke', () => {
  test('has correct title', async ({ page }) => {
    await page.goto('/download')
    await expect(page).toHaveTitle(
      'Download Comfy Desktop - Run AI on Your Hardware'
    )
  })

  test('CloudBannerSection is not shown', async ({ page }) => {
    await page.goto('/download')
    await expect(
      page.getByRole('link', { name: /TRY COMFY CLOUD/i })
    ).toHaveCount(0)
  })

  test('HeroSection heading and subtitle are visible', async ({ page }) => {
    await page.goto('/download')
    await expect(
      page.getByRole('heading', { name: /Run on your hardware/i, level: 1 })
    ).toBeVisible()
    await expect(page.getByText(/The full ComfyUI engine/)).toBeVisible()
  })

  test.describe('Windows desktop', () => {
    test.use({ userAgent: WINDOWS_UA })

    test('HeroSection has download and GitHub buttons', async ({
      context,
      page
    }) => {
      const captured: CdpCapture[] = []
      await routeCdp(context, captured)
      await page.goto('/download')

      const hero = heroLocator(page)
      const downloadBtn = hero.getByRole('link', { name: /DOWNLOAD DESKTOP/i })
      await expect(downloadBtn).toBeVisible()
      await expect(downloadBtn).toHaveAttribute('target', '_blank')
      await expect(downloadBtn).toHaveAttribute(
        'href',
        'https://comfy.org/download/windows/nsis/x64'
      )
      await expect(downloadBtn).toHaveAttribute('data-astro-prefetch', 'false')

      const githubBtn = hero.getByRole('link', { name: /INSTALL FROM GITHUB/i })
      await expect(githubBtn).toBeVisible()
      await expect(githubBtn).toHaveAttribute(
        'href',
        'https://github.com/Comfy-Org/ComfyUI#installing'
      )

      await expectAlignedButtons(downloadBtn.or(githubBtn))

      await expect(hero.getByRole('textbox')).toHaveCount(0)

      await page.waitForLoadState('networkidle')
      expect(captured).toHaveLength(0)
    })

    test('HeroSection links an ARM PC with an NVIDIA GPU to the arm64 installer', async ({
      page
    }) => {
      await emulateWindowsOnArm(page, { gpuRenderer: NVIDIA_RENDERER })
      await page.goto('/download')

      await expect(
        heroLocator(page).getByRole('link', { name: /DOWNLOAD DESKTOP/i })
      ).toHaveAttribute('href', 'https://comfy.org/download/windows/nsis/arm64')
    })

    test('HeroSection opens the installer dropdown from the download button with the keyboard', async ({
      page
    }) => {
      await page.goto('/download')

      const visibleTrigger = page.getByRole('button', {
        name: 'All installers'
      })
      await visibleTrigger.press('ArrowDown')

      const trigger = page.getByRole('button', {
        name: 'All installers',
        includeHidden: true
      })
      await expect(trigger).toHaveAttribute('aria-expanded', 'true')

      const installers = page.getByRole('menu').getByRole('menuitem')
      await expect(installers).toHaveText([
        'Windows x64',
        'Windows ARM64 (NVIDIA only)',
        'macOS (Apple Silicon)',
        'Linux x64 (AppImage)'
      ])
      expect(
        await installers.evaluateAll((items) =>
          items.map((item) => item.getAttribute('data-astro-prefetch'))
        )
      ).toEqual(['false', 'false', 'false', 'false'])

      await page.keyboard.press('Escape')
      await expect(page.getByRole('menu')).toBeHidden()
      await expect(trigger).toBeFocused()
      await expect(
        heroLocator(page).getByRole('link', { name: /DOWNLOAD DESKTOP/i })
      ).toHaveAttribute('href', 'https://comfy.org/download/windows/nsis/x64')
    })
  })

  test.describe('Linux desktop', () => {
    test.use({ userAgent: LINUX_UA })

    test('HeroSection links Linux to the x64 AppImage', async ({ page }) => {
      await page.goto('/download')

      const hero = heroLocator(page)
      const downloadBtn = hero.getByRole('link', { name: /DOWNLOAD DESKTOP/i })

      await expect(downloadBtn).toHaveCount(1)
      await expect(downloadBtn).toBeVisible()
      await expect(downloadBtn).toHaveAttribute(
        'href',
        'https://download.comfy.org/linux/appimage/x64'
      )
      await expect(downloadBtn.locator('img')).toHaveAttribute(
        'src',
        '/icons/os/linux.svg'
      )

      await expect(hero.getByRole('textbox')).toHaveCount(0)
    })
  })

  test.describe('unrecognized desktop', () => {
    test.use({ userAgent: FREEBSD_UA })

    for (const width of [1024, 1280]) {
      test(`HeroSection aligns fallback buttons at ${width}px`, async ({
        page
      }) => {
        await page.setViewportSize({ width, height: 900 })
        await page.goto('/download')

        const hero = heroLocator(page)
        const downloadButtons = hero.getByRole('link', {
          name: /DOWNLOAD DESKTOP/i
        })
        const githubButton = hero.getByRole('link', {
          name: /INSTALL FROM GITHUB/i
        })
        await waitForIsland(page, githubButton)
        await expect(downloadButtons).toHaveCount(2)
        await expect(githubButton).toBeVisible()
        await expectAlignedButtons(downloadButtons.or(githubButton))
      })
    }

    test('HeroSection falls back to both Windows + Mac when UA is unrecognized', async ({
      page
    }) => {
      await page.goto('/download')

      const hero = heroLocator(page)

      const windowsBtn = hero.getByRole('link', {
        name: 'DOWNLOAD DESKTOP Windows x64'
      })
      await expect(windowsBtn).toBeVisible()
      await expect(windowsBtn).toHaveAttribute(
        'href',
        'https://comfy.org/download/windows/nsis/x64'
      )

      const macBtn = hero.getByRole('link', {
        name: 'DOWNLOAD DESKTOP macOS (Apple Silicon)'
      })
      await expect(macBtn).toBeVisible()
      await expect(macBtn).toHaveAttribute(
        'href',
        'https://download.comfy.org/mac/dmg/arm64'
      )

      await expect(
        hero.getByRole('link', { name: /DOWNLOAD DESKTOP/i })
      ).toHaveCount(2)

      await expect(hero.getByRole('textbox')).toHaveCount(0)
    })
  })

  test.describe('iPhone', () => {
    test.use({ userAgent: IPHONE_UA })

    test('HeroSection hides every desktop CTA on mobile', async ({ page }) => {
      await page.goto('/download')
      const hero = heroLocator(page)
      await waitForIsland(
        page,
        hero.getByRole('link', { name: /INSTALL FROM GITHUB/i })
      )

      await expect(
        hero.getByRole('link', { name: /DOWNLOAD DESKTOP/i })
      ).toBeHidden()
      await expect(
        hero.getByRole('button', { name: 'All installers' })
      ).toHaveCount(0)
      await expect(
        hero.getByRole('link', { name: /INSTALL FROM GITHUB/i })
      ).toBeVisible()
    })

    test('mobile email form submits identify then track to Customer.io', async ({
      context,
      page
    }) => {
      const captured: CdpCapture[] = []
      await routeCdp(context, captured)
      await page.goto('/download')
      const hero = heroLocator(page)

      const emailInput = hero.getByRole('textbox', { name: /Email address/i })
      await expect(emailInput).toBeVisible()
      await expect(
        hero.getByRole('link', { name: /INSTALL FROM GITHUB/i })
      ).toBeVisible()

      await emailInput.fill('someone@example.com')
      await hero.getByRole('button', { name: /Send download link/i }).click()

      await expect(
        hero.getByText(/The link is sent to someone@example\.com/i)
      ).toBeVisible()

      const events = () =>
        captured.filter((capture) => capture.method === 'POST')
      const paths = () => events().map((capture) => capture.path)

      await expect
        .poll(() => paths())
        .toEqual(expect.arrayContaining(['/v1/i', '/v1/t']))
      expect(paths().indexOf('/v1/i')).toBeLessThan(paths().indexOf('/v1/t'))

      const identify = events().find((capture) => capture.path === '/v1/i')!
      const track = events().find((capture) => capture.path === '/v1/t')!
      expect(identify.body?.userId).toBe('someone@example.com')
      expect(identify.body?.traits).toMatchObject({
        email: 'someone@example.com'
      })
      expect(track.body?.event).toBe('download_link_requested')
      expect(track.body?.properties).toMatchObject({
        locale: 'en',
        page: '/download'
      })
    })

    test('mobile email form shows error state when Customer.io is unreachable', async ({
      context,
      page
    }) => {
      const captured: CdpCapture[] = []
      await routeCdp(context, captured, { unreachable: true })
      await page.goto('/download')
      const hero = heroLocator(page)

      await hero
        .getByRole('textbox', { name: /Email address/i })
        .fill('someone@example.com')
      await hero.getByRole('button', { name: /Send download link/i }).click()

      await expect(
        hero.getByText(/Something went wrong\. Please try again\./i)
      ).toBeVisible()
      await expect(
        hero.getByRole('button', { name: /Send download link/i })
      ).toBeEnabled()
    })

    test('honeypot submission shows success without any CDP event', async ({
      context,
      page
    }) => {
      const captured: CdpCapture[] = []
      await routeCdp(context, captured)
      await page.goto('/download')
      const hero = heroLocator(page)

      await hero
        .getByRole('textbox', { name: /Email address/i })
        .fill('someone@example.com')
      await hero.locator('input[name="company"]').evaluate((decoy) => {
        const input = decoy as HTMLInputElement
        input.value = 'spam corp'
        input.dispatchEvent(new Event('input', { bubbles: true }))
      })
      await hero.getByRole('button', { name: /Send download link/i }).click()

      await expect(
        hero.getByText(/The link is sent to someone@example\.com/i)
      ).toBeVisible()
      expect(
        captured.filter((capture) => capture.method === 'POST')
      ).toHaveLength(0)
    })

    test('zh-CN download page submits the translated email form with zh-CN locale', async ({
      context,
      page
    }) => {
      const captured: CdpCapture[] = []
      await routeCdp(context, captured)
      await page.goto('/zh-CN/download')
      const hero = heroLocator(page)

      await expect(
        hero.getByRole('heading', { name: '获取下载链接' })
      ).toBeVisible()

      await hero
        .getByRole('textbox', { name: '邮箱地址' })
        .fill('someone@example.com')
      await hero.getByRole('button', { name: '发送下载链接' }).click()

      await expect(
        hero.getByText(/下载链接已发送至 someone@example\.com/)
      ).toBeVisible()

      const track = captured.find((capture) => capture.path === '/v1/t')
      expect(track?.body?.properties).toMatchObject({
        locale: 'zh-CN',
        page: '/zh-CN/download'
      })
    })
  })

  test('ReasonSection heading and reasons are visible', async ({ page }) => {
    await page.goto('/download')
    await expect(
      page.getByRole('heading', { name: /Why.*professionals.*choose/i })
    ).toBeVisible()

    for (const title of [
      'Unlimited',
      'Any model',
      'Your machine',
      'Free. Open Source'
    ]) {
      await expect(page.getByText(title).first()).toBeVisible()
    }
  })

  test('EcoSystemSection heading is visible', async ({ page }) => {
    await page.goto('/download')
    await expect(page.getByText(/An ecosystem that moves faster/)).toBeVisible()
  })

  test('ProductCardsSection has 3 product cards', async ({ page }) => {
    await page.goto('/download')
    const section = page.locator('section', {
      has: page.getByRole('heading', { name: /The AI creation/ })
    })
    const cards = section.locator('a[href]')
    await expect(cards).toHaveCount(3)
  })

  test('ProductCardsSection links to cloud, platform, enterprise', async ({
    page
  }) => {
    await page.goto('/download')
    const section = page.locator('section', {
      has: page.getByRole('heading', { name: /The AI creation/ })
    })

    for (const href of ['/cloud/', '/platform/', '/enterprise/']) {
      await expect(section.locator(`a[href="${href}"]`)).toBeVisible()
    }
  })

  test('FAQSection heading is visible with 8 items', async ({ page }) => {
    await page.goto('/download')
    await expect(page.getByRole('heading', { name: /FAQ/i })).toBeVisible()

    const faqButtons = page.locator('button[aria-controls^="faq-panel-"]')
    await expect(faqButtons).toHaveCount(8)
  })
})

test.describe('FAQ accordion @interaction', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/download')
  })

  test('all FAQs are collapsed by default', async ({ page }) => {
    await expect(
      page.getByText(/A dedicated GPU is strongly recommended/i)
    ).toBeHidden()
    await expect(page.getByText(/ComfyUI is lightweight/i)).toBeHidden()
  })

  test('clicking a collapsed FAQ expands it', async ({ page }) => {
    const firstQuestion = page.getByRole('button', {
      name: /Do I need a GPU/i
    })
    // aria-expanded="false" is already in the server-rendered markup, so it
    // cannot tell us whether Vue has taken over. Gate on the island instead.
    await waitForIsland(page, firstQuestion)
    await expect(firstQuestion).toHaveAttribute('aria-expanded', 'false')
    await firstQuestion.click()

    await expect(
      page.getByText(/A dedicated GPU is strongly recommended/i)
    ).toBeVisible()
  })

  test('clicking an expanded FAQ collapses it again', async ({ page }) => {
    const firstQuestion = page.getByRole('button', {
      name: /Do I need a GPU/i
    })
    // aria-expanded="false" is already in the server-rendered markup, so it
    // cannot tell us whether Vue has taken over. Gate on the island instead.
    await waitForIsland(page, firstQuestion)
    await expect(firstQuestion).toHaveAttribute('aria-expanded', 'false')

    await firstQuestion.click()
    await expect(firstQuestion).toHaveAttribute('aria-expanded', 'true')
    await expect(
      page.getByText(/A dedicated GPU is strongly recommended/i)
    ).toBeVisible()

    await firstQuestion.click()
    await expect(firstQuestion).toHaveAttribute('aria-expanded', 'false')
    await expect(
      page.getByText(/A dedicated GPU is strongly recommended/i)
    ).toBeHidden()
  })
})

test.describe('Download page mobile @mobile', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/download')
  })

  test('CloudBannerSection is not shown', async ({ page }) => {
    await expect(page.getByText(/Need more power/)).toHaveCount(0)
  })

  test('HeroSection heading is visible', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /Run on your hardware/i, level: 1 })
    ).toBeVisible()
  })

  test.describe('Windows buttons', () => {
    test.use({ userAgent: WINDOWS_UA, viewport: { width: 320, height: 844 } })

    test('installer menu stays usable within a narrow viewport', async ({
      page
    }) => {
      const trigger = heroLocator(page).getByRole('button', {
        name: 'All installers'
      })
      await expect(trigger).toBeInViewport({ ratio: 1 })
      await trigger.click()
      await expect(page.getByRole('menu')).toBeInViewport({ ratio: 1 })
    })

    test('download buttons are stacked vertically', async ({ page }) => {
      const hero = heroLocator(page)
      const downloadBtn = hero.getByRole('link', { name: /DOWNLOAD DESKTOP/i })
      const githubBtn = hero.getByRole('link', {
        name: /INSTALL FROM GITHUB/i
      })

      await expect(downloadBtn).toBeVisible()
      await expect(githubBtn).toBeVisible()

      await expect
        .poll(async () => {
          const downloadBox = await downloadBtn.boundingBox()
          const githubBox = await githubBtn.boundingBox()
          if (!downloadBox || !githubBox) return false
          return githubBox.y > downloadBox.y
        })
        .toBe(true)
    })
  })
})
