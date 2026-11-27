import type { LocationQueryRaw } from 'vue-router'

import {
  capturePreservedQuery,
  clearPreservedQuery,
  getPreservedQueryParam
} from '@/platform/navigation/preservedQueryManager'
import { PRESERVED_QUERY_NAMESPACES } from '@/platform/navigation/preservedQueryNamespaces'

const NAMESPACE = PRESERVED_QUERY_NAMESPACES.PAYMENT_WORKSPACE
const PAYMENT_PARAMS = ['topup', 'pricing']

function requestedWorkspace(value: LocationQueryRaw[string]): string {
  const values = Array.isArray(value) ? value : [value]
  return values.map((entry) => entry ?? '').join(',') || ','
}

/** Remembers the workspace a payment link names, so it outlives the loaders
 * that strip `workspace` and the reload a workspace switch triggers. */
export function rememberPaymentLinkWorkspace(query: LocationQueryRaw): void {
  if (!('workspace' in query)) return
  if (!PAYMENT_PARAMS.some((param) => param in query)) return
  capturePreservedQuery(
    NAMESPACE,
    { workspace: requestedWorkspace(query.workspace) },
    ['workspace']
  )
}

/** Whether a remembered payment link names a workspace other than the active one. */
export function isPaymentLinkWorkspaceRefused(
  activeWorkspaceId: string | undefined
): boolean {
  const requested = getPreservedQueryParam(NAMESPACE, 'workspace')
  return requested !== undefined && requested !== activeWorkspaceId
}

export function forgetPaymentLinkWorkspace(): void {
  clearPreservedQuery(NAMESPACE)
}
