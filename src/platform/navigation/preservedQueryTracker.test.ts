import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Router, RouterHistory } from 'vue-router'
import { createMemoryHistory, createRouter } from 'vue-router'

import {
  clearPreservedQuery,
  getPreservedQueryParam,
  mergePreservedQueryIntoQuery
} from '@/platform/navigation/preservedQueryManager'
import { PRESERVED_QUERY_DEFINITIONS } from './preservedQueryDefinitions'
import { PRESERVED_QUERY_NAMESPACES } from './preservedQueryNamespaces'
import { readSavedWorkflowLink } from './savedWorkflowLink'
import { installPreservedQueryTracker } from '@/platform/navigation/preservedQueryTracker'

const STRIPPED_NAMESPACE = 'test_strip'
const SECOND_STRIPPED_NAMESPACE = 'test_strip_b'
const PLAIN_NAMESPACE = 'test_plain'

const strippedDefinition = {
  namespace: STRIPPED_NAMESPACE,
  keys: ['one_time_code'],
  stripAfterCapture: true
}

const plainDefinition = {
  namespace: PLAIN_NAMESPACE,
  keys: ['plain_code', 'plain_source']
}

const dependentDefinition = {
  namespace: PLAIN_NAMESPACE,
  keys: ['primary', 'dependent'],
  requiredKey: 'primary'
}

const REJECT_REPEATED_NAMESPACE = 'test_reject_repeated'

const rejectRepeatedDefinition = {
  namespace: REJECT_REPEATED_NAMESPACE,
  keys: ['workspace'],
  rejectRepeated: true as const
}

function createTestRouter(
  history: RouterHistory = createMemoryHistory()
): Router {
  return createRouter({
    history,
    routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }]
  })
}

describe('installPreservedQueryTracker', () => {
  beforeEach(() => {
    clearPreservedQuery(STRIPPED_NAMESPACE)
    clearPreservedQuery(SECOND_STRIPPED_NAMESPACE)
    clearPreservedQuery(PLAIN_NAMESPACE)
    clearPreservedQuery(REJECT_REPEATED_NAMESPACE)
  })

  it('strips marked keys from the URL while preserving other query and hash', async () => {
    const router = createTestRouter()
    installPreservedQueryTracker(router, [strippedDefinition])

    await router.push('/?one_time_code=otc_abc123&keep=a+b#frag')

    expect(router.currentRoute.value.fullPath).toBe('/?keep=a+b#frag')
    expect(getPreservedQueryParam(STRIPPED_NAMESPACE, 'one_time_code')).toBe(
      'otc_abc123'
    )
  })

  it('completes navigation and keeps the stash in memory when sessionStorage is blocked', async () => {
    vi.spyOn(globalThis, 'sessionStorage', 'get').mockImplementation(() => {
      throw new DOMException('Access is denied', 'SecurityError')
    })
    const router = createTestRouter()
    installPreservedQueryTracker(router, [strippedDefinition, plainDefinition])

    await router.push('/?one_time_code=otc_abc123&plain_code=alpha')

    expect(router.currentRoute.value.fullPath).toBe('/?plain_code=alpha')
    expect(getPreservedQueryParam(STRIPPED_NAMESPACE, 'one_time_code')).toBe(
      'otc_abc123'
    )
    expect(getPreservedQueryParam(PLAIN_NAMESPACE, 'plain_code')).toBe('alpha')
  })

  it('keeps params of non-strip namespaces in the URL and still captures them', async () => {
    const router = createTestRouter()
    installPreservedQueryTracker(router, [plainDefinition])

    await router.push('/?plain_code=alpha&plain_source=beta')

    expect(router.currentRoute.value.fullPath).toBe(
      '/?plain_code=alpha&plain_source=beta'
    )
    expect(getPreservedQueryParam(PLAIN_NAMESPACE, 'plain_code')).toBe('alpha')
    expect(getPreservedQueryParam(PLAIN_NAMESPACE, 'plain_source')).toBe('beta')
  })

  it('replaces a non-strip namespace stash on later captures', async () => {
    const router = createTestRouter()
    installPreservedQueryTracker(router, [plainDefinition])

    await router.push('/?plain_code=alpha&plain_source=beta')
    await router.push('/?plain_code=gamma')

    expect(getPreservedQueryParam(PLAIN_NAMESPACE, 'plain_code')).toBe('gamma')
    expect(
      getPreservedQueryParam(PLAIN_NAMESPACE, 'plain_source')
    ).toBeUndefined()
  })

  it('captures dependent keys only when their required key is present', async () => {
    const router = createTestRouter()
    installPreservedQueryTracker(router, [dependentDefinition])

    await router.push('/?primary=one&dependent=two')

    expect(getPreservedQueryParam(PLAIN_NAMESPACE, 'primary')).toBe('one')
    expect(getPreservedQueryParam(PLAIN_NAMESPACE, 'dependent')).toBe('two')
  })

  it('clears preserved state for an orphaned dependent key', async () => {
    const router = createTestRouter()
    installPreservedQueryTracker(router, [dependentDefinition])
    await router.push('/?primary=one&dependent=two')

    await router.push('/?dependent=orphan')

    expect(getPreservedQueryParam(PLAIN_NAMESPACE, 'primary')).toBeUndefined()
    expect(getPreservedQueryParam(PLAIN_NAMESPACE, 'dependent')).toBeUndefined()
  })

  it('navigates exactly once when no strip-marked keys are present', async () => {
    const router = createTestRouter()
    installPreservedQueryTracker(router, [strippedDefinition])
    let completedNavigations = 0
    router.afterEach(() => {
      completedNavigations++
    })

    await router.push('/?keep=1')

    expect(router.currentRoute.value.fullPath).toBe('/?keep=1')
    expect(completedNavigations).toBe(1)
  })

  it('scrubs empty and null values from the URL without stashing them', async () => {
    const router = createTestRouter()
    installPreservedQueryTracker(router, [strippedDefinition])

    await router.push('/?one_time_code=')
    expect(router.currentRoute.value.fullPath).toBe('/')
    expect(
      getPreservedQueryParam(STRIPPED_NAMESPACE, 'one_time_code')
    ).toBeUndefined()

    await router.push('/?one_time_code')
    expect(router.currentRoute.value.fullPath).toBe('/')
    expect(
      getPreservedQueryParam(STRIPPED_NAMESPACE, 'one_time_code')
    ).toBeUndefined()
  })

  it('clears a stale stripped value when the URL supplies an empty value', async () => {
    const router = createTestRouter()
    installPreservedQueryTracker(router, [strippedDefinition])

    await router.push('/?one_time_code=otc_abc123')
    expect(getPreservedQueryParam(STRIPPED_NAMESPACE, 'one_time_code')).toBe(
      'otc_abc123'
    )

    await router.push('/?one_time_code=')

    expect(router.currentRoute.value.fullPath).toBe('/')
    expect(
      getPreservedQueryParam(STRIPPED_NAMESPACE, 'one_time_code')
    ).toBeUndefined()
  })

  it('stashes the first value of a repeated param and cleans the URL', async () => {
    const router = createTestRouter()
    installPreservedQueryTracker(router, [strippedDefinition])

    await router.push('/?one_time_code=otc_A&one_time_code=otc_B')

    expect(router.currentRoute.value.fullPath).toBe('/')
    expect(getPreservedQueryParam(STRIPPED_NAMESPACE, 'one_time_code')).toBe(
      'otc_A'
    )
  })

  it('strips keys of multiple marked namespaces in a single redirect', async () => {
    const router = createTestRouter()
    let navigationAttempts = 0
    router.beforeEach(() => {
      navigationAttempts++
    })
    installPreservedQueryTracker(router, [
      strippedDefinition,
      {
        namespace: SECOND_STRIPPED_NAMESPACE,
        keys: ['second_code'],
        stripAfterCapture: true
      }
    ])

    await router.push('/?one_time_code=otc_x&second_code=sc_y&keep=1')

    expect(router.currentRoute.value.fullPath).toBe('/?keep=1')
    expect(navigationAttempts).toBe(2)
    expect(getPreservedQueryParam(STRIPPED_NAMESPACE, 'one_time_code')).toBe(
      'otc_x'
    )
    expect(
      getPreservedQueryParam(SECOND_STRIPPED_NAMESPACE, 'second_code')
    ).toBe('sc_y')
  })

  it('keeps the prior history entry reachable after the strip redirect', async () => {
    const router = createTestRouter()
    installPreservedQueryTracker(router, [strippedDefinition])

    await router.push('/start')
    await router.push('/?one_time_code=otc_abc123')
    expect(router.currentRoute.value.fullPath).toBe('/')

    router.go(-1)
    await vi.waitFor(() =>
      expect(router.currentRoute.value.fullPath).toBe('/start')
    )
  })

  it('keeps replace navigation from adding a back target', async () => {
    const history = createMemoryHistory()
    const router = createTestRouter(history)
    installPreservedQueryTracker(router, [strippedDefinition])

    await router.push('/start')
    await router.replace('/?one_time_code=otc_abc123')
    expect(router.currentRoute.value.fullPath).toBe('/')

    router.go(-1)

    expect(history.location).toBe('/')
  })

  it('stashes a repeated rejectRepeated value joined with a comma', async () => {
    const router = createTestRouter()
    installPreservedQueryTracker(router, [rejectRepeatedDefinition])

    await router.push('/?workspace=ws-team&workspace=ws-personal')

    expect(getPreservedQueryParam(REJECT_REPEATED_NAMESPACE, 'workspace')).toBe(
      'ws-team,ws-personal'
    )
  })

  it('stashes a single rejectRepeated value unchanged', async () => {
    const router = createTestRouter()
    installPreservedQueryTracker(router, [rejectRepeatedDefinition])

    await router.push('/?workspace=ws-team')

    expect(getPreservedQueryParam(REJECT_REPEATED_NAMESPACE, 'workspace')).toBe(
      'ws-team'
    )
  })

  it('leaves a repeated value of a non-rejectRepeated namespace as the first entry', async () => {
    const router = createTestRouter()
    installPreservedQueryTracker(router, [strippedDefinition])

    await router.push('/?one_time_code=otc_A&one_time_code=otc_B')

    expect(getPreservedQueryParam(STRIPPED_NAMESPACE, 'one_time_code')).toBe(
      'otc_A'
    )
  })

  it('stashes a bare rejectRepeated param (no value) as a bare comma', async () => {
    const router = createTestRouter()
    installPreservedQueryTracker(router, [rejectRepeatedDefinition])

    await router.push('/?workspace')

    expect(getPreservedQueryParam(REJECT_REPEATED_NAMESPACE, 'workspace')).toBe(
      ','
    )
  })

  it('stashes a repeated rejectRepeated value with a bare entry joined with a comma', async () => {
    const router = createTestRouter()
    installPreservedQueryTracker(router, [rejectRepeatedDefinition])

    await router.push('/?workspace&workspace=ws-team')

    expect(getPreservedQueryParam(REJECT_REPEATED_NAMESPACE, 'workspace')).toBe(
      ',ws-team'
    )
  })

  it('drops a bare param of a non-rejectRepeated namespace like any empty value', async () => {
    const router = createTestRouter()
    installPreservedQueryTracker(router, [
      { namespace: PLAIN_NAMESPACE, keys: ['plain_code'] }
    ])

    await router.push('/?plain_code')

    expect(
      getPreservedQueryParam(PLAIN_NAMESPACE, 'plain_code')
    ).toBeUndefined()
  })
})

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
      '/?savedFile=c327cae8-2acf-4bfa-bb88-97948a3c008b&workspace=ws-1&deployment=dep-1&keep=original#canvas'
    )
    await router.push('/login')
    await router.push('/')

    expect(
      getPreservedQueryParam(PRESERVED_QUERY_NAMESPACES.WORKFLOW, 'savedFile')
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

  it.for([
    {
      name: 'omits a previous custom target',
      previousTarget: '&workspace=ws-old&deployment=dep-old',
      nextTarget: '',
      expectedTarget: {}
    },
    {
      name: 'omits a previous standard target',
      previousTarget: '&workspace=ws-old&environment=standard',
      nextTarget: '',
      expectedTarget: {}
    },
    {
      name: 'replaces custom with standard',
      previousTarget: '&workspace=ws-old&deployment=dep-old',
      nextTarget: '&workspace=ws-new&environment=standard',
      expectedTarget: { workspace: 'ws-new', environment: 'standard' }
    },
    {
      name: 'replaces standard with custom',
      previousTarget: '&workspace=ws-old&environment=standard',
      nextTarget: '&workspace=ws-new&deployment=dep-new',
      expectedTarget: { workspace: 'ws-new', deployment: 'dep-new' }
    },
    {
      name: 'retains only the new workspace',
      previousTarget: '&workspace=ws-old&deployment=dep-old',
      nextTarget: '&workspace=ws-new',
      expectedTarget: { workspace: 'ws-new' }
    }
  ])(
    '$name when a different workflow arrives',
    async ({ previousTarget, nextTarget, expectedTarget }) => {
      const router = createTestRouter()
      installPreservedQueryTracker(router, PRESERVED_QUERY_DEFINITIONS)
      await router.push(
        `/?savedFile=c327cae8-2acf-4bfa-bb88-97948a3c008b${previousTarget}`
      )
      await router.push('/login')

      await router.push(
        `/?savedFile=5fa31309-9bc6-41a0-9f9e-e51ec9800619${nextTarget}`
      )
      await router.push('/login')

      expect(
        mergePreservedQueryIntoQuery(PRESERVED_QUERY_NAMESPACES.WORKFLOW)
      ).toEqual({
        savedFile: '5fa31309-9bc6-41a0-9f9e-e51ec9800619',
        ...expectedTarget
      })
      expect({
        ...mergePreservedQueryIntoQuery(PRESERVED_QUERY_NAMESPACES.WORKSPACE),
        ...mergePreservedQueryIntoQuery(PRESERVED_QUERY_NAMESPACES.DEPLOYMENT),
        ...mergePreservedQueryIntoQuery(PRESERVED_QUERY_NAMESPACES.ENVIRONMENT)
      }).toEqual(expectedTarget)
    }
  )

  it.for([
    {
      name: 'custom to standard',
      previousTarget: '&workspace=ws-old&deployment=dep-old',
      nextTarget: '&workspace=ws-old&environment=standard',
      expectedTarget: { workspace: 'ws-old', environment: 'standard' },
      workspaceId: 'ws-old',
      deploymentId: null,
      environment: 'standard'
    },
    {
      name: 'standard to custom',
      previousTarget: '&workspace=ws-old&environment=standard',
      nextTarget: '&workspace=ws-old&deployment=dep-new',
      expectedTarget: { workspace: 'ws-old', deployment: 'dep-new' },
      workspaceId: 'ws-old',
      deploymentId: 'dep-new',
      environment: null
    },
    {
      name: 'another workspace',
      previousTarget: '&workspace=ws-old&deployment=dep-old',
      nextTarget: '&workspace=ws-new',
      expectedTarget: { workspace: 'ws-new' },
      workspaceId: 'ws-new',
      deploymentId: null,
      environment: null
    }
  ])(
    'replaces a same-workflow target with $name',
    async ({
      previousTarget,
      nextTarget,
      expectedTarget,
      workspaceId,
      deploymentId,
      environment
    }) => {
      const router = createTestRouter()
      installPreservedQueryTracker(router, PRESERVED_QUERY_DEFINITIONS)
      await router.push(
        `/?savedFile=c327cae8-2acf-4bfa-bb88-97948a3c008b${previousTarget}`
      )
      await router.push('/login')

      await router.push(
        `/?savedFile=c327cae8-2acf-4bfa-bb88-97948a3c008b${nextTarget}`
      )

      const query =
        mergePreservedQueryIntoQuery(
          PRESERVED_QUERY_NAMESPACES.WORKFLOW,
          router.currentRoute.value.query
        ) ?? router.currentRoute.value.query
      expect(readSavedWorkflowLink(query)).toEqual({
        status: 'valid',
        savedFileId: 'c327cae8-2acf-4bfa-bb88-97948a3c008b',
        workspaceId,
        deploymentId,
        environment
      })
      expect({
        ...mergePreservedQueryIntoQuery(PRESERVED_QUERY_NAMESPACES.WORKSPACE),
        ...mergePreservedQueryIntoQuery(PRESERVED_QUERY_NAMESPACES.DEPLOYMENT),
        ...mergePreservedQueryIntoQuery(PRESERVED_QUERY_NAMESPACES.ENVIRONMENT)
      }).toEqual(expectedTarget)
    }
  )

  it('replaces target stashes restored from an earlier page load', async () => {
    sessionStorage.setItem(
      'Comfy.PreservedQuery.workspace',
      JSON.stringify({ workspace: 'ws-old' })
    )
    sessionStorage.setItem(
      'Comfy.PreservedQuery.deployment',
      JSON.stringify({ deployment: 'dep-old' })
    )
    const router = createTestRouter()
    installPreservedQueryTracker(router, PRESERVED_QUERY_DEFINITIONS)

    await router.push('/?savedFile=5fa31309-9bc6-41a0-9f9e-e51ec9800619')

    expect(
      mergePreservedQueryIntoQuery(PRESERVED_QUERY_NAMESPACES.WORKFLOW)
    ).toEqual({ savedFile: '5fa31309-9bc6-41a0-9f9e-e51ec9800619' })
    expect(
      getPreservedQueryParam(PRESERVED_QUERY_NAMESPACES.WORKSPACE, 'workspace')
    ).toBeUndefined()
    expect(
      getPreservedQueryParam(
        PRESERVED_QUERY_NAMESPACES.DEPLOYMENT,
        'deployment'
      )
    ).toBeUndefined()
  })

  it.for([
    { query: 'savedFile=invalid', savedFile: 'invalid' },
    { query: 'savedFile=first&savedFile=second', savedFile: 'first,second' },
    { query: 'savedFile', savedFile: ',' },
    { query: 'savedFile=', savedFile: undefined }
  ])('replaces stale targets for $query', async ({ query, savedFile }) => {
    const router = createTestRouter()
    installPreservedQueryTracker(router, PRESERVED_QUERY_DEFINITIONS)
    await router.push(
      '/?savedFile=c327cae8-2acf-4bfa-bb88-97948a3c008b&workspace=ws-old&deployment=dep-old'
    )

    await router.push(`/?${query}`)

    expect(
      getPreservedQueryParam(PRESERVED_QUERY_NAMESPACES.WORKFLOW, 'savedFile')
    ).toBe(savedFile)
    expect(
      getPreservedQueryParam(PRESERVED_QUERY_NAMESPACES.WORKFLOW, 'workspace')
    ).toBeUndefined()
    expect(
      getPreservedQueryParam(PRESERVED_QUERY_NAMESPACES.WORKFLOW, 'deployment')
    ).toBeUndefined()
    expect({
      ...mergePreservedQueryIntoQuery(PRESERVED_QUERY_NAMESPACES.WORKSPACE),
      ...mergePreservedQueryIntoQuery(PRESERVED_QUERY_NAMESPACES.DEPLOYMENT),
      ...mergePreservedQueryIntoQuery(PRESERVED_QUERY_NAMESPACES.ENVIRONMENT)
    }).toEqual({})
  })

  it.for([
    {
      target: '&workspace=ws-old&deployment=dep-old',
      nextTarget: '',
      expectedTarget: { workspace: 'ws-old', deployment: 'dep-old' }
    },
    {
      target: '&workspace=ws-old&environment=standard',
      nextTarget: '',
      expectedTarget: { workspace: 'ws-old', environment: 'standard' }
    },
    {
      target: '&workspace=ws-old&deployment=dep-old',
      nextTarget: '&workspace=ws-old',
      expectedTarget: { workspace: 'ws-old', deployment: 'dep-old' }
    },
    {
      target: '&workspace=ws-old&environment=standard',
      nextTarget: '&workspace=ws-old&environment=standard',
      expectedTarget: { workspace: 'ws-old', environment: 'standard' }
    }
  ])(
    'retains $target when the same workflow continues through redirects',
    async ({ target, nextTarget, expectedTarget }) => {
      const router = createTestRouter()
      installPreservedQueryTracker(router, PRESERVED_QUERY_DEFINITIONS)
      await router.push(
        `/?savedFile=c327cae8-2acf-4bfa-bb88-97948a3c008b${target}`
      )
      await router.push('/login')

      await router.push(
        `/?savedFile=c327cae8-2acf-4bfa-bb88-97948a3c008b${nextTarget}`
      )

      expect(
        mergePreservedQueryIntoQuery(PRESERVED_QUERY_NAMESPACES.WORKFLOW)
      ).toEqual({
        savedFile: 'c327cae8-2acf-4bfa-bb88-97948a3c008b',
        ...expectedTarget
      })
      expect({
        ...mergePreservedQueryIntoQuery(PRESERVED_QUERY_NAMESPACES.WORKSPACE),
        ...mergePreservedQueryIntoQuery(PRESERVED_QUERY_NAMESPACES.DEPLOYMENT),
        ...mergePreservedQueryIntoQuery(PRESERVED_QUERY_NAMESPACES.ENVIRONMENT)
      }).toEqual(expectedTarget)
    }
  )

  it('keeps repeated workflow values invalid through redirect preservation', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }]
    })
    installPreservedQueryTracker(router, PRESERVED_QUERY_DEFINITIONS)

    await router.push('/?savedFile=first&savedFile=second')
    await router.push('/login')

    expect(
      getPreservedQueryParam(PRESERVED_QUERY_NAMESPACES.WORKFLOW, 'savedFile')
    ).toBe('first,second')
  })

  it('keeps a standard environment target alongside the private workflow across reloads', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }]
    })
    installPreservedQueryTracker(router, PRESERVED_QUERY_DEFINITIONS)

    await router.push(
      '/?savedFile=c327cae8-2acf-4bfa-bb88-97948a3c008b&workspace=ws-1&environment=standard'
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
