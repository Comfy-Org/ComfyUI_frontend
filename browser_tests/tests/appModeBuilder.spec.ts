import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'
import {
  dismissErrorOverlay,
  enableErrorsOverlay
} from '@e2e/fixtures/helpers/ErrorsTabHelper'
import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'

test.describe('App mode builder selection', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.appMode.enableLinearMode()
  })

  test(
    'Can independently select inputs of same name',
    {
      tag: '@vue-nodes'
    },
    async ({ comfyPage }) => {
      const items = comfyPage.appMode.select.inputItems

      await comfyPage.vueNodes.selectNodes(['6', '7'])
      await comfyPage.command.executeCommand('Comfy.Graph.ConvertToSubgraph')

      await comfyPage.appMode.enterBuilder()
      await comfyPage.appMode.steps.goToInputs()
      await expect(items).toHaveCount(0)

      const prompts = comfyPage.vueNodes
        .getNodeByTitle('New Subgraph')
        .locator('.lg-node-widget')
      const count = await prompts.count()
      for (let i = 0; i < count; i++) {
        await expect(prompts.nth(i)).toBeVisible()
        await prompts.nth(i).click()
        await expect(items).toHaveCount(i + 1)
      }
    }
  )

  test('Can select outputs', async ({ comfyPage }) => {
    await comfyPage.appMode.enterBuilder()
    await comfyPage.appMode.steps.goToOutputs()

    await comfyPage.nodeOps
      .getNodeRefById('9')
      .then((ref) => ref.centerOnNode())
    const saveImage = await comfyPage.vueNodes.getNodeLocator('9')
    await saveImage.click()

    const items = comfyPage.appMode.select.inputItems
    await expect(items).toHaveCount(1)
  })

  test(
    'Can add description to widgets',
    { tag: '@vue-nodes' },
    async ({ comfyPage }) => {
      const descLocator =
        comfyPage.appMode.widgets.getWidgetDescription('6:text')

      await test.step('set up baseline app', async () => {
        await comfyPage.appMode.enterAppModeWithInputs([['6', 'text']])
        await expect(descLocator, 'Empty description hidden').toBeHidden()
      })

      const description = "Don't forget the massive fennec ears!"

      await test.step('Enter builder and add description', async () => {
        await comfyPage.appMode.enterBuilder()
        await comfyPage.appMode.steps.goToPreview()
        await expect(
          descLocator,
          'Display placeholder in builder'
        ).toBeVisible()

        await descLocator.dblclick()
        await descLocator.locator('input').fill(description)
        await descLocator.locator('input').blur()
        await expect(descLocator, 'Description updates').toHaveText(description)
      })

      await test.step('Exit builder and return to app mode', async () => {
        await comfyPage.appMode.footer.exitBuilder()
        await comfyPage.appMode.toggleAppMode()
        await expect(descLocator, 'Description displays').toHaveText(
          description
        )
      })

      await test.step('Swap workflows to test persistance', async () => {
        await comfyPage.appMode.toggleAppMode()
        await comfyPage.menu.topbar.getTab(0).click()
        await comfyPage.menu.topbar.getTab(1).click()
        await comfyPage.appMode.toggleAppMode()
        await expect(descLocator, 'Description persists').toHaveText(
          description
        )
      })
    }
  )

  test(
    'Can not select a node with an error',
    {
      tag: '@vue-nodes'
    },
    async ({ comfyPage }) => {
      // This test seeds a real error through a prompt round trip, on top of the
      // errors-overlay setting and the builder navigation.
      test.slow()
      // Without the errors tab, a failed prompt raises a modal error dialog
      // instead, and a modal makes the topbar inert (app.ts:1754).
      await enableErrorsOverlay(comfyPage)

      const [checkpointLoader] = await comfyPage.nodeOps.getNodeRefsByType(
        'CheckpointLoaderSimple'
      )
      await new ExecutionHelper(comfyPage).mockValidationFailure({
        [String(checkpointLoader.id)]: {
          class_type: 'CheckpointLoaderSimple',
          dependent_outputs: [],
          errors: [
            {
              type: 'value_not_in_list',
              message: 'Value not in list',
              details: '',
              extra_info: { input_name: 'ckpt_name' }
            }
          ]
        }
      })
      await comfyPage.runButton.click()
      await dismissErrorOverlay(comfyPage)

      // The error ring is the user-visible signal that the store took the error;
      // waiting on it keeps the builder assertions below from racing the response.
      await expect(
        comfyPage.vueNodes.getNodeInnerWrapper(String(checkpointLoader.id))
      ).toHaveClass(/ring-destructive-background/)

      const items = comfyPage.appMode.select.inputItems
      await comfyPage.appMode.enterBuilder()
      await comfyPage.appMode.steps.goToInputs()

      await comfyPage.appMode.select.selectInputWidget(
        'Load Checkpoint',
        'ckpt_name'
      )
      await expect(items).toHaveCount(0)
    }
  )

  test(
    'Can not select note nodes',
    {
      tag: '@vue-nodes'
    },
    async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('nodes/note_nodes')

      const items = comfyPage.appMode.select.inputItems
      await comfyPage.appMode.enterBuilder()
      await comfyPage.appMode.steps.goToInputs()

      await comfyPage.appMode.select.selectInputWidget('Note', 'text')
      await comfyPage.appMode.select.selectInputWidget('Markdown Note', 'text')

      await expect(items).toHaveCount(0)
    }
  )

  test('Marks canvas readOnly', async ({ comfyPage }) => {
    await comfyPage.searchBoxV2.openByDoubleClickCanvas()
    await expect(
      comfyPage.searchBoxV2.input,
      'Canvas is initially editable'
    ).toBeVisible()
    await comfyPage.page.keyboard.press('Escape')

    await comfyPage.appMode.enterBuilder()
    await comfyPage.appMode.steps.goToInputs()

    await comfyPage.searchBoxV2.openByDoubleClickCanvas()
    await expect(
      comfyPage.searchBoxV2.input,
      'Entering builder makes the canvas readonly'
    ).toBeHidden()

    await comfyPage.page.keyboard.press('Space')
    await comfyPage.searchBoxV2.openByDoubleClickCanvas()
    await expect(
      comfyPage.searchBoxV2.input,
      'Canvas remains readonly after pressing space'
    ).toBeHidden()

    const ksampler = await comfyPage.vueNodes.getFixtureByTitle('KSampler')
    // oxlint-disable-next-line playwright/no-force-option -- Node container has conditional pointer-events:none that blocks actionability
    await ksampler.header.dblclick({ force: true })
    await expect(
      ksampler.titleEditor.input,
      'Double clicking node titles will not initiate a rename'
    ).toBeHidden()

    await comfyPage.page.keyboard.press('Escape')
    await comfyPage.searchBoxV2.openByDoubleClickCanvas()
    await expect(
      comfyPage.searchBoxV2.input,
      'Canvas is no longer readonly after exiting'
    ).toBeVisible()
  })
})
