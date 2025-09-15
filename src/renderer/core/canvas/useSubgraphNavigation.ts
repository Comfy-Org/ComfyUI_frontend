/**
 * Composable for detecting and handling subgraph navigation transitions
 *
 * Provides a clean API for reacting to subgraph enter/exit events while
 * handling the complex event detection logic internally.
 */
import { useEventListener, whenever } from '@vueuse/core'

import type { LGraph } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { app as comfyApp } from '@/scripts/app'

interface SubgraphNavigationCallbacks {
  onSubgraphEnter?: () => void
  onSubgraphExit?: () => void
  onGraphChange?: () => void // Called on any graph context change (including tab restoration)
}

/**
 * Tracks subgraph navigation and calls appropriate callbacks
 *
 * @param callbacks - Functions to call when entering/exiting subgraphs
 */
export function useSubgraphNavigation({
  onSubgraphEnter,
  onSubgraphExit,
  onGraphChange
}: SubgraphNavigationCallbacks) {
  const canvasStore = useCanvasStore()

  whenever(
    () => canvasStore.canvas,
    (canvas) => {
      // Track current graph context to detect subgraph transitions
      let currentGraph: LGraph | null = null
      let wasInSubgraph = false

      // Handle graph transitions (detects subgraph exit and tab restoration)
      useEventListener(
        canvas.canvas,
        'litegraph:set-graph',
        (event: CustomEvent<{ newGraph: LGraph; oldGraph: LGraph }>) => {
          const newGraph = event.detail?.newGraph || comfyApp.canvas?.graph
          const isInSubgraph = Boolean(comfyApp.canvas?.subgraph)

          // Always call onGraphChange for any graph context change (including tab restoration)
          if (onGraphChange) {
            onGraphChange()
          }

          // Detect subgraph exit transition
          if (newGraph && newGraph !== currentGraph) {
            const isExitingSubgraph = wasInSubgraph && !isInSubgraph

            if (isExitingSubgraph && onSubgraphExit) {
              onSubgraphExit()
            }
          }

          // Update tracking variables
          currentGraph = newGraph
          wasInSubgraph = isInSubgraph
        }
      )

      // Handle subgraph entry
      useEventListener(canvas.canvas, 'subgraph-opened', () => {
        if (onSubgraphEnter) {
          onSubgraphEnter()
        }
      })
    },
    { immediate: true }
  )
}
