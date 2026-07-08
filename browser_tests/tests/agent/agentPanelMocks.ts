import type { Page, Route } from '@playwright/test'

import type { RemoteConfig } from '@/platform/remoteConfig/types'
import type {
  AgentDraftSnapshot,
  AgentTurnAccepted,
  AgentWsEvent,
  DraftPatchData
} from '@/workbench/extensions/agent/schemas/agentApiSchema'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'

import { mockSystemStats } from '@e2e/fixtures/data/systemStats'

/**
 * Typed mocks for the In-App Agent panel e2e spec. Every REST body and WS frame
 * is annotated with the shared agent contract types
 * (`@/workbench/extensions/agent/schemas/agentApiSchema`) and the workflow schema,
 * so a wire-shape drift is a compile error here, not a flaky runtime failure. The
 * payload values are copied from the captured fixtures under
 * `src/workbench/extensions/agent/schemas/__fixtures__/agent/`.
 */

// The turn everything in scenario 2 & 3 is addressed by. The panel adopts this
// server-minted message_id (from the POST 202 ack) as the TurnId that keys the
// assistant message the WS frames stream into.
const THREAD_ID = 'd4c016c4-3b8c-44cf-97de-1ae27e43e718'
const TURN_ID = '3818ba00-d772-4a3f-98c1-9312725b577d'
const WORKFLOW_ID = 'a81718a4-02ae-41e6-ae85-c33b7bb880f6'

// The 202 body the panel's postMessage('new') expects: {thread_id, message_id}
// plus the captured additive workflow_id (the schema is passthrough).
const TURN_ACCEPTED: AgentTurnAccepted = {
  message_id: TURN_ID,
  thread_id: THREAD_ID,
  workflow_id: WORKFLOW_ID
}

/**
 * A minimal schema-valid v0.4 workflow. `validateComfyWorkflow` first parses a
 * top-level `version: number` (the captured draft graphs omit it, so they would
 * be rejected before ever reaching the canvas); this shape carries `version`,
 * `last_node_id`, `last_link_id`, `nodes` and `links` so it survives validation
 * and `app.loadGraphData` actually applies it. Two nodes so the assertion on the
 * canvas node count is unambiguous.
 */
const DRAFT_GRAPH: ComfyWorkflowJSON = {
  version: 0.4,
  last_node_id: 2,
  last_link_id: 0,
  nodes: [
    {
      id: 1,
      type: 'CheckpointLoaderSimple',
      pos: [100, 300],
      size: [210, 100],
      flags: {},
      order: 0,
      mode: 0,
      inputs: [],
      outputs: [
        { name: 'MODEL', type: 'MODEL', links: [] },
        { name: 'CLIP', type: 'CLIP', links: [] },
        { name: 'VAE', type: 'VAE', links: [] }
      ],
      properties: {},
      widgets_values: ['sd_xl_base_1.0.safetensors']
    },
    {
      id: 2,
      type: 'SaveImage',
      pos: [1400, 300],
      size: [210, 100],
      flags: {},
      order: 1,
      mode: 0,
      inputs: [{ name: 'images', type: 'IMAGE', link: null }],
      outputs: [],
      properties: {},
      widgets_values: ['ComfyUI']
    }
  ],
  links: []
}

// The GET /api/agent/draft snapshot body: {content, version}. content rides the
// wire as an opaque object; the panel re-validates it before loading.
const DRAFT_SNAPSHOT: AgentDraftSnapshot = {
  content: DRAFT_GRAPH as unknown as Record<string, unknown>,
  version: 24
}

// A draft_patch WS event whose content is the minimal valid graph above. The panel
// adopts monotonically, so the version must exceed any snapshot already adopted.
export const DRAFT_PATCH: DraftPatchData = {
  base_version: 24,
  version: 25,
  content: DRAFT_GRAPH as unknown as Record<string, unknown>,
  workflow_id: WORKFLOW_ID,
  message_id: TURN_ID,
  thread_id: THREAD_ID
}

// The chat-turn WS frames for scenario 2, in arrival order. Each rides the ComfyUI
// envelope {type, data}; values copied from ws-turn-ask-run.jsonl but retargeted to
// TURN_ID so they land on the turn the POST ack opened.
export const THINKING_EVENT: AgentWsEvent = {
  type: 'agent_thinking',
  data: {
    delta: "I'll set the positive prompt to your red fox scene.",
    message_id: TURN_ID,
    thread_id: THREAD_ID
  }
}

export const TOOL_CALL_EVENT: AgentWsEvent = {
  type: 'agent_tool_call',
  data: {
    tool_name: 'set_widget',
    status: 'ok',
    args: ['workflow', 'set-widget', 'workflow.json'],
    message_id: TURN_ID,
    thread_id: THREAD_ID
  }
}

// Markdown delta: the **bold** run renders as <strong> through the sanitizing
// markdown pipeline, which the spec asserts on.
const MESSAGE_DELTA_TEXT =
  'The graph is **fully ready** to go — prompt set to the red fox in the snow.'

export const MESSAGE_DELTA_EVENT: AgentWsEvent = {
  type: 'agent_message_delta',
  data: {
    delta: MESSAGE_DELTA_TEXT,
    message_id: TURN_ID,
    thread_id: THREAD_ID
  }
}

export const MESSAGE_DONE_EVENT: AgentWsEvent = {
  type: 'agent_message_done',
  data: {
    message_id: TURN_ID,
    thread_id: THREAD_ID,
    usage: {
      input_tokens: 4493,
      output_tokens: 425,
      total_tokens: 12393,
      cache_read_input_tokens: 35596,
      cache_creation_input_tokens: 0
    }
  }
}

/**
 * `/api/features` payload that boots the cloud telemetry provider with PostHog AND
 * turns the agent gate on. PostHog only initializes when a `posthog_project_token`
 * is present, and the panel's fail-closed gate reads `posthog.isFeatureEnabled`;
 * seeding the flag through PostHog's `bootstrap.featureFlags` makes that read
 * resolve `true` synchronously at init with no `/decide` round-trip, so the gate is
 * deterministic. Omit `agentFlag` (or pass false) to model the fail-closed default.
 */
function agentFeatures(agentFlag: boolean): RemoteConfig {
  return {
    team_workspaces_enabled: true,
    posthog_project_token: 'phc_e2e_agent_panel',
    posthog_config: {
      // Never let posthog-js reach its flags endpoint in the test env; bootstrap
      // alone supplies the flag value the gate reads.
      advanced_disable_flags: true,
      bootstrap: {
        featureFlags: { 'agent-in-app-experience': agentFlag }
      }
    }
  }
}

const jsonRoute = (body: unknown) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify(body)
})

/**
 * Boots the cloud app against fully mocked boot + agent REST endpoints. Mirrors
 * `CloudWorkspaceMockHelper.mockBoot`, adding the agent's own REST surface
 * (`postMessage`, `getDraft`). Records POST bodies into the caller's
 * `postedMessages` so the spec can assert the composed message reached the wire.
 * Auth (Firebase) is mocked by the caller via `CloudAuthHelper` before navigation.
 */
export async function mockAgentBoot(
  page: Page,
  {
    agentFlag,
    postedMessages
  }: { agentFlag: boolean; postedMessages: string[] }
): Promise<void> {
  await page.route('**/api/features', (r) =>
    r.fulfill(jsonRoute(agentFeatures(agentFlag)))
  )
  await page.route('**/api/system_stats', (r) =>
    r.fulfill(jsonRoute(mockSystemStats))
  )
  await page.route('**/api/users', (r) =>
    r.fulfill(
      jsonRoute({
        storage: 'server',
        migrated: true,
        users: { 'test-user-e2e': 'E2E Test User' }
      })
    )
  )
  // TutorialCompleted marks the user as returning so the new-user Templates dialog
  // never auto-opens over the sidebar rail; errors tab off suppresses a 401 toast.
  await page.route('**/api/settings', (r) =>
    r.fulfill(
      jsonRoute({
        'Comfy.TutorialCompleted': true,
        'Comfy.RightSidePanel.ShowErrorsTab': false
      })
    )
  )
  await page.route('**/api/userdata**', (r) => r.fulfill(jsonRoute([])))
  await page.route('**/api/extensions', (r) => r.fulfill(jsonRoute([])))
  await page.route('**/api/object_info', (r) => r.fulfill(jsonRoute({})))
  await page.route('**/api/global_subgraphs', (r) => r.fulfill(jsonRoute({})))
  await page.route('**/api/i18n', (r) => r.fulfill(jsonRoute({})))
  await page.route('**/api/auth/session', (r) =>
    r.fulfill(jsonRoute({ token: 'mock-workspace-token' }))
  )
  await page.route('**/api/auth/token', (r) =>
    r.fulfill(jsonRoute({ token: 'mock-workspace-token' }))
  )
  await page.route('**/releases**', (r) => r.fulfill(jsonRoute([])))
  await page.route('**/api/workspaces', (r) =>
    r.fulfill(
      jsonRoute({
        workspaces: [
          {
            id: 'ws-personal',
            name: 'Personal',
            type: 'personal',
            role: 'owner'
          }
        ]
      })
    )
  )

  // POST /api/agent/threads/new/messages -> 202 {thread_id, message_id, workflow_id}.
  // The server owns the workflow and returns its id in this ack; the panel binds the
  // draft store to it and then only adopts draft_patch events whose workflow_id
  // matches. Record the body so the spec can assert the composed text was sent, not
  // just that a request fired. GET on the same path (history hydration) is empty.
  await page.route('**/api/agent/threads/*/messages', (route: Route) => {
    const request = route.request()
    if (request.method() === 'POST') {
      postedMessages.push(request.postData() ?? '')
      return route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify(TURN_ACCEPTED)
      })
    }
    return route.fulfill(jsonRoute([]))
  })

  await page.route('**/api/agent/draft**', (r) =>
    r.fulfill(jsonRoute(DRAFT_SNAPSHOT))
  )
}
