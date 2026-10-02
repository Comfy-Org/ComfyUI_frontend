import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'
import { observeHubNavigation } from './fixtures/hubNavigation'
import { waitForIsland } from './fixtures/islands'
import { stubWorkshopFlags } from './fixtures/workshopFlags'

test.beforeEach(async ({ context }) => {
  await stubWorkshopFlags(context, {
    'workshop-enabled': true,
    'workshop-auth': false,
    'workshop-workflows-enabled': true,
    'workshop-apps-enabled': true
  })
})

const SECTIONS = {
  explore: {
    space: 'explore',
    path: '/hub/',
    heading: 'Find your starting point.'
  },
  apps: { space: 'create', path: '/hub/apps/', heading: 'ComfyUI apps' },
  workflows: {
    space: 'customize',
    path: '/hub/workflows/',
    heading: 'ComfyUI workflows'
  },
  models: { space: 'build', path: '/hub/models/', heading: 'ComfyUI models' }
} as const

type HubSection = keyof typeof SECTIONS

function spaceLink(section: HubSection) {
  return `hub-space-${SECTIONS[section].space}`
}

async function centreOf(page: Page, testId: string) {
  const box = await page.getByTestId(testId).boundingBox()
  if (!box) throw new Error(`${testId} has no box to measure`)
  return box.x + box.width / 2
}

function expectMarkerOver(page: Page, section: HubSection) {
  return expect(async () =>
    expect(
      Math.abs(
        (await centreOf(page, 'hub-space-marker')) -
          (await centreOf(page, spaceLink(section)))
      )
    ).toBeLessThan(1)
  ).toPass()
}

async function navigateObservingMotion(page: Page, to: HubSection) {
  const motion = await page.evaluateHandle((destination) => {
    const observed = { crossfade: false, marker: false }
    const finished = new Promise<void>((resolve) => {
      document.addEventListener(
        'astro:before-swap',
        (event) => {
          void event.viewTransition.finished.then(resolve)
        },
        { once: true }
      )
    })
    let frame: number
    function record() {
      observed.crossfade ||= [
        '::view-transition-old(root)',
        '::view-transition-new(root)'
      ].every((pseudo) => isFading(document.documentElement, pseudo))
      observed.marker ||=
        location.pathname === destination &&
        document
          .getAnimations()
          .some(
            (animation) =>
              animation.effect instanceof KeyframeEffect &&
              animation.effect.pseudoElement ===
                '::view-transition-group(hub-space-marker)'
          )
      frame = requestAnimationFrame(record)
    }
    function isFading(element: Element, pseudo?: string) {
      const opacity = Number(getComputedStyle(element, pseudo).opacity)
      return opacity > 0 && opacity < 1
    }
    record()
    return {
      observed,
      finished,
      stop() {
        cancelAnimationFrame(frame)
      }
    }
  }, SECTIONS[to].path)
  try {
    await page.getByTestId(spaceLink(to)).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      SECTIONS[to].heading
    )
    await motion.evaluate((probe) => probe.finished)
    return await motion.evaluate((probe) => probe.observed)
  } finally {
    await motion.evaluate((probe) => probe.stop())
    await motion.dispose()
  }
}

for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  for (const { from, to, copy } of [
    {
      from: 'models',
      to: 'workflows',
      copy: 'Turn your ideas into finished results'
    },
    { from: 'explore', to: 'apps', copy: 'Take on bigger ideas with apps' },
    {
      from: 'apps',
      to: 'explore',
      copy: 'Start from a use case'
    }
  ] as const) {
    test(`the space marker travels from ${from} to ${to} under ${reducedMotion} motion`, async ({
      page
    }) => {
      await page.emulateMedia({ reducedMotion })
      await page.goto(SECTIONS[from].path)
      await expect(page.getByTestId(spaceLink(from))).toHaveAttribute(
        'aria-current',
        'page'
      )
      // A named transition can animate a marker that never moves, so the
      // positions either side of the navigation are what prove it travelled.
      await expectMarkerOver(page, from)
      const departed = await centreOf(page, 'hub-space-marker')

      const observed = await navigateObservingMotion(page, to)

      await expect(page.getByTestId('workshop-hero')).toContainText(copy)
      await expectMarkerOver(page, to)
      expect(
        Math.abs((await centreOf(page, 'hub-space-marker')) - departed)
      ).toBeGreaterThan(1)
      expect(observed).toEqual({
        crossfade: reducedMotion === 'no-preference',
        marker: reducedMotion === 'no-preference'
      })
    })
  }
}

for (const width of [1440, 390]) {
  test.describe(`Hub navigation at ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } })

    for (const { from, to } of [
      { from: 'explore', to: 'models' },
      { from: 'models', to: 'workflows' },
      { from: 'workflows', to: 'apps' },
      { from: 'apps', to: 'explore' }
    ] as const) {
      test(`${from} to ${to} keeps the page steady, including Back and Forward`, async ({
        page
      }) => {
        const errors: string[] = []
        page.on('pageerror', (error) => errors.push(error.message))
        await page.goto(SECTIONS[from].path)
        await expect(page.getByTestId(spaceLink(from))).toHaveAttribute(
          'aria-current',
          'page'
        )
        await page.getByRole('button', { name: 'Close', exact: true }).click()
        await expect(
          page.getByText('Comfy Agent can now build workflows inside ComfyUI.')
        ).toBeHidden()
        await expect(page.getByTestId('workshop-hero')).toBeVisible()
        const observation = await observeHubNavigation(page)

        await page.getByTestId(spaceLink(to)).click()
        await expect(page).toHaveURL(SECTIONS[to].path)
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(
          SECTIONS[to].heading
        )
        await expect(page.getByTestId(spaceLink(to))).toHaveAttribute(
          'aria-current',
          'page'
        )
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
          'href',
          `https://comfy.org${SECTIONS[to].path}`
        )

        await page.goBack()
        await expect(page).toHaveURL(SECTIONS[from].path)
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(
          SECTIONS[from].heading
        )
        await expect(page.getByTestId(spaceLink(from))).toHaveAttribute(
          'aria-current',
          'page'
        )
        await page.goForward()
        await expect(page).toHaveURL(SECTIONS[to].path)
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(
          SECTIONS[to].heading
        )
        await expect(page.getByTestId(spaceLink(to))).toHaveAttribute(
          'aria-current',
          'page'
        )

        const { frames, ...changes } = await observation.finish()
        expect(frames).toBeGreaterThan(0)
        expect(changes).toEqual({
          bannerReappeared: false,
          spacesDisappeared: false,
          loaderAppeared: false,
          headerMoved: false,
          spacesMoved: false
        })
        expect(errors).toEqual([])
        await page.reload()
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(
          SECTIONS[to].heading
        )
        await expect(page.getByTestId(spaceLink(to))).toHaveAttribute(
          'aria-current',
          'page'
        )
      })
    }
  })
}

for (const { section, destination, query, filter } of [
  {
    section: 'models' as const,
    destination: 'workflows' as const,
    query: 'kling',
    filter: 'useCase=generate-images'
  },
  {
    section: 'workflows' as const,
    destination: 'models' as const,
    query: 'material',
    filter: 'category=product'
  }
]) {
  test(`the active ${section} tab resets its URL filters, including history`, async ({
    page
  }) => {
    const filtered = `/hub/${section}/?q=${query}&${filter}`
    await page.goto(filtered)
    const search = page.getByTestId('workshop-search')
    const count = page.getByTestId('workshop-filter-count')
    await expect(search).toHaveValue(query)
    await expect(count).toHaveText('1')
    await page.getByTestId(spaceLink(section)).click()
    await expect(page).toHaveURL(`/hub/${section}/`)
    await expect(search).toHaveValue('')
    await expect(count).toHaveCount(0)
    await page.goBack()
    await expect(page).toHaveURL(filtered)
    await expect(search).toHaveValue(query)
    await expect(count).toHaveText('1')
    await page.goForward()
    await expect(page).toHaveURL(`/hub/${section}/`)
    await expect(search).toHaveValue('')
    await expect(count).toHaveCount(0)
  })

  test(`switching from filtered ${section} does not carry filters to ${destination}`, async ({
    page
  }) => {
    const filtered = `/hub/${section}/?q=${query}&${filter}`
    const search = page.getByTestId('workshop-search')
    const count = page.getByTestId('workshop-filter-count')
    await page.goto(filtered)
    await expect(search).toHaveValue(query)
    await expect(count).toHaveText('1')
    await page.getByTestId(spaceLink(destination)).click()
    await expect(page).toHaveURL(`/hub/${destination}/`)
    await expect(search).toHaveValue('')
    await expect(count).toHaveCount(0)
    await page.goBack()
    await expect(page).toHaveURL(filtered)
    await expect(search).toHaveValue(query)
    await expect(count).toHaveText('1')
    await page.goForward()
    await expect(page).toHaveURL(`/hub/${destination}/`)
    await expect(search).toHaveValue('')
    await expect(count).toHaveCount(0)
  })
}

test('the mobile menu closes and reopens after its Explore the Hub link navigates', async ({
  page
}) => {
  await page.setViewportSize({ width: 390, height: 900 })
  await page.goto('/hub/workflows/')
  const toggle = page.getByRole('button', { name: 'Toggle menu' })
  await waitForIsland(page, toggle)
  await toggle.click()
  const menu = page.getByRole('dialog', { name: 'Menu' })
  await expect(menu).toBeVisible()
  await menu.getByRole('button', { name: /^Products/ }).click()
  await menu.getByRole('link', { name: 'Explore the Hub' }).click()
  await expect(page).toHaveURL('/hub/')
  await expect(menu).toBeHidden()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Find your starting point.'
  )
  await waitForIsland(page, toggle)
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await toggle.click()
  await expect(menu).toBeVisible()
  await page.getByRole('button', { name: 'Close' }).click()
  await expect(menu).toBeHidden()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})

test('keeps the current listing visible until a cold destination is ready', async ({
  page,
  context
}) => {
  const requested = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  await context.route('**/_website/WorkflowCatalogue.*.js', async (route) => {
    requested.resolve()
    await release.promise
    await route.fallback()
  })
  await page.goto('/hub/models/')
  await expect(page.getByTestId('hub-space-build')).toHaveAttribute(
    'aria-current',
    'page'
  )
  await page.getByTestId('hub-space-customize').click()
  await requested.promise
  try {
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'ComfyUI models'
    )
    await expect(page.getByTestId('hub-space-build')).toHaveAttribute(
      'aria-current',
      'page'
    )
    await expect(page.getByTestId('workshop-sections')).toBeVisible()
  } finally {
    release.resolve()
  }
  await expect(page).toHaveURL('/hub/workflows/')
  await expect(page.getByTestId('workflow-catalogue')).toBeVisible()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'ComfyUI workflows'
  )
})
