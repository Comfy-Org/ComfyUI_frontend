import { computed, ref } from 'vue'

const pendingApprovalCount = ref(0)

/** True only while the browser is waiting for desktop sign-in approval. */
export const isDesktopLoginApprovalPending = computed(
  () => pendingApprovalCount.value > 0
)

/**
 * Marks the approval dialog as the active takeover for exactly as long as the
 * supplied operation is pending. A counter keeps this correct if the flow is
 * ever made concurrent.
 */
export async function withDesktopLoginApproval<T>(
  operation: () => Promise<T>
): Promise<T> {
  pendingApprovalCount.value++
  try {
    return await operation()
  } finally {
    pendingApprovalCount.value--
  }
}
