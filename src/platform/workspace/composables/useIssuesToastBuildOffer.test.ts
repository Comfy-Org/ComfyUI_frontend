import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'

import { useWorkflowNeedsDeployment } from '@/platform/workspace/composables/useCustomDeploymentOffered'
import type { DeploymentCompatibilityMark } from '@/platform/workspace/composables/useDeploymentCompatibility'
import { useDeploymentCompatibility } from '@/platform/workspace/composables/useDeploymentCompatibility'
import { useIssuesToastBuildOffer } from '@/platform/workspace/composables/useIssuesToastBuildOffer'
import {
  loadedEvent,
  reduceDeploymentPick
} from '@/platform/workspace/deploymentPickState'
import { openWorkflowNeedsDeploymentDialog } from '@/platform/workspace/openCustomDeploymentDialog'
import { openWorkflowForCheck } from '@/platform/workspace/openWorkflowForCheck'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'

vi.mock(import('@/platform/workspace/composables/useCustomDeploymentOffered'))
vi.mock(import('@/platform/workspace/composables/useDeploymentCompatibility'))
vi.mock(import('@/platform/workspace/openCustomDeploymentDialog'))
vi.mock(import('@/platform/workspace/openWorkflowForCheck'))

const RUNS: DeploymentCompatibilityMark = { kind: 'runs' }
const MISSING: DeploymentCompatibilityMark = {
  kind: 'missing',
  nodeTypes: ['ApplyInstantID']
}

const needsDeployment = ref(true)
const marks = ref<Record<string, DeploymentCompatibilityMark | null>>({})

function loadDeployments(names: string[]) {
  useDeploymentPickStore().state = reduceDeploymentPick(
    { phase: 'idle' },
    loadedEvent({
      builds_visible: true,
      items: names.map((name) => ({
        deployment_id: name,
        deployment_name: name,
        release_id: `rel-${name}`,
        status: 'ready',
        created_at: '2026-10-01T00:00:00Z',
        can_start: false
      }))
    })
  )
}

beforeEach(() => {
  needsDeployment.value = true
  marks.value = { cloud: MISSING }
  vi.mocked(useWorkflowNeedsDeployment).mockReturnValue(
    computed(() => needsDeployment.value)
  )
  vi.mocked(useDeploymentCompatibility).mockReturnValue({
    compatibility: computed(() => null),
    markFor: (id: string | null) => marks.value[id ?? 'cloud'] ?? null,
    deploymentsThatRunIt: computed(() => null)
  })
  vi.mocked(openWorkflowForCheck).mockReturnValue({
    nodeTypes: ['ApplyInstantID', 'SaveImage'],
    missingNodeTypes: ['ApplyInstantID']
  })
  vi.mocked(openWorkflowNeedsDeploymentDialog).mockResolvedValue(true)
})

describe('useIssuesToastBuildOffer', () => {
  it('offers to create a Custom Build when the workspace has none', () => {
    loadDeployments([])

    expect(useIssuesToastBuildOffer().offer.value).toEqual({ kind: 'create' })
  })

  it('offers to switch to the first build that runs the workflow', () => {
    loadDeployments(['Sketch Lab', 'Portrait Studio'])
    marks.value = {
      ...marks.value,
      'Sketch Lab': MISSING,
      'Portrait Studio': RUNS
    }

    expect(useIssuesToastBuildOffer().offer.value).toEqual({
      kind: 'switch',
      buildName: expect.stringContaining('Portrait Studio')
    })
  })

  it('offers to create a Custom Build when no build runs the workflow', () => {
    loadDeployments(['Sketch Lab'])
    marks.value = { ...marks.value, 'Sketch Lab': MISSING }

    expect(useIssuesToastBuildOffer().offer.value).toEqual({ kind: 'create' })
  })

  it('offers nothing until the check answers for every build', () => {
    loadDeployments(['Sketch Lab'])

    expect(useIssuesToastBuildOffer().offer.value).toBeNull()
  })

  it('offers nothing when the workflow needs no build', () => {
    needsDeployment.value = false
    loadDeployments([])

    expect(useIssuesToastBuildOffer().offer.value).toBeNull()
  })

  it('opens the workflow deployment dialog from the issues toast', () => {
    useIssuesToastBuildOffer().open()

    expect(openWorkflowNeedsDeploymentDialog).toHaveBeenCalledExactlyOnceWith(
      'issues_toast'
    )
  })
})
