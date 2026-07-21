import { expect } from '@playwright/test'

import { ComfyPage, comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { bootCloud, mockCloudBoot } from '@e2e/fixtures/utils/cloudBootMocks'
import {
  SECRETS_BOOT_FEATURES,
  SECRETS_BOOT_SETTINGS,
  mockSecretsBackend,
  openSecretsPanel
} from '@e2e/fixtures/utils/cloudSecretsMocks'

/**
 * End-to-end coverage for the user-secrets (API keys) surface in the cloud app:
 * add a provider key, see it listed, delete it — the full CRUD round-trip —
 * plus the entitlement contract that a non-entitled account never sees the
 * gated providers.
 *
 * Drives a raw `page` against fully-mocked endpoints (the `comfyPage` fixture
 * would reach the OSS devtools backend during setup); `mockCloudBoot` +
 * `bootCloud` boot the app signed-in, and `mockSecretsBackend` layers a
 * stateful in-memory `/secrets` backend on top so the flow is deterministic
 * and never touches a real server. A bare `ComfyPage` (constructed, never
 * `setup()`) supplies the shared `SettingDialog` page object without the
 * backend-touching fixture setup.
 */
const APP_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'

// The plaintext key a user types in. It must be sent on create but NEVER echoed
// back by the API or rendered anywhere in the UI.
const RUNWAY_KEY_VALUE = 'sk-runway-do-not-echo-0xDEADBEEF'

test.describe('Cloud user secrets (API keys)', { tag: '@cloud' }, () => {
  test('an entitled account can add, list, and delete a provider key', async ({
    page,
    request
  }) => {
    test.slow()

    await mockCloudBoot(page, {
      features: SECRETS_BOOT_FEATURES,
      settings: SECRETS_BOOT_SETTINGS
    })
    await bootCloud(page)
    const backend = await mockSecretsBackend(page, ['runway', 'gemini'])

    await page.goto(APP_URL)
    await page.waitForFunction(() => !!window.app?.extensionManager, null, {
      timeout: 45_000
    })

    const comfyPage = new ComfyPage(page, request)
    const settingsDialog = await openSecretsPanel(comfyPage.settingDialog)

    // Empty state before anything is added.
    await expect(settingsDialog.getByText(/No secrets stored/)).toBeVisible()

    // --- ADD -------------------------------------------------------------
    await settingsDialog.getByRole('button', { name: 'Add Secret' }).click()

    const formDialog = page
      .getByRole('dialog')
      .filter({ hasText: 'Secret Value' })
    await expect(formDialog).toBeVisible()

    // Pick the entitled Runway provider from the server-driven dropdown.
    await formDialog.locator('#secret-provider').click()
    await page.getByRole('option', { name: 'Runway' }).click()

    await formDialog.locator('#secret-name').fill('My Runway Key')
    await formDialog.locator('input[type="password"]').fill(RUNWAY_KEY_VALUE)

    await formDialog.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(formDialog).toBeHidden()

    // --- LIST ------------------------------------------------------------
    await expect(settingsDialog.getByText('My Runway Key')).toBeVisible()
    await expect(settingsDialog.getByText(/No secrets stored/)).toBeHidden()

    // The create request carried the plaintext value + provider...
    expect(backend.createRequests).toHaveLength(1)
    expect(backend.createRequests[0]).toMatchObject({
      name: 'My Runway Key',
      provider: 'runway',
      secret_value: RUNWAY_KEY_VALUE
    })
    // ...but the value must never be echoed back into the list — the API
    // response carries metadata only, so nothing should render it as text.
    await expect(page.getByText(RUNWAY_KEY_VALUE)).toHaveCount(0)
    // `getByText` only sees text nodes; a value reflected into an `<input>` or
    // masked field would slip past it, so assert no field carries it either.
    // The list has already settled above, so this is a single immediate
    // assertion — a poll-until-false could mask a value that briefly echoed
    // into a field and then cleared within the polling window.
    const secretEchoedInField = await page
      .locator('input, textarea')
      .evaluateAll(
        (fields, value) =>
          fields.some(
            (field) =>
              (field as HTMLInputElement | HTMLTextAreaElement).value === value
          ),
        RUNWAY_KEY_VALUE
      )
    expect(secretEchoedInField).toBe(false)

    // --- DELETE ----------------------------------------------------------
    await settingsDialog
      .getByRole('button', { name: 'Delete', exact: true })
      .click()

    const confirmDialog = page
      .getByRole('dialog')
      .filter({ hasText: 'Delete Secret' })
    await confirmDialog
      .getByRole('button', { name: 'Delete', exact: true })
      .click()

    await expect(settingsDialog.getByText('My Runway Key')).toBeHidden()
    await expect(settingsDialog.getByText(/No secrets stored/)).toBeVisible()
    expect(backend.store).toHaveLength(0)
  })

  test('a non-entitled account never sees the gated providers', async ({
    page,
    request
  }) => {
    test.slow()

    await mockCloudBoot(page, {
      features: SECRETS_BOOT_FEATURES,
      settings: SECRETS_BOOT_SETTINGS
    })
    await bootCloud(page)
    // Non-entitled: the server omits runway/gemini from the allowlist.
    await mockSecretsBackend(page, [])

    await page.goto(APP_URL)
    await page.waitForFunction(() => !!window.app?.extensionManager, null, {
      timeout: 45_000
    })

    const comfyPage = new ComfyPage(page, request)
    const settingsDialog = await openSecretsPanel(comfyPage.settingDialog)
    await expect(settingsDialog.getByText(/No secrets stored/)).toBeVisible()

    // The add form opens, but its provider dropdown is empty — the gated
    // providers must not appear anywhere.
    await settingsDialog.getByRole('button', { name: 'Add Secret' }).click()
    const formDialog = page
      .getByRole('dialog')
      .filter({ hasText: 'Secret Value' })
    await expect(formDialog).toBeVisible()

    await formDialog.locator('#secret-provider').click()
    // Anchor on the opened listbox so the absence assertions below can't pass
    // vacuously against a dropdown that never opened.
    const providerListbox = page.getByRole('listbox')
    await expect(providerListbox).toBeVisible()
    // An empty allowlist must yield an empty dropdown. Asserting zero options
    // (not just runway/gemini absent) also rejects the fetch-failure fallback,
    // where `availableProviders` is null and the default providers would show.
    await expect(providerListbox.getByRole('option')).toHaveCount(0)
  })
})
