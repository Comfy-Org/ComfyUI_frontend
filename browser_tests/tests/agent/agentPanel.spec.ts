import type { WebSocketRoute } from '@playwright/test'
import { expect, mergeTests } from '@playwright/test'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { webSocketFixture } from '@e2e/fixtures/ws'

import enMessages from '@/locales/en/main.json'
import type { AgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import {
  DRAFT_PATCH,
  MESSAGE_DELTA_EVENT,
  MESSAGE_DONE_EVENT,
  THINKING_EVENT,
  TOOL_CALL_EVENT,
  mockAgentBoot
} from '@e2e/tests/agent/agentPanelMocks'

/**
 * In-App Agent panel e2e coverage (FE-1187).
 *
 * The panel is a CLOUD-ONLY workbench extension: `src/extensions/core/index.ts`
 * imports `agentPanel.ts` only under `if (isCloud)`, and `isCloud` is the
 * build-time `__DISTRIBUTION__ === 'cloud'` define. It therefore exists only in
 * the cloud build, which the `cloud` Playwright project runs against
 * (`frontend-dist-cloud` in CI; `playwright.config.ts` gives that project
 * `grep: /@cloud/` while every other project greps it out). These specs are
 * tagged `@cloud` so they run there and nowhere else. The `comfyPageFixture`
 * itself already installs the cloud Firebase-auth mock for any `@cloud` test and
 * boots the app, so tests only arrange agent mocks and act.
 *
 * The panel docks on the right and opens from the top-bar "Ask Comfy Agent"
 * button (not a sidebar tab). It is gated FAIL-CLOSED by the PostHog flag
 * `agent-in-app-experience`: `agentPanel.ts` reads `posthog.isFeatureEnabled`
 * and only exposes that button once it is `true`. PostHog only initializes
 * when `/api/features` supplies a `posthog_project_token`, so the mocks seed both
 * the token and the flag (through PostHog `bootstrap.featureFlags`, which resolves
 * the read synchronously with no `/decide` network call — see `agentPanelMocks.ts`).
 * `agentFlagEnabled` (default true) is a fixture option a test flips off to model
 * the fail-closed default.
 *
 * REST is mocked via `page.route` (POST messages -> 202, GET draft snapshot) and
 * server->client WS frames are injected with the repo's `webSocketFixture`
 * (`context.routeWebSocket(/\/ws/)`): `ws.send(JSON.stringify({type, data}))`
 * pushes a frame onto the app's shared `/ws`, which is exactly where the panel's
 * reconnecting event source listens.
 */

type AgentFixtures = {
  agentFlagEnabled: boolean
  postedMessages: string[]
}

// Install agent boot + REST mocks in the `page` fixture (before navigation) and
// expose the recorded POST bodies. `comfyPageFixture` consumes this same `page`
// and then boots the app, so the mocks are in place before mount.
const agentCloudFixture = comfyPageFixture.extend<AgentFixtures>({
  agentFlagEnabled: [true, { option: true }],
  postedMessages: async ({ page, agentFlagEnabled }, use) => {
    const { postedMessages } = await mockAgentBoot(page, {
      agentFlag: agentFlagEnabled
    })
    await use(postedMessages)
  }
})

const test = mergeTests(agentCloudFixture, webSocketFixture)

// The panel opens from the top-bar action button, exposed with aria-label = tooltip.
const OPEN_AGENT_LABEL = enMessages.agent.askComfyAgent

// Push one agent WS event onto the app's /ws in the ComfyUI envelope shape.
function pushEvent(ws: WebSocketRoute, event: AgentWsEvent): void {
  ws.send(JSON.stringify(event))
}

test.describe('In-App Agent panel', { tag: '@cloud' }, () => {
  test.describe('flag off', () => {
    test.use({ agentFlagEnabled: false })

    test('does not expose the Ask Comfy Agent button', async ({
      comfyPage,
      postedMessages
    }) => {
      // Touch the fixture so its mocks (flag-off /api/features) are installed.
      expect(postedMessages).toHaveLength(0)

      // Fail-closed: with the PostHog flag false the top-bar button is never
      // exposed, so the panel cannot be opened.
      await expect(
        comfyPage.page.getByRole('button', { name: OPEN_AGENT_LABEL })
      ).toHaveCount(0)
    })
  })

  test('shows the greeting, inserts a suggested prompt, and completes a chat turn', async ({
    comfyPage,
    postedMessages,
    getWebSocket
  }) => {
    const page = comfyPage.page

    // Flag on: the top-bar button is exposed. Open the panel.
    const openButton = page.getByRole('button', { name: OPEN_AGENT_LABEL })
    await expect(openButton).toBeVisible()
    await openButton.click()

    const panel = page.locator('#agent-panel-root')
    await expect(panel).toBeVisible()

    // Empty state: greeting + question and the five suggested-prompt chips. The greeting
    // personalizes to the account's first name, so match the stable prefix, not a fixed name.
    await expect(panel.getByText(/^Hello/)).toBeVisible()
    await expect(panel.getByText('What do you want to make?')).toBeVisible()
    // Sourced from the bundled locale so the spec cannot drift from the rendered prompts.
    const firstPrompt = enMessages.agent.suggestedPrompts[0]
    const promptChip = panel.getByRole('button', { name: firstPrompt })
    await expect(promptChip).toBeVisible()

    const composer = panel.getByPlaceholder('Ask the agent anything...')
    const sendButton = panel.getByRole('button', { name: 'Send' })

    // Clicking a suggested prompt INSERTS it into the composer, it does not send.
    await expect(composer).toHaveValue('')
    await promptChip.click()
    await expect(composer).toHaveValue(firstPrompt)
    expect(
      postedMessages,
      'inserting a prompt must not POST a message'
    ).toHaveLength(0)

    // Submitting sends the composed message: POST /api/agent/threads/new/messages.
    const ws = await getWebSocket()
    await sendButton.click()
    await expect.poll(() => postedMessages.length).toBeGreaterThanOrEqual(1)
    expect(postedMessages[0]).toContain(firstPrompt)
    // The composer clears once the send is accepted.
    await expect(composer).toHaveValue('')

    // agent_thinking -> the "Thinking..." status is visible.
    pushEvent(ws, THINKING_EVENT)
    await expect(panel.getByText('Thinking...')).toBeVisible()

    // agent_tool_call (ok) -> a tool-call group card appears ("Ran 1 tool call").
    pushEvent(ws, TOOL_CALL_EVENT)
    await expect(panel.getByText('Ran 1 tool call')).toBeVisible()

    // agent_message_delta with markdown -> rendered agent message; the **bold**
    // run renders as <strong>.
    pushEvent(ws, MESSAGE_DELTA_EVENT)
    await expect(
      panel.locator('strong', { hasText: 'fully ready' })
    ).toBeVisible()
    // Text arriving clears the thinking chip.
    await expect(panel.getByText('Thinking...')).toBeHidden()

    // agent_message_done -> the turn settles: the primary button returns to Send
    // (it is Stop while streaming).
    pushEvent(ws, MESSAGE_DONE_EVENT)
    await expect(panel.getByRole('button', { name: 'Send' })).toBeVisible()
    await expect(panel.getByRole('button', { name: 'Stop' })).toHaveCount(0)
  })

  test('applies a draft_patch graph to the canvas', async ({
    comfyPage,
    postedMessages,
    getWebSocket
  }) => {
    const page = comfyPage.page
    const panel = page.locator('#agent-panel-root')

    const openButton = page.getByRole('button', { name: OPEN_AGENT_LABEL })
    await expect(openButton).toBeVisible()
    await openButton.click()
    await expect(panel).toBeVisible()

    // The draft store only adopts a draft_patch whose workflow_id matches the
    // server's workflow. The server returns that id in the message ack, and the
    // panel binds the draft store to it. So send once to establish the bind before
    // pushing the patch. A draft_patch is otherwise NEVER turn-filtered.
    await panel.getByPlaceholder('Ask the agent anything...').fill('Build it')
    await panel.getByRole('button', { name: 'Send' }).click()
    await expect.poll(() => postedMessages.length).toBeGreaterThanOrEqual(1)

    const ws = await getWebSocket()
    pushEvent(ws, { type: 'draft_patch', data: DRAFT_PATCH })

    // The two-node draft graph is validated and handed to app.loadGraphData, so
    // the canvas graph must reflect it.
    await expect
      .poll(() => page.evaluate(() => window.app!.graph!.nodes.length))
      .toBe(2)
    const nodeTypes = await page.evaluate(() =>
      window.app!.graph!.nodes.map((n) => n.type)
    )
    expect(nodeTypes).toEqual(
      expect.arrayContaining(['CheckpointLoaderSimple', 'SaveImage'])
    )
  })
})
