import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import {
  largeLoraComboTest as test,
  loraCombo
} from '@e2e/fixtures/largeLoraComboFixture'
import { recordMeasurement } from '@e2e/fixtures/utils/perfReporter'

test.describe('Large combo widget', { tag: ['@vue-nodes', '@perf'] }, () => {
  test('open a 10k-option combo', async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('vueNodes/large-lora-stack')
    const combo = loraCombo(comfyPage, 'LoRA deep')

    await comfyPage.perf.startMeasuring()
    await combo.open()
    await expect(combo.options.first()).toBeVisible()
    recordMeasurement(await comfyPage.perf.stopMeasuring('large-combo-open'))
  })
})
