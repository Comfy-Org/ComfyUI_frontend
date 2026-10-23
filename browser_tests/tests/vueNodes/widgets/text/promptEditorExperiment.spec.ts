import { mergeTests } from '@playwright/test'

import {
  comfyExpect as expect,
  comfyPageFixture
} from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { hostTelemetryFixture } from '@e2e/fixtures/hostTelemetryFixture'
import type { CapturedTelemetryEvent } from '@e2e/fixtures/hostTelemetryFixture'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

const test = mergeTests(comfyPageFixture, hostTelemetryFixture).extend<{
  promptEditorArm: 'control' | 'panel'
}>({
  promptEditorArm: ['control', { option: true }],
  page: async ({ page, promptEditorArm }, use) => {
    await page.route('**/api/features', (route) =>
      route.fulfill(
        jsonRoute({
          enable_telemetry: true,
          'prompt-editor-surface': promptEditorArm
        })
      )
    )
    await use(page)
  }
})

function clipNodes(comfyPage: ComfyPage) {
  return comfyPage.vueNodes.getNodeByTitle('CLIP Text Encode (Prompt)')
}

async function expandPrompt(comfyPage: ComfyPage, index: number) {
  const node = clipNodes(comfyPage).nth(index)
  await node.getByRole('textbox', { name: 'text' }).hover()
  await node.getByRole('button', { name: 'Expand' }).click()
}

function promptEditorEvents(events: CapturedTelemetryEvent[]) {
  return events.filter(({ event }) => event.startsWith('app:prompt_editor_'))
}

test.describe(
  'Prompt editor experiment',
  { tag: ['@cloud', '@vue-nodes', '@widget'] },
  () => {
    test.describe('dialog arm', () => {
      test.use({ promptEditorArm: 'control' })

      test('edits in the dialog and reports the session', async ({
        comfyPage,
        hostTelemetry
      }) => {
        await expandPrompt(comfyPage, 0)
        const dialog = comfyPage.page.getByRole('dialog')
        await dialog.getByRole('textbox').pressSequentially('sky ')
        await comfyPage.page.keyboard.press('Escape')
        await expect(dialog).toBeHidden()

        await expect
          .poll(() => promptEditorEvents(hostTelemetry))
          .toEqual([
            {
              event: 'app:prompt_editor_exposure',
              properties: { '$feature/prompt-editor-surface': 'control' }
            },
            {
              event: 'app:prompt_editor_opened',
              properties: {
                surface: 'dialog',
                trigger: 'expand_button',
                '$feature/prompt-editor-surface': 'control'
              }
            },
            {
              event: 'app:prompt_editor_closed',
              properties: {
                surface: 'dialog',
                trigger: 'expand_button',
                '$feature/prompt-editor-surface': 'control',
                duration_ms: expect.any(Number),
                input_count: 4,
                node_switch_count: 0
              }
            }
          ])
      })
    })

    test.describe('panel arm', () => {
      test.use({ promptEditorArm: 'panel' })

      test('edits in the prompt panel, follows the selection and reports the session', async ({
        comfyPage,
        hostTelemetry
      }) => {
        const panel = comfyPage.page.getByTestId('prompt-panel')
        const editor = panel.getByRole('textbox', { name: 'text' })
        const nodePrompt = clipNodes(comfyPage)
          .nth(0)
          .getByRole('textbox', { name: 'text' })

        await test.step('Expand opens the prompt in the right side panel', async () => {
          await expandPrompt(comfyPage, 0)
          await expect(panel).toBeVisible()
          await expect(comfyPage.page.getByRole('dialog')).toBeHidden()
          await expect(editor).toHaveValue(await nodePrompt.inputValue())
        })

        await test.step('typing in the panel writes to the node', async () => {
          await editor.pressSequentially('sky ')
          await expect(nodePrompt).toHaveValue(/^sky /)
        })

        await test.step('selecting the other prompt node follows it', async () => {
          const other = clipNodes(comfyPage).nth(1)
          await other.getByText('CLIP Text Encode (Prompt)').first().click()
          await expect(editor).toHaveValue(
            await other.getByRole('textbox', { name: 'text' }).inputValue()
          )
        })

        await test.step('closing the panel reports the session', async () => {
          await panel
            .getByRole('button', { name: 'Toggle properties panel' })
            .click()
          await expect(panel).toBeHidden()
          await expect
            .poll(() => promptEditorEvents(hostTelemetry))
            .toEqual([
              {
                event: 'app:prompt_editor_opened',
                properties: {
                  surface: 'panel',
                  trigger: 'expand_button',
                  '$feature/prompt-editor-surface': 'panel'
                }
              },
              {
                event: 'app:prompt_editor_exposure',
                properties: { '$feature/prompt-editor-surface': 'panel' }
              },
              {
                event: 'app:prompt_editor_closed',
                properties: {
                  surface: 'panel',
                  trigger: 'expand_button',
                  '$feature/prompt-editor-surface': 'panel',
                  duration_ms: expect.any(Number),
                  input_count: 4,
                  node_switch_count: 1
                }
              }
            ])
        })
      })
    })
  }
)
