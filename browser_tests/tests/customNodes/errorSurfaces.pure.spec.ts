import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import {
  expectNoVisibleErrors,
  trackVisibleErrors
} from '@e2e/fixtures/utils/errorSurfaces'

test.beforeEach(async ({ page }) => {
  await trackVisibleErrors(page)
})

test('a clean page passes every surface', async ({ page }) => {
  await page.setContent('<main>no errors here</main>')
  await expect(expectNoVisibleErrors(page, 'clean')).resolves.toBeUndefined()
})

test('a persistent error toast fails carrying its visible text', async ({
  page
}) => {
  await page.setContent(
    '<div class="p-toast-message-error">Failed to load workspace: HTTP 502</div>' +
      '<div class="p-toast-message-error">Settings seed rejected</div>'
  )
  const failure = await expectNoVisibleErrors(page, 'at startup').then(
    () => undefined,
    (error: unknown) => error
  )
  expect(failure).toBeInstanceOf(Error)
  const message = (failure as Error).message
  expect(message).toContain('errorToasts')
  expect(message).toContain('Failed to load workspace: HTTP 502')
  expect(message).toContain('Settings seed rejected')
})

test('a closed page fails immediately with the real reason, not the sentinel', async ({
  page
}) => {
  await page.setContent('<main></main>')
  await page.close()
  const failure = await expectNoVisibleErrors(page, 'after close').then(
    () => undefined,
    (error: unknown) => error
  )
  expect(String(failure)).toMatch(/has been closed/)
  expect(String(failure)).not.toContain('unreadable mid-poll')
})

test('a visible error toast fails after it clears before the assertion', async ({
  page
}) => {
  await page.setContent('<main id="root"></main>')
  await page.evaluate(() => {
    const toast = document.createElement('div')
    toast.id = 't'
    toast.className = 'p-toast-message-error'
    toast.textContent = 'momentary'
    document.getElementById('root')!.append(toast)
    setTimeout(() => toast.remove(), 800)
  })
  await expect(page.locator('#t')).toHaveCount(0)
  const failure = await expectNoVisibleErrors(page, 'transient').then(
    () => undefined,
    (error: unknown) => error
  )
  expect(failure).toBeInstanceOf(Error)
  expect(String(failure)).toContain('momentary')
})

test('an error class added after insertion fails after it clears', async ({
  page
}) => {
  await page.setContent('<div id="t">late error</div>')
  await page.evaluate(() => {
    const toast = document.getElementById('t')!
    toast.classList.add('p-toast-message-error')
    setTimeout(() => toast.classList.remove('p-toast-message-error'), 800)
  })
  await expect(page.locator('#t')).not.toHaveClass('p-toast-message-error')
  const failure = await expectNoVisibleErrors(page, 'class-added').then(
    () => undefined,
    (error: unknown) => error
  )
  expect(failure).toBeInstanceOf(Error)
  expect(String(failure)).toContain('late error')
})

test('a hidden error fails when an ancestor mutation reveals it', async ({
  page
}) => {
  await page.setContent(
    '<section id="container" hidden>' +
      '<div class="p-toast-message-error">revealed error</div>' +
      '</section>'
  )
  await page.evaluate(() => {
    document.getElementById('container')!.removeAttribute('hidden')
  })
  const failure = await expectNoVisibleErrors(page, 'revealed').then(
    () => undefined,
    (error: unknown) => error
  )
  expect(failure).toBeInstanceOf(Error)
  expect(String(failure)).toContain('revealed error')
})

test('DOM churn is sampled at a fixed rate, not per mutation', async ({
  page
}) => {
  const probe = await page.context().newPage()
  try {
    const clockStart = new Date('2026-08-19T00:00:00Z')
    await probe.clock.install({ time: clockStart })
    await probe.clock.pauseAt(clockStart)
    await probe.setContent('<main id="root"></main>')
    await probe.evaluate(() => {
      const target = window as Window &
        typeof globalThis & { __recorderQueries?: number }
      const originalDocumentQuery = document.querySelectorAll.bind(document)
      target.__recorderQueries = 0
      document.querySelectorAll = ((selector: string) => {
        target.__recorderQueries! += 1
        return originalDocumentQuery(selector)
      }) as typeof document.querySelectorAll
    })
    await trackVisibleErrors(probe)

    const state = () =>
      probe.evaluate(
        () =>
          (
            window as Window &
              typeof globalThis & { __recorderQueries?: number }
          ).__recorderQueries
      )
    await expect(state()).resolves.toBe(1)

    await probe.evaluate(() => {
      let parent = document.getElementById('root')!
      for (let index = 0; index < 1_000; index += 1) {
        parent.classList.toggle('connectivity-churn', index % 2 === 0)
        const child = document.createElement('div')
        parent.append(child)
        parent = child
      }
    })
    await expect(state()).resolves.toBe(1)
    await probe.clock.runFor(99)
    await expect(state()).resolves.toBe(1)
    await probe.clock.runFor(1)
    await expect(state()).resolves.toBe(2)
    await expect(
      expectNoVisibleErrors(probe, 'after DOM churn')
    ).resolves.toBeUndefined()
  } finally {
    await probe.close()
  }
})
