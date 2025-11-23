import log from 'loglevel'

import { LGraph } from '@/lib/litegraph/src/litegraph'
import type { LGraphNode, NodeId } from '@/lib/litegraph/src/litegraph'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useQueuePendingTaskCountStore } from '@/stores/queueStore'

const logger = log.getLogger('EagerExecutionService')
logger.setLevel('debug')

class EagerExecutionService {
  private enabled: boolean = false
  private executionPending: boolean = false
  private isExecuting: boolean = false
  private changedNodes: Set<string> = new Set()
  private graphChangedListenerAttached: boolean = false
  private isSettingUpListeners: boolean = false
  private lastChangeTimestamp: Map<string, number> = new Map()

  private wrappedNodes: Set<NodeId> = new Set()
  private wrappedWidgets: WeakSet<object> = new WeakSet()
  private graphPatched: boolean = false

  enable() {
    if (this.enabled) {
      return
    }
    this.enabled = true
    this.setupEventListeners()
  }

  disable() {
    if (!this.enabled) {
      return
    }
    this.enabled = false
  }

  private setupEventListeners() {
    this.setupWidgetListeners()

    if (!this.graphChangedListenerAttached) {
      logger.debug('Attaching graphChanged event listener')
      api.addEventListener('graphChanged', () => {
        if (this.enabled && !this.isExecuting) {
          logger.debug('Graph changed, re-setting up widget listeners')
          this.setupWidgetListeners()
        }
      })
      this.graphChangedListenerAttached = true
    }
  }

  private setupWidgetListeners() {
    if (this.isSettingUpListeners) {
      logger.debug('Already setting up listeners, skipping duplicate call')
      return
    }

    const graph = app.rootGraph
    if (!graph) {
      setTimeout(() => this.setupWidgetListeners(), 100)
      return
    }

    this.isSettingUpListeners = true
    logger.debug('Setting up widget listeners for all nodes')

    try {
      this.wrappedNodes.clear()

      graph.nodes.forEach((node) => {
        this.attachWidgetCallbacks(node)
      })

      if (!this.graphPatched) {
        const originalAdd = LGraph.prototype.add
        LGraph.prototype.add = function (node: LGraphNode) {
          const result = originalAdd.call(this, node)
          if (eagerExecutionService.enabled) {
            eagerExecutionService.attachWidgetCallbacks(node)
          }
          return result
        }
        this.graphPatched = true
      }

      logger.debug('Finished setting up widget listeners')
    } finally {
      this.isSettingUpListeners = false
    }
  }

  private attachWidgetCallbacks(node: LGraphNode) {
    if (!node.widgets) return

    if (this.wrappedNodes.has(node.id)) {
      logger.debug(
        `Skipping callback attachment for ${node.title || node.type} (${node.id}) - already attached`
      )
      return
    }
    this.wrappedNodes.add(node.id)

    logger.debug(
      `Attaching callbacks to ${node.title || node.type} (${node.id}) - ${node.widgets.length} widget(s)`
    )

    node.widgets.forEach((widget, index) => {
      if (this.wrappedWidgets.has(widget)) {
        logger.debug(
          `  Widget ${index} (${widget.name}) already wrapped, skipping`
        )
        return
      }
      this.wrappedWidgets.add(widget)

      const originalCallback = widget.callback

      widget.callback = (value?: any) => {
        if (originalCallback) {
          originalCallback.call(widget, value)
        }

        if (this.enabled) {
          this.onNodeChanged(node)
        }
      }
    })
  }

  onNodeChanged(node: LGraphNode) {
    if (!this.enabled) return

    const nodeId = String(node.id)

    const now = Date.now()
    const lastChange = this.lastChangeTimestamp.get(nodeId) || 0
    const timeSinceLastChange = now - lastChange

    if (timeSinceLastChange < 50) {
      return
    }

    this.lastChangeTimestamp.set(nodeId, now)

    if (this.isExecuting) {
      return
    }

    const queueStore = useQueuePendingTaskCountStore()
    if (queueStore.count > 0) {
      return
    }

    this.changedNodes.add(nodeId)

    if (!this.executionPending) {
      this.scheduleExecution()
    }
  }

  private scheduleExecution() {
    this.executionPending = true

    setTimeout(() => {
      void this.executeEager()
      this.executionPending = false
      this.changedNodes.clear()
    }, 300)
  }

  private async executeEager() {
    if (!app.rootGraph || this.changedNodes.size === 0) return

    const queueStore = useQueuePendingTaskCountStore()

    if (queueStore.count > 0 || this.isExecuting) {
      logger.info('Execution already in progress, skipping eager execution')
      return
    }

    this.isExecuting = true

    try {
      logger.info('===== EAGER EXECUTION TRIGGERED =====')

      const changedNodesInfo = Array.from(this.changedNodes).map((nodeId) => {
        const node = app.rootGraph?.getNodeById(Number(nodeId))
        const title = node?.title || node?.type || `Node ${nodeId}`
        return `${title} (${nodeId})`
      })
      logger.info(`Changed nodes: [${changedNodesInfo.join(', ')}]`)

      const affectedNodes = this.getAffectedNodes(
        app.rootGraph,
        this.changedNodes
      )

      if (affectedNodes.size === 0) {
        logger.info('No downstream nodes to execute')
        logger.info('===== EAGER EXECUTION COMPLETE =====')
        return
      }

      const affectedNodesInfo = Array.from(affectedNodes).map((nodeId) => {
        const node = app.rootGraph?.getNodeById(Number(nodeId))
        const title = node?.title || node?.type || `Node ${nodeId}`
        return `${title} (${nodeId})`
      })
      logger.info(`Nodes to execute: [${affectedNodesInfo.join(', ')}]`)
      logger.info(`Total: ${affectedNodes.size} node(s) will execute`)

      const allNodesInfo = app.rootGraph?.nodes.map((node) => {
        const nodeId = String(node.id)
        const title = node.title || node.type || `Node ${nodeId}`
        const willExecute = affectedNodes.has(nodeId)

        if (willExecute) return `WILL EXECUTE - ${title} (${nodeId})`
        return `SKIPPED - ${title} (${nodeId})`
      })
      logger.info('Full execution plan:')
      allNodesInfo?.forEach((info) => logger.info(`   ${info}`))

      logger.info(
        `Triggering partial execution with ${affectedNodes.size} targets...`
      )

      await app.queuePrompt(0, 1, Array.from(affectedNodes))
      logger.info('===== EAGER EXECUTION COMPLETE =====')
    } catch (error) {
      logger.error('Failed to execute eagerly:', error)
    } finally {
      this.isExecuting = false
    }
  }

  private getAffectedNodes(
    graph: LGraph,
    changedNodeIds: Set<string>
  ): Set<string> {
    const affected = new Set<string>()
    const visited = new Set<string>()

    logger.info('Analyzing downstream dependencies...')

    const findDownstream = (nodeId: string, depth: number = 0) => {
      if (visited.has(nodeId)) return
      visited.add(nodeId)

      const node = graph.getNodeById(Number(nodeId))
      if (!node) return

      const indent = '  '.repeat(depth)

      if (node.outputs) {
        node.outputs.forEach((output) => {
          if (!output.links || output.links.length === 0) return

          output.links.forEach((linkId) => {
            const link = graph.links.get(linkId)
            if (!link) return

            const targetNodeId = String(link.target_id)
            const targetNode = graph.getNodeById(link.target_id)
            const targetTitle =
              targetNode?.title || targetNode?.type || `Node ${targetNodeId}`

            logger.info(
              `${indent}  └─> ${targetTitle} (${targetNodeId}) - will execute`
            )
            affected.add(targetNodeId)
            findDownstream(targetNodeId, depth + 1)
          })
        })
      }
    }

    changedNodeIds.forEach((nodeId) => {
      const node = graph.getNodeById(Number(nodeId))
      const nodeTitle = node?.title || node?.type || `Node ${nodeId}`

      logger.info(`Starting from: ${nodeTitle} (${nodeId})`)
      affected.add(nodeId)

      findDownstream(nodeId, 1)
    })

    logger.info(`Analysis complete: ${affected.size} node(s) will execute`)

    return affected
  }
}

export const eagerExecutionService = new EagerExecutionService()
