import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import {
  comfyExpect as expect,
  comfyPageFixture
} from '@e2e/fixtures/ComfyPage'
import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'
import { TestIds } from '@e2e/fixtures/selectors'
import {
  mergeComboInputOptions,
  routeObjectInfoFromSetupApi,
  setComboInputOptions
} from '@e2e/fixtures/utils/objectInfo'
import { assetPath } from '@e2e/fixtures/utils/paths'
import enMessages from '@/locales/en/main.json' with { type: 'json' }

const SAVED_IMAGE = 'example.png'
const ADDED_IMAGE = 'media_list_second.png'

const test = comfyPageFixture.extend({
  page: async ({ page }, use) => {
    const unrouteObjectInfo = await routeObjectInfoFromSetupApi(
      page,
      (objectInfo) => {
        setComboInputOptions(objectInfo, 'LoadImage', 'image', [
          SAVED_IMAGE,
          ADDED_IMAGE
        ])
        mergeComboInputOptions(objectInfo, 'LoadImage', 'image', {
          min: 0,
          max: 2
        })
      }
    )
    await page.route('**/internal/files/input**', (route) =>
      route.fulfill({ json: [SAVED_IMAGE, ADDED_IMAGE] })
    )
    await page.route(`**/view?*filename=${ADDED_IMAGE}*`, (route) =>
      route.fulfill({ path: assetPath('test_upload_image.png') })
    )

    try {
      await use(page)
    } finally {
      await unrouteObjectInfo()
    }
  }
})

function getPicker({ page, vueNodes }: ComfyPage) {
  const menu = page.getByTestId(TestIds.widgets.formDropdownMenu)
  const order = menu.getByRole('list', {
    name: enMessages.widgets.uploadSelect.selectionOrder
  })
  return {
    trigger: vueNodes
      .getNodeByTitle('Load Image')
      .getByRole('button', { name: 'image', exact: true }),
    menu,
    order,
    entry: (position: number, name: string) =>
      order.getByRole('listitem', { name: `${position}. ${name}`, exact: true })
  }
}

async function queuePrompt(comfyPage: ComfyPage): Promise<unknown> {
  let requestBody: unknown
  await new ExecutionHelper(comfyPage).run({
    onPromptRequest: (body) => {
      requestBody = body
    }
  })
  return requestBody
}

test.describe(
  'Vue media list picker',
  { tag: ['@vue-nodes', '@widget'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('widgets/load_image_widget')
    })

    test('queues the selected images in the order they were dragged into', async ({
      comfyPage
    }) => {
      const { trigger, menu, order, entry } = getPicker(comfyPage)
      await trigger.click()
      await menu.getByText(ADDED_IMAGE, { exact: true }).click()
      await expect(order.getByRole('listitem')).toHaveCount(2)
      await expect(entry(1, SAVED_IMAGE)).toBeVisible()

      await entry(2, ADDED_IMAGE).dragTo(entry(1, SAVED_IMAGE))

      await expect(entry(1, ADDED_IMAGE)).toBeVisible()
      await expect(entry(2, SAVED_IMAGE)).toBeVisible()
      await expect(trigger).toContainText(`${ADDED_IMAGE}, ${SAVED_IMAGE}`)
      expect(await queuePrompt(comfyPage)).toMatchObject({
        prompt: {
          '10': { inputs: { image: { __value__: [ADDED_IMAGE, SAVED_IMAGE] } } }
        }
      })
    })

    test('moves the focused image with the arrow keys and keeps it focused', async ({
      comfyPage
    }) => {
      const { trigger, menu, entry } = getPicker(comfyPage)
      await trigger.click()
      await menu.getByText(ADDED_IMAGE, { exact: true }).click()

      await entry(2, ADDED_IMAGE).focus()
      await comfyPage.page.keyboard.press('ArrowLeft')

      await expect(entry(2, SAVED_IMAGE)).toBeVisible()
      await expect(entry(1, ADDED_IMAGE)).toBeFocused()
    })

    test('queues an empty list once every image is deselected', async ({
      comfyPage
    }) => {
      const { trigger, menu, order } = getPicker(comfyPage)
      await expect(trigger).toContainText(SAVED_IMAGE)
      await trigger.click()

      await menu.getByText(SAVED_IMAGE, { exact: true }).click()

      await expect(order).toBeHidden()
      await expect(trigger).toContainText(
        enMessages.widgets.uploadSelect.placeholderImage
      )
      expect(await queuePrompt(comfyPage)).toMatchObject({
        prompt: { '10': { inputs: { image: { __value__: [] } } } }
      })
    })
  }
)
