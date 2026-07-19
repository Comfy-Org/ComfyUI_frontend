import { expect } from '@playwright/test'
import type { Page, Route } from '@playwright/test'
import type {
  BillingBalanceResponse,
  ListWorkspaceInvitesResponse,
  PromptRequest
} from '@comfyorg/ingest-types'

import type { PromptResponse } from '@/schemas/apiSchema'
import { zJobsListResponse } from '@/platform/remote/comfyui/jobs/jobTypes'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'

import { cloudBillingApiFixture } from '@e2e/fixtures/cloudBillingApiFixture'
import { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { TopUpCreditsDialog } from '@e2e/fixtures/components/TopUpCreditsDialog'
import {
  DEFAULT_BILLING_BALANCE,
  DEFAULT_TEAM_MEMBERS,
  PERSONAL_BILLING_STATUS
} from '@e2e/fixtures/data/cloudWorkspace'
import { CloudWorkspaceMockHelper } from '@e2e/fixtures/helpers/CloudWorkspaceMockHelper'
import { TestIds } from '@e2e/fixtures/selectors'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { workspace } from '@e2e/fixtures/utils/workspaceMocks'

const APP_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'
const API_NODE_TYPE = 'DevToolsNodeWithPriceBadge'
const JOB_ID = 'partner-run-job'
const PROMPT_ROUTE_PATTERN = /\/api\/prompt$/
const PERSONAL_WORKSPACE = workspace('personal', 'owner')

const POST_RUN_BALANCE: BillingBalanceResponse = {
  ...DEFAULT_BILLING_BALANCE,
  amount_micros: 2_000,
  effective_balance_micros: 2_000,
  cloud_credit_balance_micros: 1_500
}

const EMPTY_INVITES: ListWorkspaceInvitesResponse = { invites: [] }

const API_NODE_DEFS: Record<string, ComfyNodeDef> = {
  [API_NODE_TYPE]: {
    name: API_NODE_TYPE,
    display_name: 'Node With Price Badge',
    description: 'An API node with a price badge',
    category: 'api node',
    python_module: 'comfy_api_nodes',
    input: {
      required: {
        price: [['1x', '2x', '3x'], { default: '1x' }]
      }
    },
    output: [],
    output_is_list: [],
    output_name: [],
    output_node: true,
    api_node: true,
    price_badge: {
      engine: 'jsonata',
      depends_on: {
        widgets: [{ name: 'price', type: 'COMBO' }],
        inputs: [],
        input_groups: []
      },
      expr: "{'type':'text','text':'1 credit/Run'}"
    }
  }
}

const EMPTY_JOBS = zJobsListResponse.parse({
  jobs: [],
  pagination: {
    offset: 0,
    limit: 200,
    total: 0,
    has_more: false
  }
})

interface PartnerApp {
  comfyPage: ComfyPage
  partnerNodeId: string
}

async function mockGraphApi(page: Page): Promise<void> {
  const promptStatus: PromptResponse = {
    exec_info: { queue_remaining: 0 },
    error: ''
  }

  await page.route('**/api/prompt', (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    return route.fulfill(jsonRoute(promptStatus))
  })
  await page.route('**/api/object_info', (route) =>
    route.fulfill(jsonRoute(API_NODE_DEFS))
  )
  await page.route('**/api/jobs**', (route) =>
    route.fulfill(jsonRoute(EMPTY_JOBS))
  )
  await page.route('**/api/workspace/invites', (route) =>
    route.fulfill(jsonRoute(EMPTY_INVITES))
  )
}

async function mockPromptPost(
  page: Page,
  response: PromptResponse,
  status = 200
) {
  const handler = async (route: Route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback()
      return
    }
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(response)
    })
  }
  await page.route(PROMPT_ROUTE_PATTERN, handler)
  return handler
}

const test = cloudBillingApiFixture.extend<{
  partnerApp: PartnerApp
}>({
  partnerApp: async ({ billingApi, page, request }, use) => {
    await billingApi.setup({
      status: PERSONAL_BILLING_STATUS,
      balance: DEFAULT_BILLING_BALANCE
    })
    await new CloudWorkspaceMockHelper(page).setup(
      DEFAULT_TEAM_MEMBERS,
      PERSONAL_WORKSPACE,
      { mockBilling: false }
    )
    await mockGraphApi(page)

    await page.goto(APP_URL)
    await page.waitForFunction(() => !!window.app?.extensionManager, null, {
      timeout: 45_000
    })

    const comfyPage = new ComfyPage(page, request)
    await comfyPage.workflow.waitForActiveWorkflow()
    await comfyPage.workflow.waitForWorkflowIdle()
    const partnerNode = await comfyPage.nodeOps.addNode(
      API_NODE_TYPE,
      undefined,
      { x: 100, y: 100 }
    )

    await use({
      comfyPage,
      partnerNodeId: String(partnerNode.id)
    })
  }
})

test.describe('Billing partner-node lifecycle', { tag: '@cloud' }, () => {
  test.describe.configure({ timeout: 60_000 })

  test('TB-03 queues an API node and renders the refreshed post-run balance', async ({
    billingApi,
    page,
    partnerApp
  }) => {
    const { comfyPage, partnerNodeId } = partnerApp
    const currentUserButton = page.getByRole('button', {
      name: 'Current user'
    })
    const popover = page.locator('.current-user-popover')

    await currentUserButton.click()
    await expect(popover.getByText('5,275', { exact: true })).toBeVisible()
    await currentUserButton.click()
    await expect(popover).toBeHidden()

    const response: PromptResponse = {
      prompt_id: JOB_ID,
      node_errors: {},
      error: ''
    }
    const promptPostHandler = await mockPromptPost(page, response)

    const promptRequestPromise = page.waitForRequest(
      (request) =>
        request.method() === 'POST' && PROMPT_ROUTE_PATTERN.test(request.url())
    )
    const promptResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        PROMPT_ROUTE_PATTERN.test(response.url())
    )
    await comfyPage.actionbar.queueButton.primaryButton.click()

    const promptRequest = (await promptRequestPromise).postDataJSON() as
      | PromptRequest
      | undefined
    await promptResponsePromise
    await page.unroute(PROMPT_ROUTE_PATTERN, promptPostHandler)
    expect(promptRequest?.prompt).toBeDefined()
    expect(Object.values(promptRequest?.prompt ?? {})).toContainEqual(
      expect.objectContaining({
        class_type: API_NODE_TYPE,
        inputs: expect.objectContaining({ price: '1x' })
      })
    )
    expect(promptRequest?.extra_data).toEqual(
      expect.objectContaining({
        comfy_usage_source: 'comfyui-frontend',
        extra_pnginfo: expect.objectContaining({
          workflow: expect.any(Object)
        })
      })
    )

    await comfyPage.nextFrame()
    const cancelRunButton = page.getByRole('button', {
      name: 'Cancel current run'
    })
    await page.evaluate(
      ({ jobId, nodeId }) => {
        window.app!.api.dispatchCustomEvent('execution_start', {
          prompt_id: jobId,
          timestamp: Date.now()
        })
        window.app!.api.dispatchCustomEvent('executing', nodeId)
      },
      { jobId: JOB_ID, nodeId: partnerNodeId }
    )
    await expect(cancelRunButton).toBeEnabled()
    await page.evaluate(
      ({ jobId, nodeId }) => {
        window.app!.api.dispatchCustomEvent('executed', {
          prompt_id: jobId,
          node: nodeId,
          display_node: nodeId,
          output: {}
        })
        window.app!.api.dispatchCustomEvent('execution_success', {
          prompt_id: jobId,
          timestamp: Date.now()
        })
      },
      { jobId: JOB_ID, nodeId: partnerNodeId }
    )
    await expect(cancelRunButton).toBeDisabled()
    billingApi.setBalance(POST_RUN_BALANCE)

    const balanceRefresh = page.waitForResponse((response) => {
      const request = response.request()
      return (
        request.method() === 'GET' &&
        new URL(response.url()).pathname.endsWith('/api/billing/balance') &&
        response.status() === 200
      )
    })
    await currentUserButton.click()
    await balanceRefresh
    await expect(popover.getByText('4,220', { exact: true })).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Plans for Personal Workspace' })
    ).toBeHidden()
    await expect(page.getByTestId(TestIds.dialogs.errorOverlay)).toBeHidden()
  })

  test('TB-03 keeps insufficient-credit recovery visible when billing refresh fails', async ({
    billingApi,
    page,
    partnerApp
  }) => {
    const { comfyPage } = partnerApp
    const pageErrors: Error[] = []
    page.on('pageerror', (error) => pageErrors.push(error))
    billingApi.setQueryFailure('status', {
      status: 503,
      message: 'Billing status unavailable'
    })
    billingApi.setQueryFailure('balance', {
      status: 503,
      message: 'Billing balance unavailable'
    })

    const response: PromptResponse = {
      node_errors: {},
      error: {
        type: 'PAYMENT_REQUIRED',
        message: 'Insufficient credits to queue workflows',
        details: ''
      }
    }
    const promptPostHandler = await mockPromptPost(page, response, 429)

    const promptResponsePromise = page.waitForResponse(
      (promptResponse) =>
        promptResponse.request().method() === 'POST' &&
        PROMPT_ROUTE_PATTERN.test(promptResponse.url())
    )
    const statusFailure = page.waitForResponse(
      (billingResponse) =>
        billingResponse.request().method() === 'GET' &&
        new URL(billingResponse.url()).pathname.endsWith(
          '/api/billing/status'
        ) &&
        billingResponse.status() === 503
    )
    const balanceFailure = page.waitForResponse(
      (billingResponse) =>
        billingResponse.request().method() === 'GET' &&
        new URL(billingResponse.url()).pathname.endsWith(
          '/api/billing/balance'
        ) &&
        billingResponse.status() === 503
    )
    await comfyPage.actionbar.queueButton.primaryButton.click()
    await Promise.all([promptResponsePromise, statusFailure, balanceFailure])
    await page.unroute(PROMPT_ROUTE_PATTERN, promptPostHandler)

    const topUpDialog = new TopUpCreditsDialog(page)
    await expect(topUpDialog.insufficientHeading).toBeVisible()
    await expect(topUpDialog.root).toContainText(
      "You don't have enough credits to run this workflow"
    )
    await expect(page.getByTestId(TestIds.dialogs.errorOverlay)).toBeHidden()
    await expect(page.getByTestId(TestIds.dialogs.errorDialog)).toBeHidden()
    expect(pageErrors).toEqual([])
  })
})
