import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import type {
  ConflictType,
  SystemEnvironment
} from '@/types/conflictDetectionTypes'

interface IncompatibleNodeInfo {
  nodeId: string
  nodeName: string
  disableReason: ConflictType
  conflictDetails: string
  detectedAt: string
}

/**
 * Store for managing node compatibility checking functionality.
 * Follows error-resilient patterns from useConflictDetection composable.
 */
export const useNodeCompatibilityStore = defineStore(
  'nodeCompatibility',
  () => {
    // Core state
    const isChecking = ref(false)
    const lastCheckTime = ref<string | null>(null)
    const checkError = ref<string | null>(null)
    const systemEnvironment = ref<SystemEnvironment | null>(null)

    // Node tracking maps
    const incompatibleNodes = ref<Map<string, IncompatibleNodeInfo>>(new Map())
    const failedImportNodes = ref<Set<string>>(new Set())
    const bannedNodes = ref<Set<string>>(new Set())
    const securityPendingNodes = ref<Set<string>>(new Set())

    // User interaction state
    const hasShownNotificationModal = ref(false)
    const pendingNotificationNodes = ref<IncompatibleNodeInfo[]>([])

    // Computed properties
    const hasIncompatibleNodes = computed(
      () => incompatibleNodes.value.size > 0
    )
    const totalIncompatibleCount = computed(
      () =>
        incompatibleNodes.value.size +
        failedImportNodes.value.size +
        bannedNodes.value.size
    )

    const incompatibleNodesList = computed(() =>
      Array.from(incompatibleNodes.value.values())
    )

    const shouldShowNotification = computed(() => {
      // Show notification if there are incompatible nodes and we haven't shown notification yet
      return hasIncompatibleNodes.value && !hasShownNotificationModal.value
    })

    /**
     * Checks if a node has compatibility issues.
     */
    function hasNodeCompatibilityIssues(nodeId: string): boolean {
      return (
        incompatibleNodes.value.has(nodeId) ||
        failedImportNodes.value.has(nodeId) ||
        bannedNodes.value.has(nodeId)
      )
    }

    /**
     * Gets the compatibility info for a node.
     */
    function getNodeCompatibilityInfo(
      nodeId: string
    ): IncompatibleNodeInfo | null {
      return incompatibleNodes.value.get(nodeId) || null
    }

    /**
     * Adds a node to the incompatible list.
     */
    function addIncompatibleNode(
      nodeId: string,
      nodeName: string,
      reason: ConflictType,
      details: string
    ): void {
      const info: IncompatibleNodeInfo = {
        nodeId,
        nodeName,
        disableReason: reason,
        conflictDetails: details,
        detectedAt: new Date().toISOString()
      }

      incompatibleNodes.value.set(nodeId, info)

      // Add to pending list (for notification purposes)
      if (!hasShownNotificationModal.value) {
        pendingNotificationNodes.value.push(info)
      }
    }

    /**
     * Removes a node from the incompatible list.
     */
    function removeIncompatibleNode(nodeId: string): void {
      incompatibleNodes.value.delete(nodeId)
      failedImportNodes.value.delete(nodeId)
      bannedNodes.value.delete(nodeId)
      securityPendingNodes.value.delete(nodeId)

      // Remove from pending list
      pendingNotificationNodes.value = pendingNotificationNodes.value.filter(
        (node) => node.nodeId !== nodeId
      )
    }

    /**
     * Clears all compatibility check results.
     */
    function clearResults(): void {
      incompatibleNodes.value.clear()
      failedImportNodes.value.clear()
      bannedNodes.value.clear()
      securityPendingNodes.value.clear()
      pendingNotificationNodes.value = []
      checkError.value = null
    }

    /**
     * Marks that the notification modal has been shown.
     */
    function markNotificationModalShown(): void {
      hasShownNotificationModal.value = true
      pendingNotificationNodes.value = []
    }

    /**
     * Resets the notification modal state (for testing or re-initialization).
     */
    function resetNotificationModalState(): void {
      hasShownNotificationModal.value = false
      pendingNotificationNodes.value = Array.from(
        incompatibleNodes.value.values()
      )
    }

    /**
     * Updates the system environment information.
     */
    function setSystemEnvironment(env: SystemEnvironment): void {
      systemEnvironment.value = env
    }

    /**
     * Sets the checking state.
     */
    function setCheckingState(checking: boolean): void {
      isChecking.value = checking
      if (checking) {
        checkError.value = null
      }
    }

    /**
     * Records a successful check completion.
     */
    function recordCheckCompletion(): void {
      lastCheckTime.value = new Date().toISOString()
      isChecking.value = false
    }

    /**
     * Records a check error.
     */
    function recordCheckError(error: string): void {
      checkError.value = error
      isChecking.value = false
    }

    /**
     * Gets a summary of the current compatibility state.
     */
    function getCompatibilitySummary() {
      return {
        totalChecked: lastCheckTime.value ? 'completed' : 'pending',
        incompatibleCount: incompatibleNodes.value.size,
        failedImportCount: failedImportNodes.value.size,
        bannedCount: bannedNodes.value.size,
        securityPendingCount: securityPendingNodes.value.size,
        totalIssues: totalIncompatibleCount.value,
        lastCheckTime: lastCheckTime.value,
        hasError: !!checkError.value
      }
    }

    return {
      // State
      isChecking: computed(() => isChecking.value),
      lastCheckTime: computed(() => lastCheckTime.value),
      checkError: computed(() => checkError.value),
      systemEnvironment: computed(() => systemEnvironment.value),

      // Node tracking
      incompatibleNodes: computed(() => incompatibleNodes.value),
      incompatibleNodesList,
      failedImportNodes: computed(() => failedImportNodes.value),
      bannedNodes: computed(() => bannedNodes.value),
      securityPendingNodes: computed(() => securityPendingNodes.value),

      // User interaction
      hasShownNotificationModal: computed(
        () => hasShownNotificationModal.value
      ),
      pendingNotificationNodes: computed(() => pendingNotificationNodes.value),
      shouldShowNotification,

      // Computed
      hasIncompatibleNodes,
      totalIncompatibleCount,

      // Methods
      hasNodeCompatibilityIssues,
      getNodeCompatibilityInfo,
      addIncompatibleNode,
      removeIncompatibleNode,
      clearResults,
      markNotificationModalShown,
      resetNotificationModalState,
      setSystemEnvironment,
      setCheckingState,
      recordCheckCompletion,
      recordCheckError,
      getCompatibilitySummary
    }
  }
)
