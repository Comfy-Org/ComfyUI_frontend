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
  await page.setContent('<div id="t">momentary</div>')
  await page.evaluate(() => {
    const toast = document.getElementById('t')!
    toast.classList.add('p-toast-message-error')
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

test('unrelated mutations do not rescan the full document', async ({
  page
}) => {
  await page.setContent('<main id="root"></main>')
  const fullDocumentQueries = await page.evaluate(async () => {
    const original = document.querySelectorAll.bind(document)
    let calls = 0
    document.querySelectorAll = ((selector: string) => {
      calls += 1
      return original(selector)
    }) as typeof document.querySelectorAll
    const root = document.getElementById('root')!
    for (let index = 0; index < 1_000; index += 1) {
      const child = document.createElement('span')
      root.append(child)
      child.dataset.index = String(index)
      child.textContent = String(index)
      await Promise.resolve()
    }
    await new Promise((resolve) => setTimeout(resolve, 0))
    return calls
  })

  expect(fullDocumentQueries).toBe(0)
  await expect(
    expectNoVisibleErrors(page, 'after DOM churn')
  ).resolves.toBeUndefined()
})
