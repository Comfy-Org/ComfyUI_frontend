import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'
import { PerformanceMonitor } from '../helpers/performanceMonitor'

// If an input is optional by node definition, it should be shown as
// a hollow circle no matter what shape it was defined in the workflow JSON.
test.describe('Optional input', () => {
  test('@perf No shape specified', async ({ comfyPage }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'optional-input-no-shape'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation('load-workflow', async () => {
      await comfyPage.loadWorkflow('optional_input_no_shape')
    })

    await expect(comfyPage.canvas).toHaveScreenshot('optional_input.png')

    await perfMonitor.finishMonitoring(testName)
  })

  test('@perf Wrong shape specified', async ({ comfyPage }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'optional-input-wrong-shape'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation('load-workflow', async () => {
      await comfyPage.loadWorkflow('optional_input_wrong_shape')
    })

    await expect(comfyPage.canvas).toHaveScreenshot('optional_input.png')

    await perfMonitor.finishMonitoring(testName)
  })

  test('@perf Correct shape specified', async ({ comfyPage }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'optional-input-correct-shape'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation('load-workflow', async () => {
      await comfyPage.loadWorkflow('optional_input_correct_shape')
    })

    await expect(comfyPage.canvas).toHaveScreenshot('optional_input.png')

    await perfMonitor.finishMonitoring(testName)
  })

  test('@perf Force input', async ({ comfyPage }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'force-input'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation('load-workflow', async () => {
      await comfyPage.loadWorkflow('force_input')
    })

    await expect(comfyPage.canvas).toHaveScreenshot('force_input.png')

    await perfMonitor.finishMonitoring(testName)
  })

  test('@perf Default input', async ({ comfyPage }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'default-input'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation('load-workflow', async () => {
      await comfyPage.loadWorkflow('default_input')
    })

    await expect(comfyPage.canvas).toHaveScreenshot('default_input.png')

    await perfMonitor.finishMonitoring(testName)
  })

  test('@perf Only optional inputs', async ({ comfyPage }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'only-optional-inputs'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation('load-workflow', async () => {
      await comfyPage.loadWorkflow('only_optional_inputs')
    })

    let nodeCount: number
    await perfMonitor.measureOperation('get-nodes-count', async () => {
      nodeCount = await comfyPage.getGraphNodesCount()
    })
    expect(nodeCount!).toBe(1)

    await expect(
      comfyPage.page.locator('.comfy-missing-nodes')
    ).not.toBeVisible()

    // If the node's multiline text widget is visible, then it was loaded successfully
    await expect(comfyPage.page.locator('.comfy-multiline-input')).toHaveCount(
      1
    )

    await perfMonitor.finishMonitoring(testName)
  })
  test('@perf Old workflow with converted input', async ({ comfyPage }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'old-workflow-converted-input'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation('load-workflow', async () => {
      await comfyPage.loadWorkflow('old_workflow_converted_input')
    })

    let node: any
    await perfMonitor.measureOperation('get-node', async () => {
      node = await comfyPage.getNodeRefById('1')
    })

    let inputs: any
    await perfMonitor.measureOperation('get-node-inputs', async () => {
      inputs = await node.getProperty('inputs')
    })

    const vaeInput = inputs.find((w) => w.name === 'vae')
    const convertedInput = inputs.find((w) => w.name === 'strength')

    expect(vaeInput).toBeDefined()
    expect(convertedInput).toBeDefined()
    expect(vaeInput.link).toBeNull()
    expect(convertedInput.link).not.toBeNull()

    await perfMonitor.finishMonitoring(testName)
  })
  test('@perf Renamed converted input', async ({ comfyPage }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'renamed-converted-input'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation('load-workflow', async () => {
      await comfyPage.loadWorkflow('renamed_converted_widget')
    })

    let node: any
    await perfMonitor.measureOperation('get-node', async () => {
      node = await comfyPage.getNodeRefById('3')
    })

    let inputs: any
    await perfMonitor.measureOperation('get-node-inputs', async () => {
      inputs = await node.getProperty('inputs')
    })

    const renamedInput = inputs.find((w) => w.name === 'breadth')
    expect(renamedInput).toBeUndefined()

    await perfMonitor.finishMonitoring(testName)
  })
  test('@perf slider', async ({ comfyPage }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'simple-slider'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation('load-workflow', async () => {
      await comfyPage.loadWorkflow('simple_slider')
    })

    await expect(comfyPage.canvas).toHaveScreenshot('simple_slider.png')

    await perfMonitor.finishMonitoring(testName)
  })
  test('@perf unknown converted widget', async ({ comfyPage }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'unknown-converted-widget'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation('set-setting', async () => {
      await comfyPage.setSetting(
        'Comfy.Workflow.ShowMissingNodesWarning',
        false
      )
    })

    await perfMonitor.measureOperation('load-workflow', async () => {
      await comfyPage.loadWorkflow('missing_nodes_converted_widget')
    })

    await expect(comfyPage.canvas).toHaveScreenshot(
      'missing_nodes_converted_widget.png'
    )

    await perfMonitor.finishMonitoring(testName)
  })
  test('@perf dynamically added input', async ({ comfyPage }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'dynamically-added-input'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation('load-workflow', async () => {
      await comfyPage.loadWorkflow('dynamically_added_input')
    })

    await expect(comfyPage.canvas).toHaveScreenshot(
      'dynamically_added_input.png'
    )

    await perfMonitor.finishMonitoring(testName)
  })
})
