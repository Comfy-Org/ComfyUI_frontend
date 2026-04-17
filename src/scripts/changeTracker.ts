import _ from 'es-toolkit/compat'

import type { CanvasPointerEvent } from '@/lib/litegraph/src/litegraph'
import { LGraphCanvas, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import type { ExecutedWsMessage } from '@/schemas/apiSchema'
import { useExecutionStore } from '@/stores/executionStore'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { useSubgraphNavigationStore } from '@/stores/subgraphNavigationStore'

import { api } from './api'
import type { ComfyApp } from './app'
import { app } from './app'

function clone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

function isActiveTracker(tracker: ChangeTracker): boolean {
  return useWorkflowStore().activeWorkflow?.changeTracker === tracker
}

export class ChangeTracker {
  static MAX_HISTORY = 50
  /**
   * Guard flag to prevent captureCanvasState from running during loadGraphData.
   * Between rootGraph.configure() and afterLoadNewGraph(), the rootGraph
   * contains the NEW workflow's data while activeWorkflow still points to
   * the OLD workflow. Any captureCanvasState call in that window would
   * serialize the wrong graph into the old workflow's activeState, corrupting it.
   */
  static isLoadingGraph = false
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
  _restoringState: boolean = false

  ds?: { scale: number; offset: [number, number] }
  nodeOutputs?: Record<string, ExecutedWsMessage['output']>

  private subgraphState?: {
    navigation: string[]
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
    if (this._restoringState) return

    if (state) this.activeState = clone(state)
    this.initialState = clone(this.activeState)
  }

  store() {
    this.ds = {
      scale: app.canvas.ds.scale,
      offset: [app.canvas.ds.offset[0], app.canvas.ds.offset[1]]
    }
    this.nodeOutputs = useNodeOutputStore().snapshotOutputs()
    const navigation = useSubgraphNavigationStore().exportState()
    // Always store the navigation state, even if empty (root level)
    this.subgraphState = { navigation }
  }

  /**
   * Freeze this tracker's state before the workflow goes inactive.
   * Always calls store() to preserve viewport/outputs. Calls
   * captureCanvasState() only when not in undo/redo (to avoid
   * corrupting undo history with intermediate graph state).
   *
   * PRECONDITION: must be called while this workflow is still the active one
   * (before the activeWorkflow pointer is moved). If called after the pointer
   * has already moved, this is a no-op to avoid freezing wrong viewport data.
   *
   * @internal Not part of the public extension API.
   */
  deactivate() {
    if (!isActiveTracker(this)) {
      console.warn(
        'deactivate() called on inactive tracker for:',
        this.workflow.path
      )
      return
    }
    if (!this._restoringState) this.captureCanvasState()
    this.store()
  }

  /**
   * Ensure activeState is up-to-date for persistence.
   * Active workflow: flushes canvas → activeState.
   * Inactive workflow: no-op (activeState was frozen by deactivate()).
   *
   * @internal Not part of the public extension API.
   */
  prepareForSave() {
    if (isActiveTracker(this)) this.captureCanvasState()
  }

  restore() {
    if (this.ds) {
      app.canvas.ds.scale = this.ds.scale
      app.canvas.ds.offset = this.ds.offset
    }
    if (this.nodeOutputs) {
      useNodeOutputStore().restoreOutputs(this.nodeOutputs)
    }
    if (this.subgraphState) {
      const { navigation } = this.subgraphState
      useSubgraphNavigationStore().restoreState(navigation)

      const activeId = navigation.at(-1)
      if (activeId) {
        // Navigate to the saved subgraph
        const subgraph = app.rootGraph.subgraphs.get(activeId)
        if (subgraph) {
          app.canvas.setGraph(subgraph)
        }
      } else {
        // Empty navigation array means root level
        app.canvas.setGraph(app.rootGraph)
      }
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
    }
  }

  /**
   * Snapshot the current canvas state into activeState and push undo.
   * INVARIANT: only the active workflow's tracker may read from the canvas.
   * Calling this on an inactive tracker would capture the wrong graph.
   */
  captureCanvasState() {
    const isUndoRedoing = this._restoringState
    const isCurrentlySavingChange = this.changeCount > 0
    if (
      !app.graph ||
      isCurrentlySavingChange ||
      isUndoRedoing ||
      ChangeTracker.isLoadingGraph
    )
      return

    if (!isActiveTracker(this)) {
      console.warn(
        'captureCanvasState called on inactive tracker for:',
        this.workflow.path
      )
      return
    }

    const currentState = clone(app.rootGraph.serialize()) as ComfyWorkflowJSON
    if (!this.activeState) {
      this.activeState = currentState
      return
    }
    if (!ChangeTracker.graphEqual(this.activeState, currentState)) {
      this.undoQueue.push(this.activeState)
      if (this.undoQueue.length > ChangeTracker.MAX_HISTORY) {
        this.undoQueue.shift()
      }

      this.activeState = currentState
      this.redoQueue.length = 0
      this.updateModified()
    }
  }

  /** @deprecated Use {@link captureCanvasState} instead. */
  checkState() {
    if (!ChangeTracker._checkStateWarned) {
      ChangeTracker._checkStateWarned = true
      console.warn(
        'checkState() is deprecated — use captureCanvasState() instead.'
      )
    }
    this.captureCanvasState()
  }

  private static _checkStateWarned = false

  async updateState(source: ComfyWorkflowJSON[], target: ComfyWorkflowJSON[]) {
    const prevState = source.pop()
    if (prevState) {
      target.push(this.activeState)
      this._restoringState = true
      try {
        await app.loadGraphData(prevState, false, false, this.workflow, {
          checkForRerouteMigration: false,
          silentAssetErrors: true
        })
        this.activeState = prevState
        this.updateModified()
      } finally {
        this._restoringState = false
      }
    }
  }

  async undo() {
    await this.updateState(this.undoQueue, this.redoQueue)
  }

  async redo() {
    await this.updateState(this.redoQueue, this.undoQueue)
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
      this.captureCanvasState()
    }
  }

  static init() {
    const getCurrentChangeTracker = () =>
      useWorkflowStore().activeWorkflow?.changeTracker
    const captureState = () => getCurrentChangeTracker()?.captureCanvasState()

    let keyIgnored = false
    window.addEventListener(
      'keydown',
      (e: KeyboardEvent) => {
        // Do not trigger on repeat events (Holding down a key)
        // This can happen when user is holding down "Space" to pan the canvas.
        if (e.repeat) return

        // If the mask editor is opened, we don't want to trigger on key events
        const comfyApp = app.constructor as typeof ComfyApp
        if (comfyApp.maskeditor_is_opended?.()) return

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
          if (ChangeTracker.bindInput(bindInputEl)) return
          changeTracker.captureCanvasState()
        })
      },
      true
    )

    window.addEventListener('keyup', () => {
      if (keyIgnored) {
        keyIgnored = false
        captureState()
      }
    })

    // Handle clicking DOM elements (e.g. widgets)
    window.addEventListener('mouseup', () => {
      captureState()
    })

    // Handle prompt queue event for dynamic widget changes
    api.addEventListener('promptQueued', () => {
      captureState()
    })

    api.addEventListener('graphCleared', () => {
      captureState()
    })

    // Handle litegraph clicks
    const processMouseUp = LGraphCanvas.prototype.processMouseUp
    LGraphCanvas.prototype.processMouseUp = function (e) {
      const v = processMouseUp.apply(this, [e])
      captureState()
      return v
    }

    // Handle litegraph dialog popup for number/string widgets
    const prompt = LGraphCanvas.prototype.prompt
    LGraphCanvas.prototype.prompt = function (
      title: string,
      value: string | number,
      callback: (v: string) => void,
      event: CanvasPointerEvent
    ) {
      const extendedCallback = (v: string) => {
        callback(v)
        captureState()
      }
      return prompt.apply(this, [title, value, extendedCallback, event])
    }

    // Handle litegraph context menu for COMBO widgets
    const close = LiteGraph.ContextMenu.prototype.close
    LiteGraph.ContextMenu.prototype.close = function (e: MouseEvent) {
      const v = close.apply(this, [e])
      captureState()
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
        useExecutionStore().queuedJobs[detail.prompt_id]?.workflow
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

  static bindInput(activeEl: Element | null): boolean {
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
          useWorkflowStore().activeWorkflow?.changeTracker?.captureCanvasState?.()
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
      for (const key of [
        'links',
        'floatingLinks',
        'reroutes',
        'groups',
        'definitions',
        'subgraphs'
      ]) {
        if (!_.isEqual(a[key], b[key])) {
          return false
        }
      }

      return true
    }

    return false
  }
}
