import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { workflowNodeTypes } from '@/platform/workspace/composables/useDeploymentCompatibility'
import { openWorkflowForCheck } from '@/platform/workspace/openWorkflowForCheck'
import { sanitizeNodeName } from '@/scripts/app'

vi.mock(import('@/scripts/app'))
vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(
  import('@/platform/workspace/composables/useDeploymentCompatibility'),
  () => ({
    workflowNodeTypes: vi.fn(() => ['BiRefNet', 'SaveImage']),
    useDeploymentCompatibility: vi.fn()
  })
)

describe(openWorkflowForCheck, () => {
  beforeEach(() => {
    vi.mocked(sanitizeNodeName).mockImplementation((name) =>
      name.replace(/[&<>"'`=]/g, '')
    )
    vi.mocked(useFeatureFlags().flags).deploymentCompatibilityMarksEnabled =
      true
  })

  it('reads the node types the check sends, and spells the missing ones the same way', () => {
    expect(
      openWorkflowForCheck([
        { type: 'BiRefNet', isReplaceable: false },
        'workflow>Cutout'
      ])
    ).toEqual({
      nodeTypes: ['BiRefNet', 'SaveImage'],
      missingNodeTypes: ['BiRefNet', 'workflowCutout']
    })
  })

  it('reads no node types while the check is off', () => {
    vi.mocked(useFeatureFlags().flags).deploymentCompatibilityMarksEnabled =
      false

    expect(openWorkflowForCheck(['BiRefNet']).nodeTypes).toEqual([])
    expect(workflowNodeTypes).not.toHaveBeenCalled()
  })

  it('reads no node types when walking the graph throws', () => {
    vi.mocked(workflowNodeTypes).mockImplementationOnce(() => {
      throw new Error('Circular subgraph')
    })

    expect(openWorkflowForCheck(['BiRefNet']).nodeTypes).toEqual([])
  })
})
