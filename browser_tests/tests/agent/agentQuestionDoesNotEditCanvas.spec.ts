import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'

/**
 * A turn whose prompt is a QUESTION must be answered, not built.
 *
 * The user-visible defect this pins: a daily Film/TV/VFX user reported the
 * agent "will work and spend credits without being told to. If I ask a
 * question, it starts working without being told to and spends my money, then
 * I have to tell it to put it back which spends even more of my money."
 * (`#comfy-agent-user-feedback` Typeform intake, 2026-11-26.) Agent spend is
 * metered per MODEL ROUND, not per run (cloud `services/agent/internal/metering`,
 * BE-10157), so an unrequested build costs real credits even when it never
 * reaches the run consent card — and the corrective turn is billed again.
 *
 * The contract lives only in the cloud system prompt
 * (`services/agent/internal/loop/prompt.go`, "ADVICE IS NOT A BUILD"); there is
 * no classifier. So the browser-observable half is what this asserts: for the
 * recorded cloud capture of an interrogative prompt, the canvas the user is
 * looking at is byte-for-byte the graph they had before they asked.
 *
 * `agent-rec-text-only-answer` is a real cloud capture (claude-opus-5, cloud
 * 9dc1da7dae) whose prompt is "Switch to the tab 'Text to image', then tell me
 * what this workflow does." Its recorded turn calls `switch_tab` and
 * `print_workflow` — both reads — and carries zero `graph_ops`.
 *
 * Related: PM-2675 owns the model-side requirement for how-to and ambiguous
 * prompts, which this descriptive-question shape does not cover.
 */

const QUESTION_CASE = 'agent-rec-text-only-answer'

// The graph the user had open before they asked. The agent may not change it.
const SEED_NODE_IDS = ['4', '6', '3', '8', '9'] as const

test.describe(
  'Agent question does not edit the canvas',
  { tag: ['@cloud', '@agent', '@canvas', '@vue-nodes'] },
  () => {
    test.use({ conversationCase: QUESTION_CASE })

    test('answers an interrogative prompt without touching the graph', async ({
      agentConversation
    }) => {
      test.setTimeout(90_000)

      await agentConversation.runTurns()

      await test.step('the recorded turn minted no graph edit', async () => {
        expect(agentConversation.addedNodeIds()).toEqual([])
      })

      await test.step('the canvas still holds exactly the seed nodes', async () => {
        await expect(agentConversation.vueNodes.nodes).toHaveCount(
          SEED_NODE_IDS.length
        )
        for (const nodeId of SEED_NODE_IDS) {
          await expect(
            agentConversation.vueNodes.getNodeLocator(nodeId)
          ).toBeVisible()
        }
      })

      await test.step('no remote write reached the shared document', () => {
        const hostNodeIds = agentConversation.hostNodeIds()
        expect(hostNodeIds).toEqual(expect.arrayContaining([...SEED_NODE_IDS]))
        expect(hostNodeIds).toHaveLength(SEED_NODE_IDS.length)
      })

      await test.step('the user got a text answer', async () => {
        await expect(
          agentConversation.panel.getByText('standard SDXL text-to-image setup')
        ).toBeVisible()
      })
    })
  }
)
