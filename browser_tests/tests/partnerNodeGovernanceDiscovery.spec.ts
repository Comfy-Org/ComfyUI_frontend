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

function partnerNode(name: string): ComfyNodeDef {
  return {
    name,
    display_name: name,
    category: 'partner/image/Acme',
    python_module: 'comfy_api_nodes.acme',
    description: '',
    input: {},
    output: [],
    output_is_list: [],
    output_name: [],
    output_node: false,
    api_node: true
  }
}

async function setupGovernedWorkspace(page: Page) {
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
        AllowedPartnerNode: partnerNode('AllowedPartnerNode'),
        DisabledPartnerNode: partnerNode('DisabledPartnerNode')
      } satisfies Record<string, ComfyNodeDef>)
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
  await page.route('**/api/workspace/partner-node-policy', (route) =>
    route.fulfill(
      jsonRoute({
        enforcement_enabled: true,
        nodes: {
          AllowedPartnerNode: true,
          DisabledPartnerNode: false
        }
      } satisfies PartnerNodePolicyResponse)
    )
  )
}

test.describe('Partner node governance discovery', { tag: '@cloud' }, () => {
  test('hides disabled nodes from search', async ({ page }) => {
    await setupGovernedWorkspace(page)
    await page.goto(APP_URL)
    await page.waitForFunction(() => !!window.app?.extensionManager, null, {
      timeout: 45_000
    })

    await page.evaluate(async () => {
      await window.app!.extensionManager.setting.set(
        'Comfy.NodeSearchBoxImpl',
        'default'
      )
      await window.app!.extensionManager.command.execute(
        'Workspace.SearchBox.Toggle'
      )
    })
    const search = page.getByRole('search')
    await expect(search).toBeVisible()
    await search.getByRole('combobox').fill('PartnerNode')

    await expect(search.getByText('AllowedPartnerNode')).toBeVisible()
    await expect(search.getByText('DisabledPartnerNode')).toHaveCount(0)
  })
})
