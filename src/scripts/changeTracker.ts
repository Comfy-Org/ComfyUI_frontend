import { LGraphCanvas, LiteGraph } from '@comfyorg/litegraph'
import { LGraphNode } from '@comfyorg/litegraph'
import * as jsondiffpatch from 'jsondiffpatch'
import _ from 'lodash'
import log from 'loglevel'

import type { ExecutedWsMessage } from '@/schemas/apiSchema'
import type { ComfyWorkflowJSON } from '@/schemas/comfyWorkflowSchema'
import { useExecutionStore } from '@/stores/executionStore'
import { ComfyWorkflow, useWorkflowStore } from '@/stores/workflowStore'

import { api } from './api'
import type { ComfyApp } from './app'

function clone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

const logger = log.getLogger('ChangeTracker')
// Change to debug for more verbose logging
logger.setLevel('info')

export class ChangeTracker {
  static MAX_HISTORY = 50
  /**
   * The active state of the workflow.
   */
  activeState: ComfyWorkflowJSON
  undoQueue: ComfyWorkflowJSON[] = []
  redoQueue: ComfyWorkflowJSON[] = []
  changeCount: number = 0
  /**
   * Whether the redo/undo restoring is in progress.
   */
  private restoringState: boolean = false

  ds?: { scale: number; offset: [number, number] }
  nodeOutputs?: Record<string, any>

  static app?: ComfyApp
  get app(): ComfyApp {
    return ChangeTracker.app!
  }

  constructor(
    /**
     * The workflow that this change tracker is tracking
     */
    public workflow: ComfyWorkflow,
    /**
     * The initial state of the workflow
     */
    public initialState: ComfyWorkflowJSON
  ) {
    this.activeState = initialState
  }

  /**
   * Save the current state as the initial state.
   */
  reset(state?: ComfyWorkflowJSON) {
    // Do not reset the state if we are restoring.
    if (this.restoringState) return

    logger.debug('Reset State')
    if (state) this.activeState = clone(state)
    this.initialState = clone(this.activeState)
  }

  store() {
    this.ds = {
      scale: this.app.canvas.ds.scale,
      offset: [this.app.canvas.ds.offset[0], this.app.canvas.ds.offset[1]]
    }
  }

  restore() {
    if (this.ds) {
      this.app.canvas.ds.scale = this.ds.scale
      this.app.canvas.ds.offset = this.ds.offset
    }
    if (this.nodeOutputs) {
      this.app.nodeOutputs = this.nodeOutputs
    }
  }

  updateModified() {
    api.dispatchCustomEvent('graphChanged', this.activeState)

    // Get the workflow from the store as ChangeTracker is raw object, i.e.
    // `this.workflow` is not reactive.
    const workflow = useWorkflowStore().getWorkflowByPath(this.workflow.path)
    if (workflow) {
      workflow.isModified = !ChangeTracker.graphEqual(
        this.initialState,
        this.activeState
      )
      if (logger.getLevel() <= logger.levels.DEBUG && workflow.isModified) {
        const diff = ChangeTracker.graphDiff(
          this.initialState,
          this.activeState
        )
        logger.debug('Graph diff:', diff)
      }
    }
  }

  checkState() {
    if (!this.app.graph || this.changeCount) return
    // @ts-expect-error zod types issue. Will be fixed after we enable ts-strict
    const currentState = clone(this.app.graph.serialize()) as ComfyWorkflowJSON
    if (!this.activeState) {
      this.activeState = currentState
      return
    }
    if (!ChangeTracker.graphEqual(this.activeState, currentState)) {
      this.undoQueue.push(this.activeState)
      if (this.undoQueue.length > ChangeTracker.MAX_HISTORY) {
        this.undoQueue.shift()
      }
      logger.debug('Diff detected. Undo queue length:', this.undoQueue.length)

      this.activeState = currentState
      this.redoQueue.length = 0
      this.updateModified()
    }
  }

  async updateState(source: ComfyWorkflowJSON[], target: ComfyWorkflowJSON[]) {
    const prevState = source.pop()
    if (prevState) {
      target.push(this.activeState)
      this.restoringState = true
      try {
        await this.app.loadGraphData(prevState, false, false, this.workflow, {
          showMissingModelsDialog: false,
          showMissingNodesDialog: false
        })
        this.activeState = prevState
        this.updateModified()
      } finally {
        this.restoringState = false
      }
    }
  }

  async undo() {
    await this.updateState(this.undoQueue, this.redoQueue)
    logger.debug(
      'Undo. Undo queue length:',
      this.undoQueue.length,
      'Redo queue length:',
      this.redoQueue.length
    )
  }

  async redo() {
    await this.updateState(this.redoQueue, this.undoQueue)
    logger.debug(
      'Redo. Undo queue length:',
      this.undoQueue.length,
      'Redo queue length:',
      this.redoQueue.length
    )
  }

  async undoRedo(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      const key = e.key.toUpperCase()
      // Redo: Ctrl + Y, or Ctrl + Shift + Z
      if ((key === 'Y' && !e.shiftKey) || (key == 'Z' && e.shiftKey)) {
        await this.redo()
        return true
      } else if (key === 'Z' && !e.shiftKey) {
        await this.undo()
        return true
      }
    }
  }

  beforeChange() {
    this.changeCount++
  }

  afterChange() {
    if (!--this.changeCount) {
      this.checkState()
    }
  }

  static init(app: ComfyApp) {
    const getCurrentChangeTracker = () =>
      useWorkflowStore().activeWorkflow?.changeTracker
    const checkState = () => getCurrentChangeTracker()?.checkState()

    ChangeTracker.app = app

    let keyIgnored = false
    window.addEventListener(
      'keydown',
      (e: KeyboardEvent) => {
        // Do not trigger on repeat events (Holding down a key)
        // This can happen when user is holding down "Space" to pan the canvas.
        if (e.repeat) return

        const activeEl = document.activeElement
        requestAnimationFrame(async () => {
          let bindInputEl: Element | null = null
          // If we are auto queue in change mode then we do want to trigger on inputs
          if (!app.ui.autoQueueEnabled || app.ui.autoQueueMode === 'instant') {
            if (
              activeEl?.tagName === 'INPUT' ||
              (activeEl && 'type' in activeEl && activeEl.type === 'textarea')
            ) {
              // Ignore events on inputs, they have their native history
              return
            }
            bindInputEl = activeEl
          }

          keyIgnored =
            e.key === 'Control' ||
            e.key === 'Shift' ||
            e.key === 'Alt' ||
            e.key === 'Meta'
          if (keyIgnored) return

          const changeTracker = getCurrentChangeTracker()
          if (!changeTracker) return

          // Check if this is a ctrl+z ctrl+y
          if (await changeTracker.undoRedo(e)) return

          // If our active element is some type of input then handle changes after they're done
          if (ChangeTracker.bindInput(app, bindInputEl)) return
          logger.debug('checkState on keydown')
          changeTracker.checkState()
        })
      },
      true
    )

    window.addEventListener('keyup', () => {
      if (keyIgnored) {
        keyIgnored = false
        logger.debug('checkState on keyup')
        checkState()
      }
    })

    // Handle clicking DOM elements (e.g. widgets)
    window.addEventListener('mouseup', () => {
      logger.debug('checkState on mouseup')
      checkState()
    })

    // Handle prompt queue event for dynamic widget changes
    api.addEventListener('promptQueued', () => {
      logger.debug('checkState on promptQueued')
      checkState()
    })

    api.addEventListener('graphCleared', () => {
      logger.debug('checkState on graphCleared')
      checkState()
    })

    // Handle litegraph clicks
    const processMouseUp = LGraphCanvas.prototype.processMouseUp
    LGraphCanvas.prototype.processMouseUp = function (e) {
      const v = processMouseUp.apply(this, [e])
      logger.debug('checkState on processMouseUp')
      checkState()
      return v
    }
    const processMouseDown = LGraphCanvas.prototype.processMouseDown
    LGraphCanvas.prototype.processMouseDown = function (e) {
      const v = processMouseDown.apply(this, [e])
      logger.debug('checkState on processMouseDown')
      checkState()
      return v
    }

    // Handle litegraph dialog popup for number/string widgets
    const prompt = LGraphCanvas.prototype.prompt
    LGraphCanvas.prototype.prompt = function (
      title: string,
      value: any,
      callback: (v: any) => void,
      event: any
    ) {
      const extendedCallback = (v: any) => {
        callback(v)
        checkState()
      }
      logger.debug('checkState on prompt')
      return prompt.apply(this, [title, value, extendedCallback, event])
    }

    // Handle litegraph context menu for COMBO widgets
    const close = LiteGraph.ContextMenu.prototype.close
    LiteGraph.ContextMenu.prototype.close = function (e: MouseEvent) {
      const v = close.apply(this, [e])
      logger.debug('checkState on contextMenuClose')
      checkState()
      return v
    }

    // Detects nodes being added via the node search dialog
    const onNodeAdded = LiteGraph.LGraph.prototype.onNodeAdded
    LiteGraph.LGraph.prototype.onNodeAdded = function (node: LGraphNode) {
      const v = onNodeAdded?.apply(this, [node])
      if (!app?.configuringGraph) {
        logger.debug('checkState on onNodeAdded')
        checkState()
      }
      return v
    }

    // Handle multiple commands as a single transaction
    document.addEventListener('litegraph:canvas', (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail.subType === 'before-change') {
        getCurrentChangeTracker()?.beforeChange()
      } else if (detail.subType === 'after-change') {
        getCurrentChangeTracker()?.afterChange()
      }
    })

    // Store node outputs
    api.addEventListener('executed', (e: CustomEvent<ExecutedWsMessage>) => {
      const detail = e.detail
      const workflow =
        useExecutionStore().queuedPrompts[detail.prompt_id]?.workflow
      const changeTracker = workflow?.changeTracker
      if (!changeTracker) return
      changeTracker.nodeOutputs ??= {}
      const nodeOutputs = changeTracker.nodeOutputs
      const output = nodeOutputs[detail.node]
      if (detail.merge && output) {
        for (const k in detail.output ?? {}) {
          const v = output[k]
          if (v instanceof Array) {
            output[k] = v.concat(detail.output[k])
          } else {
            output[k] = detail.output[k]
          }
        }
      } else {
        nodeOutputs[detail.node] = detail.output
      }
    })
  }

  static bindInput(_app: ComfyApp, activeEl: Element | null): boolean {
    if (
      !activeEl ||
      activeEl.tagName === 'CANVAS' ||
      activeEl.tagName === 'BODY'
    ) {
      return false
    }

    for (const evt of ['change', 'input', 'blur']) {
      const htmlElement = activeEl as HTMLElement
      if (`on${evt}` in htmlElement) {
        const listener = () => {
          useWorkflowStore().activeWorkflow?.changeTracker?.checkState?.()
          htmlElement.removeEventListener(evt, listener)
        }
        htmlElement.addEventListener(evt, listener)
        return true
      }
    }
    return false
  }

  static graphEqual(a: ComfyWorkflowJSON, b: ComfyWorkflowJSON) {
    if (a === b) return true

    if (typeof a == 'object' && a && typeof b == 'object' && b) {
      // Compare nodes ignoring order
      if (
        !_.isEqualWith(a.nodes, b.nodes, (arrA, arrB) => {
          if (Array.isArray(arrA) && Array.isArray(arrB)) {
            return _.isEqual(new Set(arrA), new Set(arrB))
          }
        })
      ) {
        return false
      }

      // Compare extra properties ignoring ds
      if (
        !_.isEqual(_.omit(a.extra ?? {}, ['ds']), _.omit(b.extra ?? {}, ['ds']))
      )
        return false

      // Compare other properties normally
      for (const key of ['links', 'reroutes', 'groups']) {
        if (!_.isEqual(a[key], b[key])) {
          return false
        }
      }

      return true
    }

    return false
  }

  private static graphDiff(a: ComfyWorkflowJSON, b: ComfyWorkflowJSON) {
    function sortGraphNodes(graph: ComfyWorkflowJSON) {
      return {
        links: graph.links,
        groups: graph.groups,
        nodes: graph.nodes.sort((a, b) => {
          if (typeof a.id === 'number' && typeof b.id === 'number') {
            return a.id - b.id
          }
          return 0
        })
      }
    }
    return jsondiffpatch.diff(sortGraphNodes(a), sortGraphNodes(b))
  }
}
