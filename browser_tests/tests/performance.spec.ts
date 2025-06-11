import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'
import { PerformanceMonitor } from '../helpers/performanceMonitor'

test.describe('Performance Tests', () => {
  test('@perf Navigation performance with default workflow', async ({
    comfyPage
  }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'navigation-default-workflow'

    await perfMonitor.startMonitoring(testName)

    // Load default workflow for consistent starting state
    await perfMonitor.measureOperation('load-default-workflow', async () => {
      await comfyPage.loadWorkflow('default')
    })

    // Test basic panning operations
    await perfMonitor.measureOperation('pan-operations', async () => {
      // Pan in different directions
      await comfyPage.canvas.dispatchEvent('wheel', {
        deltaX: 100,
        deltaY: 0,
        ctrlKey: false,
        shiftKey: true
      })
      await comfyPage.nextFrame()

      await comfyPage.canvas.dispatchEvent('wheel', {
        deltaX: -100,
        deltaY: 100,
        ctrlKey: false,
        shiftKey: true
      })
      await comfyPage.nextFrame()

      await comfyPage.canvas.dispatchEvent('wheel', {
        deltaX: 0,
        deltaY: -100,
        ctrlKey: false,
        shiftKey: true
      })
      await comfyPage.nextFrame()
    })

    // Test zoom operations
    await perfMonitor.measureOperation('zoom-operations', async () => {
      // Zoom in
      await comfyPage.canvas.dispatchEvent('wheel', {
        deltaY: -100,
        ctrlKey: true
      })
      await comfyPage.nextFrame()

      // Zoom out
      await comfyPage.canvas.dispatchEvent('wheel', {
        deltaY: 100,
        ctrlKey: true
      })
      await comfyPage.nextFrame()

      // Zoom way out
      await comfyPage.canvas.dispatchEvent('wheel', {
        deltaY: 500,
        ctrlKey: true
      })
      await comfyPage.nextFrame()

      // Reset to fit
      await comfyPage.executeCommand('Comfy.Canvas.FitView')
      await comfyPage.nextFrame()
    })

    // Test viewport reset
    await perfMonitor.measureOperation('viewport-reset', async () => {
      await comfyPage.resetView()
      await comfyPage.nextFrame()
    })

    await perfMonitor.finishMonitoring(testName)
  })

  test('@perf Workflow loading performance - small workflow', async ({
    comfyPage
  }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'load-small-workflow'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation('load-img2img-default', async () => {
      await comfyPage.loadWorkflow('performance-img2img-default')
    })

    // Basic navigation after loading
    await perfMonitor.measureOperation('post-load-navigation', async () => {
      await comfyPage.executeCommand('Comfy.Canvas.FitView')
      await comfyPage.nextFrame()

      // Quick zoom test
      await comfyPage.canvas.dispatchEvent('wheel', {
        deltaY: -200,
        ctrlKey: true
      })
      await comfyPage.nextFrame()
    })

    await perfMonitor.finishMonitoring(testName)
  })

  test('@perf Workflow loading performance - large workflow', async ({
    comfyPage
  }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'load-large-workflow'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation('load-img2img-huge', async () => {
      await comfyPage.loadWorkflow('performance-img2img-huge')
    })

    // Navigation with large workflow
    await perfMonitor.measureOperation(
      'large-workflow-navigation',
      async () => {
        await comfyPage.executeCommand('Comfy.Canvas.FitView')
        await comfyPage.nextFrame()

        // Pan around the large workflow
        await comfyPage.canvas.dispatchEvent('wheel', {
          deltaX: 200,
          deltaY: 0,
          ctrlKey: false,
          shiftKey: true
        })
        await comfyPage.nextFrame()

        await comfyPage.canvas.dispatchEvent('wheel', {
          deltaX: -200,
          deltaY: 200,
          ctrlKey: false,
          shiftKey: true
        })
        await comfyPage.nextFrame()
      }
    )

    await perfMonitor.finishMonitoring(testName)
  })

  test('@perf Workflow loading performance - many nodes workflow', async ({
    comfyPage
  }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'load-many-nodes-workflow'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation(
      'load-dozens-load-image-nodes',
      async () => {
        await comfyPage.loadWorkflow('performance-dozens-load-image-nodes')
      }
    )

    // Test performance with many similar nodes
    await perfMonitor.measureOperation('many-nodes-navigation', async () => {
      // Fit to view all nodes
      await comfyPage.executeCommand('Comfy.Canvas.FitView')
      await comfyPage.nextFrame()

      // Zoom in to see details
      await comfyPage.canvas.dispatchEvent('wheel', {
        deltaY: -300,
        ctrlKey: true
      })
      await comfyPage.nextFrame()

      // Pan to explore different areas
      for (let i = 0; i < 3; i++) {
        await comfyPage.canvas.dispatchEvent('wheel', {
          deltaX: 150,
          deltaY: 100,
          ctrlKey: false,
          shiftKey: true
        })
        await comfyPage.nextFrame()
      }

      // Zoom back out
      await comfyPage.canvas.dispatchEvent('wheel', {
        deltaY: 300,
        ctrlKey: true
      })
      await comfyPage.nextFrame()
    })

    await perfMonitor.finishMonitoring(testName)
  })

  test('@perf Viewport manipulation stress test', async ({ comfyPage }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'viewport-stress-test'

    await perfMonitor.startMonitoring(testName)

    // Load a workflow for context
    await perfMonitor.measureOperation('load-test-workflow', async () => {
      await comfyPage.loadWorkflow('performance-img2img-default')
    })

    // Rapid zoom in/out cycles
    await perfMonitor.measureOperation('rapid-zoom-cycles', async () => {
      for (let i = 0; i < 5; i++) {
        // Zoom in
        await comfyPage.canvas.dispatchEvent('wheel', {
          deltaY: -150,
          ctrlKey: true
        })
        await comfyPage.nextFrame()

        // Zoom out
        await comfyPage.canvas.dispatchEvent('wheel', {
          deltaY: 150,
          ctrlKey: true
        })
        await comfyPage.nextFrame()
      }
    })

    // Rapid panning in different directions
    await perfMonitor.measureOperation('rapid-pan-cycles', async () => {
      const panDirections = [
        { deltaX: 100, deltaY: 0 },
        { deltaX: 0, deltaY: 100 },
        { deltaX: -100, deltaY: 0 },
        { deltaX: 0, deltaY: -100 }
      ]

      for (let cycle = 0; cycle < 3; cycle++) {
        for (const direction of panDirections) {
          await comfyPage.canvas.dispatchEvent('wheel', {
            deltaX: direction.deltaX,
            deltaY: direction.deltaY,
            ctrlKey: false,
            shiftKey: true
          })
          await comfyPage.nextFrame()
        }
      }
    })

    // Combined zoom and pan operations
    await perfMonitor.measureOperation('combined-operations', async () => {
      for (let i = 0; i < 4; i++) {
        // Zoom in while panning
        await comfyPage.canvas.dispatchEvent('wheel', {
          deltaY: -100,
          ctrlKey: true
        })
        await comfyPage.canvas.dispatchEvent('wheel', {
          deltaX: 50,
          deltaY: 25,
          ctrlKey: false,
          shiftKey: true
        })
        await comfyPage.nextFrame()
      }

      // Reset to clean state
      await comfyPage.executeCommand('Comfy.Canvas.FitView')
      await comfyPage.nextFrame()
    })

    await perfMonitor.finishMonitoring(testName)
  })

  test.skip('@perf Sequential workflow loading performance', async ({
    comfyPage
  }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'sequential-workflow-loading'

    await perfMonitor.startMonitoring(testName)

    const workflows = [
      'performance-img2img-default',
      'performance-dozens-load-image-nodes',
      'performance-img2img-huge'
    ]

    for (const workflow of workflows) {
      await perfMonitor.measureOperation(`load-${workflow}`, async () => {
        await comfyPage.loadWorkflow(workflow)
      })

      // Brief navigation after each load
      await perfMonitor.measureOperation(`navigate-${workflow}`, async () => {
        await comfyPage.executeCommand('Comfy.Canvas.FitView')
        await comfyPage.nextFrame()

        await comfyPage.canvas.dispatchEvent('wheel', {
          deltaY: -100,
          ctrlKey: true
        })
        await comfyPage.nextFrame()
      })
    }

    await perfMonitor.finishMonitoring(testName)
  })
})
