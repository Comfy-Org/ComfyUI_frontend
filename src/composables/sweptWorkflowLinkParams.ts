import type { LocationQuery } from 'vue-router'

import type { useWorkflowLinkUrlLoader } from '@/composables/useWorkflowLinkUrlLoader'
import {
  clearPreservedQuery,
  getPreservedQueryParam
} from '@/platform/navigation/preservedQueryManager'
import { PRESERVED_QUERY_NAMESPACES } from '@/platform/navigation/preservedQueryNamespaces'

/** The settled workflow-id params the deep-link sweep may drop; clears a settled stash. */
export function sweptWorkflowLinkParams(
  loader: ReturnType<typeof useWorkflowLinkUrlLoader> | null,
  query: LocationQuery
): string[] {
  if (!loader) return []
  const stashed = getPreservedQueryParam(
    PRESERVED_QUERY_NAMESPACES.WORKFLOW_ID,
    'workflowId'
  )
  if (stashed !== undefined && loader.isLinkSettled(stashed))
    clearPreservedQuery(PRESERVED_QUERY_NAMESPACES.WORKFLOW_ID)
  return 'workflowId' in query && loader.isLinkSettled(query.workflowId)
    ? ['workflowId']
    : []
}
