import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import {
  authenticatedRemoteConfigState,
  remoteConfig
} from '@/platform/remoteConfig/remoteConfig'
import type { PromptEditorSurfaceVariant } from '@/platform/telemetry/types'
import { usePromptEditorExperimentStore } from '@/renderer/extensions/textEditor/promptEditorExperimentStore'

const telemetry = vi.hoisted(() => ({
  installed: true,
  trackPromptEditorExposure: vi.fn()
}))
const { trackPromptEditorExposure } = telemetry

vi.mock<unknown>(import('@/platform/telemetry'), () => ({
  useTelemetry: () => (telemetry.installed ? telemetry : null)
}))

function serve(
  variant: string | undefined,
  { authenticated = true }: { authenticated?: boolean } = {}
) {
  remoteConfig.value = { 'prompt-editor-surface': variant }
  authenticatedRemoteConfigState.value = authenticated
    ? 'authenticated'
    : 'unloaded'
}

beforeEach(() => {
  localStorage.clear()
  telemetry.installed = true
  serve(undefined, { authenticated: false })
})

describe('usePromptEditorExperimentStore', () => {
  it.for([
    { served: 'panel', authenticated: true, assignment: 'panel' },
    { served: 'control', authenticated: true, assignment: 'control' },
    { served: 'panel', authenticated: false, assignment: 'control' },
    { served: 'sidebar', authenticated: true, assignment: 'control' },
    { served: undefined, authenticated: true, assignment: 'control' }
  ])(
    'assigns $assignment when $served is served (authenticated: $authenticated)',
    ({ served, authenticated, assignment }) => {
      serve(served, { authenticated })

      expect(usePromptEditorExperimentStore().assignment).toBe(assignment)
    }
  )

  it.for<{
    served: string | undefined
    rendered: PromptEditorSurfaceVariant
    authenticated: boolean
    attributed: boolean
  }>([
    {
      served: 'panel',
      rendered: 'panel',
      authenticated: true,
      attributed: true
    },
    {
      served: 'control',
      rendered: 'control',
      authenticated: true,
      attributed: true
    },
    {
      served: 'panel',
      rendered: 'control',
      authenticated: true,
      attributed: false
    },
    {
      served: 'panel',
      rendered: 'panel',
      authenticated: false,
      attributed: false
    },
    {
      served: 'sidebar',
      rendered: 'control',
      authenticated: true,
      attributed: false
    },
    {
      served: undefined,
      rendered: 'control',
      authenticated: true,
      attributed: false
    }
  ])(
    'attributes a $rendered session when $served is served (authenticated: $authenticated): $attributed',
    ({ served, rendered, authenticated, attributed }) => {
      serve(served, { authenticated })

      expect(
        usePromptEditorExperimentStore().experimentPropertiesFor(rendered)
      ).toEqual(attributed ? { '$feature/prompt-editor-surface': served } : {})
    }
  )

  it('reports exposure once, for the arm that rendered', () => {
    serve('panel')
    const experiment = usePromptEditorExperimentStore()

    experiment.expose('control')
    experiment.expose('panel')
    experiment.expose('panel')

    expect(trackPromptEditorExposure).toHaveBeenCalledOnce()
    expect(trackPromptEditorExposure).toHaveBeenCalledWith({
      '$feature/prompt-editor-surface': 'panel'
    })
  })

  it('reports exposure again when the served arm changes', async () => {
    serve('panel')
    const experiment = usePromptEditorExperimentStore()
    experiment.expose('panel')

    serve('control')
    await nextTick()
    experiment.expose('control')

    expect(trackPromptEditorExposure.mock.calls).toEqual([
      [{ '$feature/prompt-editor-surface': 'panel' }],
      [{ '$feature/prompt-editor-surface': 'control' }]
    ])
  })

  it('keeps exposure pending until telemetry is installed', () => {
    serve('panel')
    const experiment = usePromptEditorExperimentStore()
    telemetry.installed = false
    experiment.expose('panel')

    telemetry.installed = true
    experiment.expose('panel')

    expect(trackPromptEditorExposure).toHaveBeenCalledOnce()
  })

  it.for([
    {
      failure: 'a network error',
      fail: () => (authenticatedRemoteConfigState.value = 'error')
    },
    {
      failure: 'an auth rejection that clears the config',
      fail: () => {
        remoteConfig.value = {}
        authenticatedRemoteConfigState.value = 'error'
      }
    }
  ])(
    'keeps the served arm when a refresh ends in $failure',
    async ({ fail }) => {
      serve('panel')
      const experiment = usePromptEditorExperimentStore()

      fail()
      await nextTick()

      expect(experiment.assignment).toBe('panel')
      expect(experiment.experimentPropertiesFor('panel')).toEqual({
        '$feature/prompt-editor-surface': 'panel'
      })
    }
  )

  it('reports exposure again for the next account on the same tab', () => {
    serve('panel')
    const experiment = usePromptEditorExperimentStore()
    experiment.expose('panel')

    serve(undefined, { authenticated: false })
    serve('panel')
    experiment.expose('panel')

    expect(trackPromptEditorExposure).toHaveBeenCalledTimes(2)
  })

  it('drops a QA override once the account that set it signs out', () => {
    localStorage.setItem('ff:prompt-editor-surface', '"panel"')
    const experiment = usePromptEditorExperimentStore()
    expect(experiment.assignment).toBe('panel')

    localStorage.clear()
    serve('control')

    expect(experiment.assignment).toBe('control')
  })

  it('follows a QA override without attributing or reporting exposure', () => {
    localStorage.setItem('ff:prompt-editor-surface', '"panel"')
    const experiment = usePromptEditorExperimentStore()

    experiment.expose('panel')

    expect(experiment.assignment).toBe('panel')
    expect(experiment.experimentPropertiesFor('panel')).toEqual({})
    expect(trackPromptEditorExposure).not.toHaveBeenCalled()
  })
})
