import { expect } from '@playwright/test'
import type { Locator } from '@playwright/test'

import { hashPath } from '@/platform/workflow/persistence/base/hashUtil'
import { nativeLoraDraftReady } from '@e2e/fixtures/helpers/nativeLoraDraftReady'
import { LocalDesktopTarget } from '@e2e/fixtures/customNode/ComfyTarget'
import { createCloudAssetsFixture } from '@e2e/fixtures/assetApiFixture'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { WidgetSelectDropdownFixture } from '@e2e/fixtures/components/WidgetSelectDropdown'
import { NATIVE_LORA_ASSETS } from '@e2e/fixtures/data/nativeLoraAssets'

class NativeLoraHelper {
  constructor(private readonly comfyPage: ComfyPage) {}

  get node() {
    return this.comfyPage.vueNodes.getNodeLocator('1')
  }

  row(number: number) {
    return this.node.getByRole('group', {
      name: `LoRA #${number}`,
      exact: true
    })
  }

  picker(number: number) {
    return new WidgetSelectDropdownFixture(this.row(number))
  }

  promotedPicker(host: Locator, number: number) {
    return new WidgetSelectDropdownFixture(
      this.comfyPage.vueNodes.getWidgetRowByLabel(
        host,
        `LoRA #${number} lora_name`
      )
    )
  }

  async populate() {
    await this.picker(1).selectOption('A.safetensors')
    await this.node.getByRole('button', { name: 'Add LoRA' }).click()
    await this.picker(2).selectOption('B.safetensors')
    await this.node.getByRole('button', { name: 'Add LoRA' }).click()
    await this.picker(3).selectOption('C.safetensors')
    await this.row(3).getByRole('spinbutton').fill('0.5')
    await this.row(3).getByRole('spinbutton').blur()
  }

  async promoteRow(number: number) {
    for (const field of ['lora_name', 'strength', 'enabled']) {
      await this.comfyPage.contextMenu.openFor(
        this.row(number).getByText(field, { exact: true })
      )
      await this.comfyPage.contextMenu.clickMenuItemExact(
        `Promote Widget: LoRA #${number} ${field}`
      )
    }
  }

  async promoteHostRow(title: string, number: number) {
    for (const field of ['lora_name', 'strength', 'enabled']) {
      const label = `LoRA #${number} ${field}`
      const row = this.comfyPage.vueNodes.getWidgetRowByLabel(title, label)
      await this.comfyPage.contextMenu.openFor(
        row.getByText(label, { exact: true })
      )
      await this.comfyPage.contextMenu.clickMenuItemExact(
        `Promote Widget: ${label}`
      )
    }
  }

  async expectNames(names: string[]) {
    const pickers = this.node.getByRole('group', { name: /^LoRA #\d+$/ })
    await expect(pickers).toHaveCount(names.length)
    for (const [index, name] of names.entries()) {
      await expect(this.picker(index + 1).selection).toHaveText(name)
    }
  }

  async waitForDraftPersisted() {
    const path = await this.comfyPage.workflow.getActiveWorkflowPath()
    if (!path) throw new Error('No active workflow to persist')
    const expected = await this.comfyPage.workflow.getExportedWorkflow()
    await this.comfyPage.page.waitForFunction(nativeLoraDraftReady, {
      path,
      draftKey: hashPath(path),
      expected
    })
  }

  async execute(expected: string) {
    const result = await new LocalDesktopTarget().runWorkflow(
      this.comfyPage.page,
      {
        expectedNodeIds: ['2'],
        timeoutMs: 30_000
      }
    )
    expect(result.outcome, JSON.stringify(result)).toBe('PASS')
    expect(result.outputsByNode['2']).toMatchObject({ text: [expected] })
    await expect(
      this.comfyPage.vueNodes.getNodeLocator('2').getByRole('textbox')
    ).toHaveValue(expected)
  }
}

export const nativeLoraTest = createCloudAssetsFixture(
  NATIVE_LORA_ASSETS
).extend<{
  lora: NativeLoraHelper
}>({
  lora: async ({ comfyPage }, use) => {
    await use(new NativeLoraHelper(comfyPage))
  }
})
