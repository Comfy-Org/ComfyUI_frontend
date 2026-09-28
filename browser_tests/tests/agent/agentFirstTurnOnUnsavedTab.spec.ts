import { expect, mergeTests } from '@playwright/test'
import type { Route } from '@playwright/test'
import type { AgentPostMessageRequest } from '@comfyorg/ingest-types'
import { zAgentPostMessageRequest } from '@comfyorg/ingest-types/zod'
import { z } from 'zod'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { AgentTurnAccepted } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import { agentTest } from '@e2e/fixtures/agentPanelFixture'
import { workflowSelectionTest } from '@e2e/fixtures/agentWorkflowSelectionFixture'
import { agentReplayNodeDefs } from '@e2e/fixtures/data/agentReplayNodeDefs'
import { Topbar } from '@e2e/fixtures/components/Topbar'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

// Story 33 of qa/user-story-test-matrix.md (in-app-agent-program):
// "Agent refuses the tab I am looking at: 'no workflow selected'. Fresh or
// freshly-subscribed tab; also 'workflow not found or access denied' after
// selecting the tab and refreshing. Second message onward works."
// Sources: regr-32 (PM-1429, PM-1430, PM-1432, PM-1433, PM-1634, PR 18278),
// slack-35, linear-27. No pin as of the matrix.
//
// "Second message onward works" is the tell: the tab is fine, the *first*
// turn's description of it is not. A tab the user has never saved has no
// cloud workflow id, so the turn has to say "there IS a tab selected, it just
// has no id yet" -- `current_tab_unbound`, whose contract in
// agentRestClient.ts reads: "Tells the server this is a selected-but-unbound
// tab rather than no tab at all, so it mints a workflow for it instead of
// falling back to the thread's previous one and presenting the turn to the
// model as having no workflow selected." Send it without the draft and the
// mint starts empty, which reads to the user as the same refusal.
//
// agentNewChatTargetWorkflow.spec.ts already pins the picker retargeting to
// the fresh tab (PM-1415). It stops before the message is sent, so what the
// first turn on that tab actually claims about it is unpinned; that is what
// this adds. Lands green: a regression guard, not a live repro.

const test = mergeTests(agentTest, workflowSelectionTest)

// The draft's content is typed as an opaque workflow document at the API
// boundary; this names only the field this story is about.
const zDraftContent = z
  .object({
    nodes: z.array(
      z.object({ id: z.union([z.string(), z.number()]) }).passthrough()
    )
  })
  .passthrough()

const PROMPT = 'What does this workflow do?'

test.describe(
  'The first Agent turn on a tab the user has never saved',
  { tag: ['@cloud', '@agent'] },
  () => {
    // Real node definitions, so the node the user adds is a real one.
    test.use({ nodeDefinitions: agentReplayNodeDefs })

    test('names the tab as selected-but-unbound and carries its canvas', async ({
      page,
      workflowSelection
    }) => {
      test.setTimeout(30_000)

      const posted: AgentPostMessageRequest[] = []
      // Registered from the test body so it resolves ahead of the selection
      // fixture's thread-list route, which would otherwise answer the POST
      // with a list instead of an accepted turn.
      await page.route('**/api/agent/threads/*/messages', (route: Route) => {
        const request = route.request()
        if (request.method() !== 'POST') return route.fallback()
        posted.push(zAgentPostMessageRequest.parse(request.postDataJSON()))
        const accepted: AgentTurnAccepted = {
          thread_id: '2f1d9c4a-6b3e-4a70-8c15-9d0e7f2a3b41',
          message_id: '5c7e1a2b-8d4f-4e93-a016-3b8c5d9e0f12',
          workflow_id: 'b3e5d7f9-1a2c-4d6e-8f01-2a3b4c5d6e7f'
        }
        return route.fulfill({ ...jsonRoute(accepted), status: 202 })
      })

      const panel = page.locator('#agent-panel-root')
      const targetPicker = panel.getByRole('button', {
        name: enMessages.agent.switchWorkflow
      })
      const topbar = new Topbar(page)

      await test.step('user opens the Agent and pins it to the tab they started on', async () => {
        await page
          .getByRole('button', {
            name: enMessages.agent.entryButton,
            exact: true
          })
          .click()
        await targetPicker.click()
        await page
          .getByRole('menuitemradio', { name: 'Unsaved Workflow', exact: true })
          .click()
        await expect.poll(() => workflowSelection.savedPaths.length).toBe(1)
        workflowSelection.finishSave(true)
        await expect(targetPicker).toHaveText('Unsaved Workflow')
      })

      await test.step('user opens a brand new tab and starts a chat on it', async () => {
        await page
          .getByRole('button', {
            name: enMessages.sideToolbar.newBlankWorkflow,
            exact: true
          })
          .click()
        await expect(topbar.getActiveTab()).toHaveText('Unsaved Workflow (2)')
        await panel
          .getByRole('button', { name: enMessages.agent.newChat })
          .click()
        await expect(targetPicker).toHaveText('Unsaved Workflow (2)')
      })

      // The user puts something on the new tab before asking about it: the
      // ordinary createNode + graph.add every add path goes through.
      const addedId = await page.evaluate(() => {
        const node = window.LiteGraph!.createNode('KSampler')
        if (!node) throw new Error('KSampler is not a registered node type')
        node.pos = [300, 200]
        window.app!.graph.add(node)
        return String(node.id)
      })

      // What the user can point at on the tab they are looking at.
      const onScreenNodeIds = await page.evaluate(() =>
        window.app!.graph.nodes.map((node) => String(node.id)).toSorted()
      )
      expect(onScreenNodeIds).toEqual([addedId])

      await test.step('user sends their first message on that tab', async () => {
        await panel.getByRole('textbox').fill(PROMPT)
        await panel.getByRole('button', { name: enMessages.agent.send }).click()
        await expect.poll(() => posted.length).toBe(1)
      })

      await test.step('the turn says a tab is selected, it just has no id yet', () => {
        expect(
          posted[0].workflow_id ?? null,
          'a tab the user never saved has no cloud workflow id to name'
        ).toBeNull()
        expect(posted[0].current_tab).toBeUndefined()
        expect(
          posted[0].current_tab_unbound,
          'without this the server presents the turn as having no workflow selected'
        ).toBe(true)
      })

      await test.step('the turn carries the canvas the minted workflow must start from', () => {
        const content = posted[0].draft?.content
        expect(
          content,
          'an unbound target sent without its draft mints an empty workflow'
        ).toBeTruthy()
        const { nodes } = zDraftContent.parse(content)
        expect(nodes.map((node) => String(node.id)).toSorted()).toEqual(
          onScreenNodeIds
        )
      })
    })
  }
)
