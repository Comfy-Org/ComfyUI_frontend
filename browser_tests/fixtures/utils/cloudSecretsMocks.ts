import type { Page, Route } from '@playwright/test'

import type { RemoteConfig } from '@/platform/remoteConfig/types'

import type { SettingDialog } from '@e2e/fixtures/components/SettingDialog'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

/**
 * Shared scaffolding for the cloud user-secrets (API keys) E2E, alongside the
 * sibling cloud mocks (`cloudBillingMocks`, `workspaceMocks`): the stateful
 * in-memory `/secrets` backend and the open-the-Secrets-panel helper, so the
 * spec files hold only the behavioral flow.
 */

// `/api/features` is the remote-config source. Enabling user secrets is what
// surfaces the Secrets settings panel for a signed-in user.
export const SECRETS_BOOT_FEATURES = {
  user_secrets_enabled: true
} satisfies RemoteConfig

// TutorialCompleted suppresses the new-user template browser, whose modal
// overlay (z-1700) would otherwise intercept clicks on the settings dialog.
export const SECRETS_BOOT_SETTINGS = { 'Comfy.TutorialCompleted': true }

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
export async function mockSecretsBackend(
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
 * are not racing the panel's on-mount fetches. Returns the dialog root locator
 * for scoping the caller's assertions.
 */
export async function openSecretsPanel(settingDialog: SettingDialog) {
  const { page } = settingDialog
  await settingDialog.open()

  const providersResolved = page.waitForResponse((r) =>
    r.url().includes('/api/secrets/providers')
  )
  const listResolved = page.waitForResponse(
    (r) =>
      /\/api\/secrets(\?|$)/.test(r.url()) && r.request().method() === 'GET'
  )

  await settingDialog.category('Secrets').click()

  await Promise.all([providersResolved, listResolved])
  return settingDialog.root
}
