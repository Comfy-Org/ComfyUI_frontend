import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'

/**
 * Requests other surfaces make of the errors tab: focus one node's errors,
 * or open the details of specific error groups. The errors tab consumes and
 * clears each request.
 */
export const useErrorsTabRequestStore = defineStore('errorsTabRequest', () => {
  const focusedNodeId = ref<string | null>(null)
  const detailsRequest = shallowRef<readonly string[] | null>(null)

  function focusNode(graphNodeId: string) {
    focusedNodeId.value = graphNodeId
  }

  function clearFocusedNode() {
    focusedNodeId.value = null
  }

  function requestDetails(groupKeys: readonly string[]) {
    detailsRequest.value = [...groupKeys]
  }

  function clearDetailsRequest() {
    detailsRequest.value = null
  }

  return {
    focusedNodeId,
    detailsRequest,
    focusNode,
    clearFocusedNode,
    requestDetails,
    clearDetailsRequest
  }
})
