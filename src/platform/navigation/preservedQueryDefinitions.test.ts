import { describe, expect, it } from 'vitest'

import { PRESERVED_QUERY_DEFINITIONS } from '@/platform/navigation/preservedQueryDefinitions'
import { PRESERVED_QUERY_NAMESPACES } from '@/platform/navigation/preservedQueryNamespaces'

const registered = new Map(
  PRESERVED_QUERY_DEFINITIONS.map((definition) => [
    definition.namespace,
    definition.keys
  ])
)

describe('PRESERVED_QUERY_DEFINITIONS', () => {
  // A namespace a loader hydrates but the router never captures restores an
  // empty stash, so the deep link dies at the sign-in redirect with nothing to
  // show for it.
  it.for([
    [PRESERVED_QUERY_NAMESPACES.ASSETS, 'assets'],
    [PRESERVED_QUERY_NAMESPACES.SETTINGS, 'settings'],
    [PRESERVED_QUERY_NAMESPACES.TOPUP, 'topup'],
    [PRESERVED_QUERY_NAMESPACES.INVITE, 'invite'],
    [PRESERVED_QUERY_NAMESPACES.CREATE_WORKSPACE, 'create_workspace'],
    [PRESERVED_QUERY_NAMESPACES.PRICING, 'pricing']
  ])('captures %s so a redirect cannot lose it', ([namespace, key]) => {
    expect(registered.get(namespace)).toContain(key)
  })

  it('registers each namespace once', () => {
    expect(registered.size).toBe(PRESERVED_QUERY_DEFINITIONS.length)
  })
})
