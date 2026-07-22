import type { Page } from '@playwright/test'

import type { ListAssetsResponse } from '@comfyorg/ingest-types'

import type { PartnerNodePolicyResponse } from '@/platform/workspace/api/partnerNodePolicyApi'
import type { RemoteConfig } from '@/platform/remoteConfig/types'
import type { PromptResponse } from '@/schemas/apiSchema'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'

import { comfyPageFixture as base } from '@e2e/fixtures/ComfyPage'
import { WORKSPACE_FEATURE_FLAG } from '@e2e/fixtures/data/cloudWorkspace'
import { CloudWorkspaceMockHelper } from '@e2e/fixtures/helpers/CloudWorkspaceMockHelper'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

const APP_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'
const DISABLED_NODE = 'DisabledPartnerNode'

interface PartnerNodeGovernanceFixture {
  promptRequestCount: () => number
}

function disabledPartnerNode(): ComfyNodeDef {
  return {
    name: DISABLED_NODE,
    display_name: 'Disabled Partner Node',
    category: 'partner/image/Acme',
    python_module: 'comfy_api_nodes.acme',
    description: '',
    input: {},
    output: [],
    output_is_list: [],
    output_name: [],
    output_node: true,
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
    route.fulfill(jsonRoute({ [DISABLED_NODE]: disabledPartnerNode() }))
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
        nodes: { [DISABLED_NODE]: false }
      } satisfies PartnerNodePolicyResponse)
    )
  )
}

export const partnerNodeGovernanceTest = base.extend<{
  partnerNodeGovernance: PartnerNodeGovernanceFixture
}>({
  partnerNodeGovernance: async ({ page }, use) => {
    await setupGovernedWorkspace(page)
    let promptRequests = 0
    await page.route('**/api/prompt', (route) => {
      promptRequests++
      return route.fulfill(
        jsonRoute({
          prompt_id: 'unexpected-prompt',
          node_errors: {},
          error: ''
        } satisfies PromptResponse)
      )
    })

    await page.goto(APP_URL)
    await page.waitForFunction(() => !!window.app?.extensionManager, null, {
      timeout: 45_000
    })
    await page.evaluate((nodeType) => {
      const node = window.LiteGraph!.createNode(nodeType)
      if (!node) throw new Error(`Failed to create ${nodeType}`)
      window.app!.rootGraph.add(node)
    }, DISABLED_NODE)

    await use({ promptRequestCount: () => promptRequests })
  }
})
