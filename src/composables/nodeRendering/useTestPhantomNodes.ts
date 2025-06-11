import { onMounted, onUnmounted } from 'vue'
import { usePhantomNodes } from './usePhantomNodes'
import { useCanvasStore } from '@/stores/graphStore'
import { api } from '@/scripts/api'

/**
 * Development helper to automatically enable phantom mode for testing
 */
export function useTestPhantomNodes() {
  const { enableAllPhantomMode, getPhantomNodes } = usePhantomNodes()
  const canvasStore = useCanvasStore()

  let graphChangeHandler: (() => void) | null = null

  onMounted(() => {
    // Function to enable phantom mode for all nodes
    const enablePhantomModeForAllNodes = () => {
      if (canvasStore.canvas?.graph) {
        const count = enableAllPhantomMode()
        if (count > 0) {
          console.log(`✅ Enabled phantom mode for ${count} nodes`)
        }
        return count
      }
      return 0
    }

    // Listen for graph changes to immediately enable phantom mode for new nodes
    graphChangeHandler = () => {
      enablePhantomModeForAllNodes()
    }
    
    api.addEventListener('graphChanged', graphChangeHandler)

    // Initial attempt when mounted
    setTimeout(() => {
      enablePhantomModeForAllNodes()
    }, 100) // Much shorter timeout just to ensure canvas is ready
  })

  onUnmounted(() => {
    if (graphChangeHandler) {
      api.removeEventListener('graphChanged', graphChangeHandler)
    }
  })

  // Expose helper functions to global scope for manual testing
  if (typeof window !== 'undefined') {
    (window as any).testPhantomNodes = {
      enableAll: enableAllPhantomMode,
      getPhantom: getPhantomNodes,
      enableSingle: (nodeId: string) => {
        const { enablePhantomMode } = usePhantomNodes()
        return enablePhantomMode(nodeId)
      }
    }
    console.log('🚀 Phantom node testing helpers available on window.testPhantomNodes')
  }
}