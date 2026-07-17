import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import type { ListAssetsResponse } from '@comfyorg/ingest-types'

import type { PartnerNodePolicyResponse } from '@/platform/workspace/api/partnerNodePolicyApi'
import type { RemoteConfig } from '@/platform/remoteConfig/types'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { WORKSPACE_FEATURE_FLAG } from '@e2e/fixtures/data/cloudWorkspace'
import { CloudWorkspaceMockHelper } from '@e2e/fixtures/helpers/CloudWorkspaceMockHelper'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

const APP_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'

function partnerNode(
  name: string,
  displayName: string,
  provider: string
): ComfyNodeDef {
  return {
    name,
    display_name: displayName,
    category: `partner/image/${provider}`,
    python_module: `comfy_api_nodes.${provider.toLocaleLowerCase()}`,
    description: '',
    input: {},
    output: [],
    output_is_list: [],
    output_name: [],
    output_node: false,
    api_node: true
  }
}

async function openAllowlist(page: Page) {
  await page.goto(APP_URL)
  await page.waitForFunction(() => !!window.app?.extensionManager, null, {
    timeout: 45_000
  })
  await page
    .getByRole('button', { name: /^Settings/ })
    .first()
    .click()

  const dialog = page.getByTestId('settings-dialog')
  await expect(dialog).toBeVisible()
  await dialog.locator('nav').getByRole('button', { name: 'Workspace' }).click()

  const content = dialog.getByRole('main')
  await content.getByRole('tab', { name: 'Allowlist' }).click()
  await expect(
    content.getByRole('heading', { name: 'Partner nodes' })
  ).toBeVisible()
  return content
}

test.describe('Partner node allowlist', { tag: '@cloud' }, () => {
  test.describe.configure({ timeout: 60_000 })

  test('saves enforcement and allowlist as one policy', async ({ page }) => {
    await new CloudWorkspaceMockHelper(page).setup()

    await page.route('**/api/features', (route) =>
      route.fulfill(
        jsonRoute({
          ...WORKSPACE_FEATURE_FLAG,
          partner_node_governance_enabled: true
        } satisfies RemoteConfig)
      )
    )
    await page.route('**/api/object_info', (route) =>
      route.fulfill(
        jsonRoute({
          FluxFill: partnerNode('FluxFill', 'Flux Fill', 'BFL'),
          FluxExpand: partnerNode('FluxExpand', 'Flux Expand', 'BFL'),
          VeoVideo: partnerNode('VeoVideo', 'Veo Video', 'Google')
        })
      )
    )
    await page.route(/\/api\/assets(?:\?.*)?$/, (route) =>
      route.fulfill(
        jsonRoute({
          assets: [],
          total: 0,
          has_more: false
        } satisfies ListAssetsResponse)
      )
    )

    let policy: PartnerNodePolicyResponse = {
      enforcement_enabled: false,
      nodes: { FluxFill: false, FluxExpand: true, VeoVideo: true }
    } satisfies PartnerNodePolicyResponse
    const updates: unknown[] = []
    await page.route('**/api/workspace/partner-node-policy', (route) => {
      if (route.request().method() === 'PUT') {
        policy = route.request().postDataJSON() as PartnerNodePolicyResponse
        updates.push(policy)
      }
      return route.fulfill(jsonRoute(policy))
    })

    const content = await openAllowlist(page)
    const fluxFill = content.getByRole('switch', { name: 'Allow Flux Fill' })
    await expect(fluxFill).not.toBeChecked()
    await expect(
      content.getByRole('switch', { name: 'Allow Flux Expand' })
    ).toBeChecked()

    await content
      .getByRole('switch', { name: 'Enforce partner node allowlist' })
      .click()
    await fluxFill.click()
    await content.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByText('Partner node policy saved')).toBeVisible()
    expect(updates).toEqual([
      {
        enforcement_enabled: true,
        nodes: { FluxFill: true, FluxExpand: true, VeoVideo: true }
      }
    ] satisfies PartnerNodePolicyResponse[])
  })
})
