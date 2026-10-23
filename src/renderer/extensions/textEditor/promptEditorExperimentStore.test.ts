import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  authenticatedRemoteConfigState,
  remoteConfig
} from '@/platform/remoteConfig/remoteConfig'
import { usePromptEditorExperimentStore } from '@/renderer/extensions/textEditor/promptEditorExperimentStore'

const trackPromptEditorExposure = vi.hoisted(() => vi.fn())

vi.mock<unknown>(import('@/platform/telemetry'), () => ({
  useTelemetry: () => ({ trackPromptEditorExposure })
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

  it('attributes events to the served arm once the authenticated config loads', () => {
    serve('panel')

    expect(usePromptEditorExperimentStore().experimentProperties).toEqual({
      '$feature/prompt-editor-surface': 'panel'
    })
  })

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

  it('follows a QA override without attributing or reporting exposure', () => {
    localStorage.setItem('ff:prompt-editor-surface', '"panel"')
    const experiment = usePromptEditorExperimentStore()

    experiment.expose('panel')

    expect(experiment.assignment).toBe('panel')
    expect(experiment.experimentProperties).toEqual({})
    expect(trackPromptEditorExposure).not.toHaveBeenCalled()
  })
})
