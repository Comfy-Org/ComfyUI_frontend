import { createSharedComposable } from '@vueuse/core'
import { computed, ref, shallowRef } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { createBounds } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { app } from '@/scripts/app'
import { api } from '@/scripts/api'
import { useWorkflowTemplateSelectorDialog } from '@/composables/useWorkflowTemplateSelectorDialog'
import { useExecutionStore } from '@/stores/executionStore'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { useTemplateWorkflows } from '@/platform/workflow/templates/composables/useTemplateWorkflows'

import type { ConnectStep, TourStep } from './tourSteps'
import {
  EDIT_ENGINE_TYPE,
  TOUR_TEMPLATE_ID,
  TOUR_TEMPLATE_SOURCE,
  tourSteps
} from './tourSteps'

interface ClearedLink {
  fromNodeId: LGraphNode['id']
  fromSlot: number
  toNode: LGraphNode
  toSlot: number
}

function useOnboardingTourImpl() {
  const canvasStore = useCanvasStore()
  const templateWorkflows = useTemplateWorkflows()
  const executionStore = useExecutionStore()
  const nodeOutputStore = useNodeOutputStore()
  const templateDialog = useWorkflowTemplateSelectorDialog()

  const isActive = ref(false)
  const stepIndex = ref(0)
  const clearedLink = shallowRef<ClearedLink | null>(null)
  const resultImageUrl = ref<string | null>(null)

  let detachStep: (() => void) | null = null

  const currentStep = computed<TourStep | null>(() =>
    isActive.value ? (tourSteps[stepIndex.value] ?? null) : null
  )
  const totalSteps = computed(() => tourSteps.length)
  const isLast = computed(() => stepIndex.value === tourSteps.length - 1)

  function resolveNode(type?: string, occurrence = 0): LGraphNode | null {
    const graph = canvasStore.currentGraph
    if (!graph || !type) return null
    const matches = graph.nodes.filter((node) => node.type === type)
    return matches[occurrence] ?? null
  }

  /** The node the cursor points at (its rect anchors the coach mark). */
  const focusNode = computed(() => {
    const step = currentStep.value
    return step
      ? resolveNode(step.targetNodeType, step.targetNodeOccurrence)
      : null
  })

  /** The DOM element a step points at (Run button), if it targets one. */
  const domTargetSelector = computed(() => currentStep.value?.domTarget ?? null)

  /** Nodes kept fully lit this step; all others stay dimmed the whole time. */
  const litNodes = computed<LGraphNode[]>(() => {
    const step = currentStep.value
    if (!step) return []
    const nodes = [resolveNode(step.targetNodeType, step.targetNodeOccurrence)]
    if (step.kind === 'connect') {
      nodes.push(resolveNode(step.toNodeType, step.toNodeOccurrence))
    }
    return nodes.filter((n): n is LGraphNode => !!n)
  })

  /**
   * Talk-steps wait for Next; action-steps advance on their own action. A
   * connect step that couldn't pre-clear its link (nothing to drag), or any
   * auto-step that hasn't completed within a grace period, also shows Next so
   * the user is never trapped (e.g. a run that never executes).
   */
  const autoStepStalled = ref(false)
  const canGoNext = computed(() => {
    const step = currentStep.value
    if (!step?.auto) return true
    if (step.kind === 'connect' && !clearedLink.value) return true
    return autoStepStalled.value
  })
  const canGoBack = computed(() => isActive.value && stepIndex.value > 0)

  function stepTargetNode(step: TourStep): LGraphNode | null {
    return resolveNode(step.targetNodeType, step.targetNodeOccurrence)
  }

  function preClearConnectLink(step: ConnectStep) {
    const fromNode = stepTargetNode(step)
    const toNode = resolveNode(step.toNodeType, step.toNodeOccurrence)
    if (!fromNode || !toNode) return
    toNode.disconnectInput(step.toSlot, true)
    // Only gate the step on a real reconnect if the disconnect actually took.
    if (toNode.getInputNode(step.toSlot)) return
    clearedLink.value = {
      fromNodeId: fromNode.id,
      fromSlot: step.fromSlot,
      toNode,
      toSlot: step.toSlot
    }
    app.canvas?.setDirty(true, true)
  }

  function restoreClearedLink() {
    const link = clearedLink.value
    if (!link) return
    const fromNode = app.canvas?.graph?.getNodeById(link.fromNodeId)
    if (fromNode && !link.toNode.getInputNode(link.toSlot)) {
      fromNode.connect(link.fromSlot, link.toNode, link.toSlot)
      app.canvas?.setDirty(true, true)
    }
    clearedLink.value = null
  }

  function listenForCompletion(step: TourStep): () => void {
    // The prompt step lets the user type freely and move on with Next — typing
    // is continuous, so keystrokes must not auto-advance mid-thought.

    if (step.kind === 'connect') {
      const toNode = resolveNode(step.toNodeType, step.toNodeOccurrence)
      // Only advance once the input goes from empty (we pre-cleared it) to linked
      // again — guards against a stale/undetected pre-clear firing instantly.
      const poll = window.setInterval(() => {
        if (!clearedLink.value) return
        if (toNode?.getInputNode(step.toSlot)) {
          clearedLink.value = null
          next()
        }
      }, 200)
      return () => window.clearInterval(poll)
    }

    if (step.kind === 'run') {
      const onClick = (event: MouseEvent) => {
        if ((event.target as Element | null)?.closest(step.domTarget)) next()
      }
      document.addEventListener('click', onClick, true)
      return () => document.removeEventListener('click', onClick, true)
    }

    if (step.kind === 'generating') {
      const onSuccess = () => {
        captureResultImage()
        next()
      }
      api.addEventListener('execution_success', onSuccess)
      return () => api.removeEventListener('execution_success', onSuccess)
    }

    // reveal / result wait for the user to press Next / the explore CTA.
    return () => {}
  }

  /** The result step's CTA: open the template library, then end the tour. */
  function openExplore() {
    templateDialog.show('command', { initialCategory: 'all' })
    stop()
  }

  /** The finished image lands on the Save node — capture it for the result step. */
  function captureResultImage() {
    const saveNode = resolveNode('SaveImage', 0)
    if (!saveNode) return
    resultImageUrl.value =
      nodeOutputStore.getNodeImageUrls(saveNode)?.[0] ?? null
  }

  function focusTypeInput(step: TourStep) {
    if (step.kind !== 'type') return
    const node = stepTargetNode(step)
    if (!node) return
    requestAnimationFrame(() => {
      document
        .querySelector<HTMLTextAreaElement | HTMLInputElement>(
          `[data-node-id="${node.id}"] textarea, [data-node-id="${node.id}"] input`
        )
        ?.focus()
    })
  }

  function enterStep() {
    detachStep?.()
    detachStep = null

    const step = currentStep.value
    if (!step) return

    if (step.kind === 'connect') preClearConnectLink(step)
    focusTypeInput(step)
    app.canvas?.setDirty(true, true)

    autoStepStalled.value = false
    const graceTimer = step.auto
      ? window.setTimeout(() => (autoStepStalled.value = true), 8000)
      : undefined
    const detachCompletion = listenForCompletion(step)
    detachStep = () => {
      window.clearTimeout(graceTimer)
      detachCompletion()
    }
  }

  function next() {
    if (!isActive.value) return
    if (isLast.value) {
      stop()
      return
    }
    stepIndex.value += 1
    enterStep()
  }

  function back() {
    if (!isActive.value || stepIndex.value === 0) return
    detachStep?.()
    detachStep = null
    restoreClearedLink()
    stepIndex.value -= 1
    enterStep()
  }

  /**
   * Strip the loaded template down to a clean teaching line: keep the first
   * LoadImage, the edit engine, and SaveImage; drop notes, the duplicate
   * LoadImage, and any stray node, then lay the three out evenly. A newcomer
   * sees three clear boxes, not a busy production graph.
   */
  function simplifyGraph() {
    const graph = canvasStore.currentGraph
    if (!graph) return
    const keep = new Set<LGraphNode>()
    const load = resolveNode('LoadImage', 0)
    const edit = resolveNode(EDIT_ENGINE_TYPE, 0)
    const save = resolveNode('SaveImage', 0)
    for (const node of [load, edit, save]) if (node) keep.add(node)

    for (const node of [...graph.nodes]) {
      if (!keep.has(node)) graph.remove(node)
    }

    // Balance the row: cap the very wide Save node so nothing dominates the frame.
    const row = [load, edit, save].filter((n): n is LGraphNode => !!n)
    let x = 0
    for (const node of row) {
      node.size = [Math.min(node.size[0], 320), node.size[1]]
      node.pos = [x, 0]
      x += node.size[0] + 80
    }
    app.canvas?.setDirty(true, true)
  }

  /** Frame the whole small workflow once, gently — no per-node zoom. */
  function frameWorkflow() {
    const canvas = app.canvas
    const nodes = canvas?.graph?.nodes ?? []
    if (!canvas || !nodes.length) return
    for (const node of nodes) {
      node.updateArea()
    }
    const bounds = createBounds(nodes)
    if (bounds) canvas.ds.fitToBounds(bounds, { zoom: 0.85 })
    canvas.setDirty(true, true)
  }

  async function start() {
    if (isActive.value) return
    await templateWorkflows.loadTemplates()
    await templateWorkflows.loadWorkflowTemplate(
      TOUR_TEMPLATE_ID,
      TOUR_TEMPLATE_SOURCE
    )

    simplifyGraph()
    frameWorkflow()

    isActive.value = true
    stepIndex.value = 0
    enterStep()
  }

  function stop() {
    detachStep?.()
    detachStep = null
    restoreClearedLink()
    app.canvas?.setDirty(true, true)
    isActive.value = false
    stepIndex.value = 0
    resultImageUrl.value = null
  }

  const executionProgress = computed(() =>
    Math.round(executionStore.executionProgress * 100)
  )

  return {
    isActive,
    stepIndex,
    totalSteps,
    currentStep,
    isLast,
    focusNode,
    litNodes,
    domTargetSelector,
    canGoNext,
    canGoBack,
    resultImageUrl,
    executionProgress,
    resolveNode,
    start,
    next,
    back,
    stop,
    openExplore
  }
}

export const useOnboardingTour = createSharedComposable(useOnboardingTourImpl)
