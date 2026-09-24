import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'

// Pinia store instance access, the pattern
// `browser_tests/tests/vueNodes/widgets/flux2ImagePromptRerun.spec.ts` uses:
// the store object itself cannot cross the evaluate boundary, so every call
// against it happens inside a single `page.evaluate`.
interface WorkflowTabBindingStore {
  tabPathFor(workflowId: string): string | undefined
  bind(workflowId: string, tabPath: string): void
  unbindWorkflow(workflowId: string): void
}

// Drops the agent's workflow-tab binding so `getScope()` (AgentPanelRoot.vue)
// resolves to null on the next batch, reproducing the same "can't resolve
// which tab this edit is bound to" race the retry recovers from — without
// touching the doc or sending another frame. Returns the tab path so the
// caller can restore the exact same binding afterward.
function dropWorkflowScope(page: Page, workflowId: string): Promise<string> {
  return page.evaluate((id) => {
    const store = (
      document.getElementById('vue-app') as unknown as {
        __vue_app__: {
          config: {
            globalProperties: { $pinia: { _s: Map<string, unknown> } }
          }
        }
      }
    ).__vue_app__.config.globalProperties.$pinia._s.get(
      'agentWorkflowTabBinding'
    ) as WorkflowTabBindingStore
    const tabPath = store.tabPathFor(id)
    if (tabPath === undefined)
      throw new Error(`no bound tab path for workflow ${id}`)
    store.unbindWorkflow(id)
    return tabPath
  }, workflowId)
}

function restoreWorkflowScope(
  page: Page,
  workflowId: string,
  tabPath: string
): Promise<void> {
  return page.evaluate(
    ({ id, path }) => {
      const store = (
        document.getElementById('vue-app') as unknown as {
          __vue_app__: {
            config: {
              globalProperties: { $pinia: { _s: Map<string, unknown> } }
            }
          }
        }
      ).__vue_app__.config.globalProperties.$pinia._s.get(
        'agentWorkflowTabBinding'
      ) as WorkflowTabBindingStore
      store.bind(id, path)
    },
    { id: workflowId, path: tabPath }
  )
}

test.describe(
  'Agent delete and clear operations',
  { tag: ['@cloud', '@vue-nodes'] },
  () => {
    test.describe('delete_node', () => {
      test.use({ conversationCase: 'agent-rec-add-set-delete' })

      test('removes the requested node while preserving the workflow', async ({
        agentConversation
      }) => {
        test.setTimeout(90_000)

        await agentConversation.runTurns()

        await expect(agentConversation.vueNodes.nodes).toHaveCount(5)
        await expect(
          agentConversation.vueNodes.getNodeLocator('2785690574723683')
        ).toHaveCount(0)
      })
    })

    test.describe('clear_canvas', () => {
      test.use({ conversationCase: 'agent-rec-clear-workflow' })

      test('leaves the canvas empty after clearing the workflow', async ({
        agentConversation
      }) => {
        test.setTimeout(90_000)

        await agentConversation.runTurns()

        await expect(agentConversation.vueNodes.nodes).toHaveCount(0)
      })

      test('clears the canvas on its own after the clear frame is rejected for a dropped workflow scope', async ({
        agentConversation,
        page
      }) => {
        test.setTimeout(90_000)
        const workflowId = agentConversation.conversation.workflow.id
        let tabPath: string | undefined

        await agentConversation.sendPrompt(0)
        await agentConversation.replayResponse(0, undefined, async (index) => {
          const entry = agentConversation.conversation.turns[0].response[index]
          if (entry.kind !== 'graph_ops') return
          if (!entry.ops.some((op) => op.op === 'clear')) return
          // The workflow tab binding drives production `getScope()`
          // (AgentPanelRoot.vue): dropping it here reproduces the exact race
          // this PR fixes without touching the doc or sending another frame.
          tabPath = await dropWorkflowScope(page, workflowId)
        })
        await agentConversation.waitForTurnComplete()

        // The clear batch was rejected for lack of scope: the seed workflow's
        // nodes are still on screen.
        await expect(agentConversation.vueNodes.nodes).not.toHaveCount(0)

        if (tabPath === undefined)
          throw new Error('the clear frame never armed the scope drop')
        await restoreWorkflowScope(page, workflowId, tabPath)

        // The self-driven retry clears the canvas on its own; nothing sends
        // another frame after this point.
        await expect(agentConversation.vueNodes.nodes).toHaveCount(0)
      })
    })
  }
)
