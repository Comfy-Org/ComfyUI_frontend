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
  expect(message).toContain('at startup: transient visible errors')
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

test('unrelated class mutations do no error-selector work', async ({
  page
}) => {
  await page.setContent('<main id="root"><span>content</span></main>')
  const selectorQueries = await page.evaluate(async () => {
    const originalDocumentQuery = document.querySelectorAll.bind(document)
    const originalElementQuery = Element.prototype.querySelectorAll
    const originalMatches = Element.prototype.matches
    let documentQueries = 0
    let elementQueries = 0
    let matches = 0
    document.querySelectorAll = ((selector: string) => {
      documentQueries += 1
      return originalDocumentQuery(selector)
    }) as typeof document.querySelectorAll
    Element.prototype.querySelectorAll = function (selector: string) {
      elementQueries += 1
      return originalElementQuery.call(this, selector)
    }
    Element.prototype.matches = function (this: Element, selector: string) {
      matches += 1
      return originalMatches.call(this, selector)
    } as typeof Element.prototype.matches
    const root = document.getElementById('root')!
    for (let index = 0; index < 1_000; index += 1) {
      root.classList.toggle('connectivity-churn', index % 2 === 0)
      await Promise.resolve()
    }
    await new Promise((resolve) => setTimeout(resolve, 0))
    return { documentQueries, elementQueries, matches }
  })

  expect(selectorQueries).toEqual({
    documentQueries: 0,
    elementQueries: 0,
    matches: 0
  })
  await expect(
    expectNoVisibleErrors(page, 'after DOM churn')
  ).resolves.toBeUndefined()
})
