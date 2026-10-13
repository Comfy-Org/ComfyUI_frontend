import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import {
  DEEP_LORA,
  FIRST_LORA,
  LONG_LORA,
  LORA_COUNT,
  LORA_NAMES,
  SEARCH_HITS,
  largeLoraComboTest as test,
  loraCombo
} from '@e2e/fixtures/largeLoraComboFixture'

test.describe(
  'Vue combo widget with 10k options',
  { tag: ['@vue-nodes', '@widget'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('vueNodes/large-lora-stack')
    })

    test('renders only a window of the options, also while searching', async ({
      comfyPage
    }) => {
      const combo = loraCombo(comfyPage, 'LoRA first')
      await combo.open()

      await expect(combo.options.first()).toHaveAttribute(
        'aria-setsize',
        String(LORA_COUNT)
      )
      await expect.poll(() => combo.options.count()).toBeLessThan(100)

      await combo.searchInput.fill('sdxl/')
      await expect(combo.options.first()).toHaveAttribute(
        'aria-setsize',
        String(LORA_NAMES.filter((name) => name.includes('sdxl/')).length)
      )
      await expect.poll(() => combo.options.count()).toBeLessThan(100)
    })

    test('opening reveals and highlights a selected value deep in the list', async ({
      comfyPage
    }) => {
      const combo = loraCombo(comfyPage, 'LoRA deep')
      await combo.open()

      const selected = combo.menu.getByRole('option', {
        name: DEEP_LORA,
        exact: true,
        selected: true
      })
      await expect(selected).toBeInViewport()
      await expect(selected).toHaveAttribute('data-highlighted')
    })

    test('selecting a far value by search records history and is revealed on reopen', async ({
      comfyPage
    }) => {
      const target = SEARCH_HITS[2]
      const combo = loraCombo(comfyPage, 'LoRA first')
      const widget = await (
        await comfyPage.nodeOps.getNodeRefById(2)
      ).getWidgetByName('lora_name')

      await test.step('search narrows 10k names to the matches', async () => {
        await combo.open()
        await combo.searchInput.fill('miku')
        await expect(combo.options).toHaveText(SEARCH_HITS)
      })

      await test.step('clicking a match selects it', async () => {
        await combo.options.getByText(target, { exact: true }).click()
        await expect(combo.menu).toBeHidden()
        await expect(combo.trigger).toHaveText(target)
        await expect.poll(() => widget.getValue()).toBe(target)
      })

      await test.step('reopening reveals the selection', async () => {
        await combo.open()
        await expect(
          combo.menu.getByRole('option', { name: target, selected: true })
        ).toBeInViewport()
        await combo.close()
      })

      await test.step('undo restores the previous value', async () => {
        await comfyPage.page.keyboard.press('ControlOrMeta+z')
        await expect.poll(() => widget.getValue()).toBe(FIRST_LORA)
      })
    })

    test('keyboard navigation reaches both ends of the list', async ({
      comfyPage
    }) => {
      const combo = loraCombo(comfyPage, 'LoRA first')
      const widget = await (
        await comfyPage.nodeOps.getNodeRefById(2)
      ).getWidgetByName('lora_name')
      const option = (name: string) =>
        combo.menu.getByRole('option', { name, exact: true })
      await combo.open()

      await test.step('End highlights the last option', async () => {
        await comfyPage.page.keyboard.press('End')
        await expect(option(LORA_NAMES[LORA_COUNT - 1])).toHaveAttribute(
          'data-highlighted'
        )
      })

      await test.step('Home and ArrowDown highlight the second option', async () => {
        await comfyPage.page.keyboard.press('Home')
        await expect(option(LORA_NAMES[0])).toHaveAttribute('data-highlighted')
        await comfyPage.page.keyboard.press('ArrowDown')
        await expect(option(LORA_NAMES[1])).toHaveAttribute('data-highlighted')
      })

      await test.step('Enter selects the highlighted option', async () => {
        await comfyPage.page.keyboard.press('Enter')
        await expect.poll(() => widget.getValue()).toBe(LORA_NAMES[1])
      })
    })

    test('a very long name keeps the popup inside the viewport', async ({
      comfyPage
    }) => {
      const combo = loraCombo(comfyPage, 'LoRA first')
      await combo.open()
      await combo.searchInput.fill('extremely_long')

      await expect(combo.options).toHaveText([LONG_LORA])
      await expect(combo.menu).toBeInViewport({ ratio: 1 })
    })
  }
)
