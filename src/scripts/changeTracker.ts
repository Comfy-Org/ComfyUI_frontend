import type { ComfyApp } from './app'
import { api } from './api'
import { clone } from './utils'
import { LGraphCanvas, LiteGraph } from '@comfyorg/litegraph'
import { ComfyWorkflow } from './workflows'
import type { ComfyWorkflowJSON } from '@/types/comfyWorkflow'
import { LGraphNode } from '@comfyorg/litegraph'
import { ExecutedWsMessage } from '@/types/apiTypes'
import { useExecutionStore } from '@/stores/executionStore'

export class ChangeTracker {
  static MAX_HISTORY = 50
  #app?: ComfyApp
  undoQueue: ComfyWorkflowJSON[] = []
  redoQueue: ComfyWorkflowJSON[] = []
  activeState: ComfyWorkflowJSON | null = null
  isOurLoad: boolean = false
  changeCount: number = 0

  ds?: { scale: number; offset: [number, number] }
  nodeOutputs?: Record<string, any>

  get app(): ComfyApp {
    // Global tracker has #app set, while other trackers have workflow bounded
    return this.#app ?? this.workflow.manager.app
  }

  constructor(public workflow: ComfyWorkflow) {}

  #setApp(app: ComfyApp) {
    this.#app = app
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

  checkState() {
    if (!this.app.graph || this.changeCount) return

    const currentState = this.app.graph.serialize()
    if (!this.activeState) {
      this.activeState = clone(currentState)
      return
    }
    if (!ChangeTracker.graphEqual(this.activeState, currentState)) {
      this.undoQueue.push(this.activeState)
      if (this.undoQueue.length > ChangeTracker.MAX_HISTORY) {
        this.undoQueue.shift()
      }
      this.activeState = clone(currentState)
      this.redoQueue.length = 0
      this.workflow.unsaved = true
      api.dispatchEvent(
        new CustomEvent('graphChanged', { detail: this.activeState })
      )
    }
  }

  async updateState(source: ComfyWorkflowJSON[], target: ComfyWorkflowJSON[]) {
    const prevState = source.pop()
    if (prevState) {
      target.push(this.activeState!)
      this.isOurLoad = true
      await this.app.loadGraphData(prevState, false, false, this.workflow, {
        showMissingModelsDialog: false,
        showMissingNodesDialog: false
      })
      this.activeState = prevState
    }
  }

  async undo() {
    await this.updateState(this.undoQueue, this.redoQueue)
  }

  async redo() {
    await this.updateState(this.redoQueue, this.undoQueue)
  }

  async undoRedo(e: KeyboardEvent) {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'y' || e.key == 'Z') {
        await this.redo()
        return true
      } else if (e.key === 'z') {
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
    const changeTracker = () =>
      app.workflowManager.activeWorkflow?.changeTracker ?? globalTracker
    globalTracker.#setApp(app)

    const loadGraphData = app.loadGraphData
    app.loadGraphData = async function (...args) {
      const v = await loadGraphData.apply(this, args)
      const ct = changeTracker()
      if (ct.isOurLoad) {
        ct.isOurLoad = false
      } else {
        ct.checkState()
      }
      return v
    }

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

          // Check if this is a ctrl+z ctrl+y
          if (await changeTracker().undoRedo(e)) return

          // If our active element is some type of input then handle changes after they're done
          if (ChangeTracker.bindInput(app, bindInputEl)) return
          changeTracker().checkState()
        })
      },
      true
    )

    window.addEventListener('keyup', (e) => {
      if (keyIgnored) {
        keyIgnored = false
        changeTracker().checkState()
      }
    })

    // Handle clicking DOM elements (e.g. widgets)
    window.addEventListener('mouseup', () => {
      changeTracker().checkState()
    })

    // Handle prompt queue event for dynamic widget changes
    api.addEventListener('promptQueued', () => {
      changeTracker().checkState()
    })

    api.addEventListener('graphCleared', () => {
      changeTracker().checkState()
    })

    // Handle litegraph clicks
    const processMouseUp = LGraphCanvas.prototype.processMouseUp
    LGraphCanvas.prototype.processMouseUp = function (e) {
      const v = processMouseUp.apply(this, [e])
      changeTracker().checkState()
      return v
    }
    const processMouseDown = LGraphCanvas.prototype.processMouseDown
    LGraphCanvas.prototype.processMouseDown = function (e) {
      const v = processMouseDown.apply(this, [e])
      changeTracker().checkState()
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
        changeTracker().checkState()
      }
      return prompt.apply(this, [title, value, extendedCallback, event])
    }

    // Handle litegraph context menu for COMBO widgets
    const close = LiteGraph.ContextMenu.prototype.close
    LiteGraph.ContextMenu.prototype.close = function (e: MouseEvent) {
      const v = close.apply(this, [e])
      changeTracker().checkState()
      return v
    }

    // Detects nodes being added via the node search dialog
    const onNodeAdded = LiteGraph.LGraph.prototype.onNodeAdded
    LiteGraph.LGraph.prototype.onNodeAdded = function (node: LGraphNode) {
      const v = onNodeAdded?.apply(this, [node])
      if (!app?.configuringGraph) {
        const ct = changeTracker()
        if (!ct.isOurLoad) {
          ct.checkState()
        }
      }
      return v
    }

    // Handle multiple commands as a single transaction
    document.addEventListener('litegraph:canvas', (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail.subType === 'before-change') {
        changeTracker().beforeChange()
      } else if (detail.subType === 'after-change') {
        changeTracker().afterChange()
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

  static bindInput(app: ComfyApp, activeEl: Element | null): boolean {
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
          app.workflowManager.activeWorkflow?.changeTracker?.checkState()
          htmlElement.removeEventListener(evt, listener)
        }
        htmlElement.addEventListener(evt, listener)
        return true
      }
    }
    return false
  }

  static graphEqual(a: any, b: any, path = '') {
    if (a === b) return true

    if (typeof a == 'object' && a && typeof b == 'object' && b) {
      const keys = Object.getOwnPropertyNames(a)

      if (keys.length != Object.getOwnPropertyNames(b).length) {
        return false
      }

      for (const key of keys) {
        let av = a[key]
        let bv = b[key]
        if (!path && key === 'nodes') {
          // Nodes need to be sorted as the order changes when selecting nodes
          av = [...av].sort((a, b) => a.id - b.id)
          bv = [...bv].sort((a, b) => a.id - b.id)
        } else if (path === 'extra.ds') {
          // Ignore view changes
          continue
        }
        if (!ChangeTracker.graphEqual(av, bv, path + (path ? '.' : '') + key)) {
          return false
        }
      }

      return true
    }

    return false
  }
}

export const globalTracker = new ChangeTracker({} as ComfyWorkflow)
