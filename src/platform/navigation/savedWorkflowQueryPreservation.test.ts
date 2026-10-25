import { beforeEach, describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { PRESERVED_QUERY_DEFINITIONS } from './preservedQueryDefinitions'
import {
  clearPreservedQuery,
  getPreservedQueryParam
} from './preservedQueryManager'
import { PRESERVED_QUERY_NAMESPACES } from './preservedQueryNamespaces'
import { installPreservedQueryTracker } from './preservedQueryTracker'

describe('private workflow redirect intent', () => {
  beforeEach(() => {
    clearPreservedQuery(PRESERVED_QUERY_NAMESPACES.WORKFLOW)
    clearPreservedQuery(PRESERVED_QUERY_NAMESPACES.WORKSPACE)
    clearPreservedQuery(PRESERVED_QUERY_NAMESPACES.DEPLOYMENT)
    clearPreservedQuery(PRESERVED_QUERY_NAMESPACES.ENVIRONMENT)
  })

  it('preserves the exact private workflow and environment through sign-in and workspace reloads', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }]
    })
    installPreservedQueryTracker(router, PRESERVED_QUERY_DEFINITIONS)

    await router.push(
      '/?workflow=c327cae8-2acf-4bfa-bb88-97948a3c008b&workspace=ws-1&deployment=dep-1&keep=original#canvas'
    )
    await router.push('/login')
    await router.push('/')

    expect(
      getPreservedQueryParam(PRESERVED_QUERY_NAMESPACES.WORKFLOW, 'workflow')
    ).toBe('c327cae8-2acf-4bfa-bb88-97948a3c008b')
    expect(
      getPreservedQueryParam(PRESERVED_QUERY_NAMESPACES.WORKFLOW, 'workspace')
    ).toBe('ws-1')
    expect(
      getPreservedQueryParam(PRESERVED_QUERY_NAMESPACES.WORKFLOW, 'deployment')
    ).toBe('dep-1')
    expect(
      getPreservedQueryParam(PRESERVED_QUERY_NAMESPACES.WORKSPACE, 'workspace')
    ).toBe('ws-1')
    expect(
      getPreservedQueryParam(
        PRESERVED_QUERY_NAMESPACES.DEPLOYMENT,
        'deployment'
      )
    ).toBe('dep-1')
  })

  it('keeps repeated workflow values invalid through redirect preservation', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }]
    })
    installPreservedQueryTracker(router, PRESERVED_QUERY_DEFINITIONS)

    await router.push('/?workflow=first&workflow=second')
    await router.push('/login')

    expect(
      getPreservedQueryParam(PRESERVED_QUERY_NAMESPACES.WORKFLOW, 'workflow')
    ).toBe('first,second')
  })

  it('keeps a standard environment target alongside the private workflow across reloads', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }]
    })
    installPreservedQueryTracker(router, PRESERVED_QUERY_DEFINITIONS)

    await router.push(
      '/?workflow=c327cae8-2acf-4bfa-bb88-97948a3c008b&workspace=ws-1&environment=standard'
    )
    await router.push('/login')
    await router.push('/')

    expect(
      getPreservedQueryParam(PRESERVED_QUERY_NAMESPACES.WORKFLOW, 'environment')
    ).toBe('standard')
    expect(
      getPreservedQueryParam(
        PRESERVED_QUERY_NAMESPACES.ENVIRONMENT,
        'environment'
      )
    ).toBe('standard')
    expect(
      getPreservedQueryParam(PRESERVED_QUERY_NAMESPACES.WORKFLOW, 'workspace')
    ).toBe('ws-1')
  })
})
