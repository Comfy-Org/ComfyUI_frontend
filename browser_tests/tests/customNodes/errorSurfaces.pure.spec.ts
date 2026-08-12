import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { expectNoVisibleErrors } from '@e2e/fixtures/utils/errorSurfaces'

// expectNoVisibleErrors is the single enforcement point for every
// user-visible error surface; these pin its three behaviors: clean passes,
// a persistent surface fails NAMING its visible text (the cloud gate's
// dominant failure class was 12x "at startup: errorToasts" with no text -
// run 31541231667), and toHaveCount(0)'s transient tolerance is preserved.
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
  // The class-stable context label the detection proof greps for...
  expect(message).toContain('at startup: errorToasts')
  // ...and the diagnostic the bare count never carried.
  expect(message).toContain('Failed to load workspace: HTTP 502')
  expect(message).toContain('Settings seed rejected')
})

test('a transient toast that clears within the window still passes', async ({
  page
}) => {
  await page.setContent(
    '<div id="t" class="p-toast-message-error">momentary</div>' +
      '<script>setTimeout(() => document.getElementById("t").remove(), 800)</script>'
  )
  await expect(
    expectNoVisibleErrors(page, 'transient')
  ).resolves.toBeUndefined()
})
