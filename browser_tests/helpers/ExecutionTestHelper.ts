import { Page } from '@playwright/test'

export interface ExecutionEventTracker {
  progressStates: any[]
  executionStarted: boolean
  executionFinished: boolean
  executionError: any | null
  executingNodeId: string | null
}

export interface ProgressState {
  prompt_id: string
  nodes: Record<
    string,
    {
      state: 'running' | 'finished' | 'waiting'
      node_id: string
      display_node_id: string
      prompt_id: string
      value?: number
      max?: number
    }
  >
}

export class ExecutionTestHelper {
  private testId: string

  constructor(private page: Page) {
    // Generate unique ID for this test instance to avoid conflicts
    this.testId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Sets up common event tracking for execution tests
   */
  async setupEventTracking(): Promise<void> {
    await this.page.evaluate((testId) => {
      // Use unique property names for this test instance
      const progressKey = `__progressStates_${testId}`
      const startedKey = `__executionStarted_${testId}`
      const finishedKey = `__executionFinished_${testId}`
      const errorKey = `__executionError_${testId}`
      const nodeIdKey = `__executingNodeId_${testId}`

      window[progressKey] = []
      window[startedKey] = false
      window[finishedKey] = false
      window[errorKey] = null
      window[nodeIdKey] = null

      const api = window['app'].api

      // Store listeners so we can clean them up later
      if (!window['__testListeners']) {
        window['__testListeners'] = {}
      }

      // Remove old listeners if they exist
      if (window['__testListeners'][testId]) {
        const oldListeners = window['__testListeners'][testId]
        api.removeEventListener('progress_state', oldListeners.progress)
        api.removeEventListener('executing', oldListeners.executing)
        api.removeEventListener('execution_error', oldListeners.error)
      }

      // Create new listeners
      const progressListener = (event) => {
        window[progressKey].push(event.detail)
      }

      const executingListener = (event) => {
        window[nodeIdKey] = event.detail
        if (event.detail !== null) {
          window[startedKey] = true
        } else {
          window[finishedKey] = true
        }
      }

      const errorListener = (event) => {
        window[errorKey] = event.detail
      }

      // Add listeners
      api.addEventListener('progress_state', progressListener)
      api.addEventListener('executing', executingListener)
      api.addEventListener('execution_error', errorListener)

      // Store listeners for cleanup
      window['__testListeners'][testId] = {
        progress: progressListener,
        executing: executingListener,
        error: errorListener
      }
    }, this.testId)
  }

  /**
   * Gets the current event tracking state
   */
  async getEventState(): Promise<ExecutionEventTracker> {
    return await this.page.evaluate(
      (testId) => ({
        progressStates: window[`__progressStates_${testId}`] || [],
        executionStarted: window[`__executionStarted_${testId}`] || false,
        executionFinished: window[`__executionFinished_${testId}`] || false,
        executionError: window[`__executionError_${testId}`] || null,
        executingNodeId: window[`__executingNodeId_${testId}`] || null
      }),
      this.testId
    )
  }

  /**
   * Waits for execution to start
   */
  async waitForExecutionStart(timeout: number = 10000): Promise<void> {
    await this.page.waitForFunction(
      (testId) => window[`__executionStarted_${testId}`] === true,
      this.testId,
      { timeout }
    )
  }

  /**
   * Waits for execution to finish
   */
  async waitForExecutionFinish(timeout: number = 30000): Promise<void> {
    await this.page.waitForFunction(
      (testId) => window[`__executionFinished_${testId}`] === true,
      this.testId,
      { timeout }
    )
  }

  /**
   * Waits for a specific number of nodes to be running
   */
  async waitForRunningNodes(
    count: number,
    timeout: number = 10000
  ): Promise<void> {
    await this.page.waitForFunction(
      ({ expectedCount, testId }) => {
        const states = window[`__progressStates_${testId}`]
        if (!states || states.length === 0) return false

        const latestState = states[states.length - 1]
        if (!latestState.nodes) return false

        const runningNodes = Object.values(latestState.nodes).filter(
          (node: any) => node.state === 'running'
        ).length

        return runningNodes >= expectedCount
      },
      { expectedCount: count, testId: this.testId },
      { timeout }
    )
  }

  /**
   * Waits for at least one node to finish
   */
  async waitForNodeFinish(timeout: number = 15000): Promise<void> {
    await this.page.waitForFunction(
      (testId) => {
        const states = window[`__progressStates_${testId}`]
        if (!states || states.length === 0) return false

        const latestState = states[states.length - 1]
        if (!latestState.nodes) return false

        return Object.values(latestState.nodes).some(
          (node: any) => node.state === 'finished'
        )
      },
      this.testId,
      { timeout }
    )
  }

  /**
   * Gets the latest progress state
   */
  async getLatestProgressState(): Promise<ProgressState | null> {
    return await this.page.evaluate((testId) => {
      const states = window[`__progressStates_${testId}`]
      if (!states || states.length === 0) return null
      return states[states.length - 1]
    }, this.testId)
  }

  /**
   * Waits for node progress to be applied to the graph
   */
  async waitForGraphNodeProgress(
    nodeIds: number[],
    timeout: number = 5000
  ): Promise<void> {
    await this.page.waitForFunction(
      (ids) => {
        return ids.some((id) => {
          const node = window['app'].graph.getNodeById(id)
          return node?.progress !== undefined && node.progress >= 0
        })
      },
      nodeIds,
      { timeout }
    )
  }

  /**
   * Gets node progress from the graph
   */
  async getGraphNodeProgress(nodeId: number): Promise<number | undefined> {
    return await this.page.evaluate((id) => {
      const node = window['app'].graph.getNodeById(id)
      return node?.progress
    }, nodeId)
  }

  /**
   * Checks if execution had errors
   */
  async hasExecutionError(): Promise<boolean> {
    const error = await this.page.evaluate(
      (testId) => window[`__executionError_${testId}`],
      this.testId
    )
    return error !== null
  }

  /**
   * Gets execution error details
   */
  async getExecutionError(): Promise<any> {
    return await this.page.evaluate(
      (testId) => window[`__executionError_${testId}`],
      this.testId
    )
  }

  /**
   * Cleanup event listeners when test is done
   */
  async cleanup(): Promise<void> {
    await this.page.evaluate((testId) => {
      if (window['__testListeners'] && window['__testListeners'][testId]) {
        const api = window['app'].api
        const listeners = window['__testListeners'][testId]
        api.removeEventListener('progress_state', listeners.progress)
        api.removeEventListener('executing', listeners.executing)
        api.removeEventListener('execution_error', listeners.error)
        delete window['__testListeners'][testId]
      }
      // Clean up test-specific properties
      delete window[`__progressStates_${testId}`]
      delete window[`__executionStarted_${testId}`]
      delete window[`__executionFinished_${testId}`]
      delete window[`__executionError_${testId}`]
      delete window[`__executingNodeId_${testId}`]
    }, this.testId)
  }

  /**
   * Get the testId for direct window access in evaluate functions
   */
  getTestId(): string {
    return this.testId
  }
}

/**
 * Helper for browser title monitoring
 */
export class BrowserTitleMonitor {
  constructor(private page: Page) {}

  /**
   * Waits for title to not show execution state
   */
  async waitForIdleTitle(timeout: number = 10000): Promise<void> {
    await this.page.waitForFunction(
      () => {
        const title = document.title
        return !title.match(/\[\d+%\]/) && !title.match(/\[\d+ nodes running\]/)
      },
      { timeout }
    )
  }

  /**
   * Waits for title to show execution state
   */
  async waitForExecutionTitle(timeout: number = 5000): Promise<void> {
    await this.page.waitForFunction(
      () => {
        const title = document.title
        return title.match(/\[\d+%\]/) || title.match(/\[\d+ nodes running\]/)
      },
      { timeout }
    )
  }

  /**
   * Sets up title change monitoring
   */
  async setupTitleMonitoring(): Promise<void> {
    await this.page.evaluate(() => {
      window['__titleUpdateLog'] = []
      window['__lastTitle'] = document.title

      window['__titleInterval'] = setInterval(() => {
        const newTitle = document.title
        if (newTitle !== window['__lastTitle']) {
          window['__titleUpdateLog'].push({
            time: Date.now(),
            title: newTitle,
            hasProgress: !!newTitle.match(/\[\d+%\]/),
            hasMultiNode: !!newTitle.match(/\[\d+ nodes running\]/)
          })
          window['__lastTitle'] = newTitle
        }
      }, 50)
    })
  }

  /**
   * Stops title monitoring and returns the log
   */
  async stopTitleMonitoring(): Promise<any[]> {
    const log = await this.page.evaluate(() => {
      if (window['__titleInterval']) {
        clearInterval(window['__titleInterval'])
      }
      return window['__titleUpdateLog'] || []
    })
    return log
  }
}

/**
 * Helper for preview event handling
 */
export class PreviewTestHelper {
  constructor(private page: Page) {}

  /**
   * Sets up preview event tracking
   */
  async setupPreviewTracking(): Promise<void> {
    await this.page.evaluate(() => {
      window['__previewEvents'] = []
      window['__revokedNodes'] = []
      window['__revokedUrls'] = []

      // Track preview events
      const api = window['app'].api
      api.addEventListener('b_preview_with_metadata', (event) => {
        window['__previewEvents'].push({
          nodeId: event.detail.nodeId,
          displayNodeId: event.detail.displayNodeId,
          parentNodeId: event.detail.parentNodeId,
          realNodeId: event.detail.realNodeId,
          promptId: event.detail.promptId
        })
      })

      // Mock revokePreviews to track calls
      const originalRevoke = window['app'].revokePreviews
      window['app'].revokePreviews = function (nodeId) {
        window['__revokedNodes'].push(nodeId)
        originalRevoke.call(this, nodeId)
      }

      // Mock URL.revokeObjectURL to track URL revocations
      const originalRevokeURL = URL.revokeObjectURL
      URL.revokeObjectURL = (url: string) => {
        window['__revokedUrls'].push(url)
        originalRevokeURL.call(URL, url)
      }
    })
  }

  /**
   * Gets tracked preview events
   */
  async getPreviewEvents(): Promise<any[]> {
    return await this.page.evaluate(() => window['__previewEvents'] || [])
  }

  /**
   * Gets revoked node IDs
   */
  async getRevokedNodes(): Promise<string[]> {
    return await this.page.evaluate(() => window['__revokedNodes'] || [])
  }

  /**
   * Gets revoked URLs
   */
  async getRevokedUrls(): Promise<string[]> {
    return await this.page.evaluate(() => window['__revokedUrls'] || [])
  }

  /**
   * Sets fake preview for a node
   */
  async setNodePreview(nodeId: string, previewUrl: string): Promise<void> {
    await this.page.evaluate(
      ({ id, url }) => {
        window['app'].nodePreviewImages[id] = [url]
      },
      { id: nodeId, url: previewUrl }
    )
  }

  /**
   * Gets node preview URLs
   */
  async getNodePreviews(nodeId: string): Promise<string[] | undefined> {
    return await this.page.evaluate(
      (id) => window['app'].nodePreviewImages[id],
      nodeId
    )
  }
}

/**
 * Helper for checking subgraph execution
 */
export class SubgraphTestHelper {
  private testId: string

  constructor(private page: Page) {
    // Generate unique ID for this test instance
    this.testId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Sets the test ID to match ExecutionTestHelper
   */
  setTestId(testId: string): void {
    this.testId = testId
  }

  /**
   * Waits for nested node progress (nodes with ':' in their ID)
   */
  async waitForNestedNodeProgress(
    minNestingLevel: number = 1,
    timeout: number = 15000
  ): Promise<void> {
    await this.page.waitForFunction(
      ({ minLevel, testId }) => {
        const states = window[`__progressStates_${testId}`]
        if (!states || states.length === 0) return false

        return states.some((state: any) => {
          if (!state.nodes) return false
          return Object.keys(state.nodes).some((nodeId) => {
            const colonCount = (nodeId.match(/:/g) || []).length
            return colonCount >= minLevel
          })
        })
      },
      { minLevel: minNestingLevel, testId: this.testId },
      { timeout }
    )
  }

  /**
   * Gets all nested node IDs from progress states
   */
  async getNestedNodeIds(): Promise<string[]> {
    return await this.page.evaluate((testId) => {
      const states = window[`__progressStates_${testId}`] || []
      const nestedIds = new Set<string>()

      states.forEach((state: any) => {
        if (state.nodes) {
          Object.keys(state.nodes).forEach((nodeId) => {
            if (nodeId.includes(':')) {
              nestedIds.add(nodeId)
            }
          })
        }
      })

      return Array.from(nestedIds)
    }, this.testId)
  }

  /**
   * Checks if a node has running stroke style
   */
  async hasRunningStrokeStyle(nodeId: number): Promise<boolean> {
    return await this.page.evaluate((id) => {
      const node = window['app'].graph.getNodeById(id)
      if (!node?.strokeStyles?.['running']) return false
      const style = node.strokeStyles['running'].call(node)
      return style?.color === '#0f0'
    }, nodeId)
  }
}
