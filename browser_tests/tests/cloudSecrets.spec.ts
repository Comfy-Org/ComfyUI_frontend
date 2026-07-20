import { expect } from '@playwright/test'
import type { Page, Route } from '@playwright/test'

import type { RemoteConfig } from '@/platform/remoteConfig/types'

import {
  cloudAppFixture as test,
  waitForCloudApp
} from '@e2e/fixtures/cloudAppFixture'
import { bootCloud, mockCloudBoot } from '@e2e/fixtures/utils/cloudBootMocks'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

/**
 * End-to-end coverage for the user-secrets (API keys) surface in the cloud app:
 * add a provider key, see it listed, delete it — the full CRUD round-trip —
 * plus the entitlement contract that a non-entitled account never sees the
 * gated providers.
 *
 * Drives a raw `page` against fully-mocked endpoints (the `comfyPage` fixture
 * would reach the OSS devtools backend during setup); `mockCloudBoot` +
 * `bootCloud` boot the app signed-in, and this spec layers a stateful in-memory
 * `/secrets` backend on top so the flow is deterministic and never touches a
 * real server.
 */
const APP_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'

// `/api/features` is the remote-config source. Enabling user secrets is what
// surfaces the Secrets settings panel for a signed-in user.
const BOOT_FEATURES = {
  user_secrets_enabled: true
} satisfies RemoteConfig

// TutorialCompleted suppresses the new-user template browser, whose modal
// overlay (z-1700) would otherwise intercept clicks on the settings dialog.
const BOOT_SETTINGS = { 'Comfy.TutorialCompleted': true }

// The plaintext key a user types in. It must be sent on create but NEVER echoed
// back by the API or rendered anywhere in the UI.
const RUNWAY_KEY_VALUE = 'sk-runway-do-not-echo-0xDEADBEEF'

interface SecretRecord {
  id: string
  name: string
  provider?: string
  created_at: string
  updated_at: string
  last_used_at?: string
}

interface CreateCapture {
  name?: string
  provider?: string
  secret_value?: string
}

interface SecretsBackend {
  /** Bodies received by POST /secrets, in order — for asserting what was sent. */
  createRequests: CreateCapture[]
  /** Current server-side store — for asserting delete actually removed a row. */
  store: SecretRecord[]
}

/**
 * Stateful mock of the ingest `/secrets` surface. A single route handler
 * branches on path + method so registration order can never make a specific
 * path (`/secrets/providers`, `/secrets/:id`) lose to the collection glob.
 *
 * `providerIds` models entitlement: an entitled account sees runway/gemini,
 * a non-entitled account gets an empty list (the server omits them).
 */
async function mockSecretsBackend(
  page: Page,
  providerIds: string[]
): Promise<SecretsBackend> {
  const backend: SecretsBackend = { createRequests: [], store: [] }
  let idSeq = 0

  const respondList = (route: Route) =>
    route.fulfill(jsonRoute({ data: backend.store }))

  await page.route('**/api/secrets**', async (route) => {
    const request = route.request()
    const { pathname } = new URL(request.url())
    const method = request.method()

    // The glob `**/api/secrets**` also matches the panel's own lazy-loaded
    // source module (`/src/platform/secrets/api/secretsApi.ts`), whose path
    // contains the `/api/secrets` substring. Fulfilling that dev-server module
    // request with JSON breaks the dynamic import and the panel never mounts.
    // Anchor to the start of the pathname so only genuine `/api/secrets…` API
    // routes are handled; everything else falls through to the real Vite server.
    if (!/^\/api\/secrets(\/|$)/.test(pathname)) {
      return route.continue()
    }

    // GET /secrets/providers — the entitlement-gated provider allowlist.
    if (pathname.endsWith('/secrets/providers')) {
      return route.fulfill(
        jsonRoute({ data: providerIds.map((id) => ({ id })) })
      )
    }

    // /secrets/:id — item routes (only DELETE is exercised by this flow).
    const itemMatch = pathname.match(/\/secrets\/([^/]+)$/)
    if (itemMatch) {
      const id = itemMatch[1]
      if (method === 'DELETE') {
        backend.store = backend.store.filter((s) => s.id !== id)
        return route.fulfill({ status: 204, body: '' })
      }
      return respondList(route)
    }

    // /secrets — collection routes.
    if (method === 'POST') {
      const body = (request.postDataJSON() ?? {}) as CreateCapture
      backend.createRequests.push(body)
      idSeq += 1
      const created: SecretRecord = {
        id: `00000000-0000-4000-8000-${String(idSeq).padStart(12, '0')}`,
        name: body.name ?? '',
        provider: body.provider,
        created_at: '2026-07-08T00:00:00Z',
        updated_at: '2026-07-08T00:00:00Z'
      }
      backend.store.push(created)
      // Response echoes metadata ONLY — the schema has no secret_value field.
      return route.fulfill(jsonRoute(created))
    }

    // GET /secrets (list).
    return respondList(route)
  })

  return backend
}

/**
 * Open the settings dialog and land on the Secrets panel, waiting for both the
 * provider allowlist and the secret list to resolve so subsequent assertions
 * are not racing the panel's on-mount fetches.
 */
async function openSecretsPanel(page: Page) {
  const settingsDialog = page.getByTestId('settings-dialog')

  await page.evaluate(() => {
    const app = window.app
    if (!app) throw new Error('window.app is not available')
    return app.extensionManager.command.execute('Comfy.ShowSettingsDialog')
  })
  await settingsDialog.waitFor({ state: 'visible' })

  const providersResolved = page.waitForResponse((r) =>
    r.url().includes('/api/secrets/providers')
  )
  const listResolved = page.waitForResponse(
    (r) =>
      /\/api\/secrets(\?|$)/.test(r.url()) && r.request().method() === 'GET'
  )

  await settingsDialog
    .locator('nav')
    .getByRole('button', { name: 'Secrets' })
    .click()

  await Promise.all([providersResolved, listResolved])
  return settingsDialog
}

test.describe('Cloud user secrets (API keys)', { tag: '@cloud' }, () => {
  test('an entitled account can add, list, and delete a provider key', async ({
    page
  }) => {
    await mockCloudBoot(page, {
      features: BOOT_FEATURES,
      settings: BOOT_SETTINGS
    })
    await bootCloud(page)
    const backend = await mockSecretsBackend(page, ['runway', 'gemini'])

    await page.goto(APP_URL)
    await waitForCloudApp(page)

    const settingsDialog = await openSecretsPanel(page)

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
    page
  }) => {
    await mockCloudBoot(page, {
      features: BOOT_FEATURES,
      settings: BOOT_SETTINGS
    })
    await bootCloud(page)
    // Non-entitled: the server omits runway/gemini from the allowlist.
    await mockSecretsBackend(page, [])

    await page.goto(APP_URL)
    await waitForCloudApp(page)

    const settingsDialog = await openSecretsPanel(page)
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
