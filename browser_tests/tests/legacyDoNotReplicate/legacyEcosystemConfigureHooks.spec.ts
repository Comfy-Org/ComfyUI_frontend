import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import { test } from '@e2e/fixtures/ecosystemSimulacraFixture'
import {
  activeRootId,
  captureUndoCheckpoint,
  readEcosystemSimulacra,
  undoQueueLength,
  undoWorkflowInBackground
} from '@e2e/fixtures/utils/ecosystemSimulacra'
import {
  openSecondWorkflowTab,
  switchToWorkflowTab
} from '@e2e/fixtures/utils/legacyGraphInstancePatches'

test.describe(
  'Configure hooks on retained workflows',
  { tag: '@canvas' },
  () => {
    test('switching back to a retained workflow fires only the load hooks', async ({
      comfyPage
    }) => {
      const firstRoot = await activeRootId(comfyPage)
      await openSecondWorkflowTab(comfyPage)
      const secondRoot = await activeRootId(comfyPage)
      const before = (await readEcosystemSimulacra(comfyPage)).lifecycle.length

      await switchToWorkflowTab(comfyPage, 0)

      expect(
        (await readEcosystemSimulacra(comfyPage)).lifecycle.slice(before)
      ).toEqual([
        { hook: 'beforeLoadGraph', configured: null, active: secondRoot },
        { hook: 'afterLoadGraph', configured: null, active: firstRoot }
      ])
    })

    test.fail(
      'Lora-Manager-style afterConfigureGraph registry follows a switch back to a retained workflow',
      async ({ comfyPage }) => {
        const firstRoot = await activeRootId(comfyPage)
        await comfyPage.workflow.newBlankWorkflow()
        const secondRoot = await activeRootId(comfyPage)
        expect((await readEcosystemSimulacra(comfyPage)).registry?.graph).toBe(
          secondRoot
        )

        await switchToWorkflowTab(comfyPage, 0)

        expect((await readEcosystemSimulacra(comfyPage)).registry?.graph).toBe(
          firstRoot
        )
      }
    )

    test.describe('background undo', () => {
      test.beforeEach(async ({ comfyPage }) => {
        await comfyPage.workflow.newBlankWorkflow()
        await comfyPage.nodeOps.addNode('KSampler')
        await captureUndoCheckpoint(comfyPage)
        await expect.poll(() => undoQueueLength(comfyPage)).toBeGreaterThan(0)
      })

      test('configure hooks name the background graph and load hooks stay silent', async ({
        comfyPage
      }) => {
        const secondRoot = await activeRootId(comfyPage)
        await switchToWorkflowTab(comfyPage, 0)
        const firstRoot = await activeRootId(comfyPage)
        const before = (await readEcosystemSimulacra(comfyPage)).lifecycle
          .length

        await undoWorkflowInBackground(comfyPage, 1)

        const hooks = (await readEcosystemSimulacra(comfyPage)).lifecycle.slice(
          before
        )
        expect(
          hooks.filter((entry) => entry.hook !== 'loadedGraphNode')
        ).toEqual([
          {
            hook: 'beforeConfigureGraph',
            configured: secondRoot,
            active: firstRoot
          },
          {
            hook: 'afterConfigureGraph',
            configured: secondRoot,
            active: firstRoot
          }
        ])
      })

      test.fail(
        'Lora-Manager-style afterConfigureGraph registry reads the graph the undo configured',
        async ({ comfyPage }) => {
          const secondRoot = await activeRootId(comfyPage)
          await switchToWorkflowTab(comfyPage, 0)

          await undoWorkflowInBackground(comfyPage, 1)

          expect((await readEcosystemSimulacra(comfyPage)).registry).toEqual({
            graph: secondRoot,
            nodes: []
          })
        }
      )
    })
  }
)
