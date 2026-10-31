import { describe, expect, it } from 'vitest'

import type { MissingMediaGroup } from '@/platform/workflowErrors/missingMedia/types'
import type { MissingModelGroup } from '@/platform/workflowErrors/missingModel/types'

import {
  buildAllErrorContext,
  buildGroupErrorContext
} from './buildAgentErrorContext'
import type { MissingGroupContext } from './buildAgentErrorContext'
import type { ErrorGroup } from './types'

const EMPTY_CONTEXT: MissingGroupContext = {
  missingPackGroups: [],
  swapNodeGroups: [],
  missingModelGroups: [],
  missingMediaGroups: []
}

function executionGroup(): ErrorGroup {
  return {
    type: 'execution',
    severity: 'error',
    groupKey: 'execution:execution_failed',
    displayTitle: 'Execution failed',
    count: 1,
    priority: 1,
    blockedLastRun: false,
    cards: [
      {
        id: 'exec-5',
        title: 'KSampler',
        graphNodeId: '5',
        nodeTitle: 'Sampler',
        errors: [
          {
            message: 'RuntimeError: tensor mismatch',
            details: 'Traceback line 1\nline 2',
            isRuntimeError: true,
            exceptionType: 'RuntimeError'
          }
        ]
      }
    ]
  }
}

function missingModelGroup(): MissingModelGroup {
  return {
    directory: 'checkpoints',
    isAssetSupported: true,
    models: [
      {
        name: 'sd_xl.safetensors',
        representative: {
          nodeId: '4',
          nodeType: 'CheckpointLoaderSimple',
          widgetName: 'ckpt_name',
          name: 'sd_xl.safetensors',
          isAssetSupported: true,
          isMissing: true
        },
        referencingNodes: [{ nodeId: '4', widgetName: 'ckpt_name' }]
      }
    ]
  }
}

function missingModelErrorGroup(): ErrorGroup {
  return {
    type: 'missing_model',
    severity: 'missing',
    groupKey: 'missing_model',
    displayTitle: 'Missing Models',
    count: 1,
    priority: 2,
    blockedLastRun: false
  }
}

function missingMediaGroup(): MissingMediaGroup {
  return {
    mediaType: 'image',
    items: [
      {
        name: 'photo.png',
        mediaType: 'image',
        representative: {
          nodeId: '7',
          nodeType: 'LoadImage',
          widgetName: 'image',
          mediaType: 'image',
          name: 'photo.png',
          isMissing: true
        },
        referencingNodes: [
          { nodeId: '7', nodeType: 'LoadImage', widgetName: 'image' }
        ]
      }
    ]
  }
}

function missingMediaErrorGroup(): ErrorGroup {
  return {
    type: 'missing_media',
    severity: 'missing',
    groupKey: 'missing_media',
    displayTitle: 'Missing Inputs',
    count: 1,
    priority: 3,
    blockedLastRun: false
  }
}

describe('buildGroupErrorContext', () => {
  it('captures an execution card with node id, type, message, and details', () => {
    const context = buildGroupErrorContext(executionGroup(), EMPTY_CONTEXT, {
      workflowName: 'My Workflow'
    })

    expect(context).toMatchObject({
      scope: 'card',
      count: 1,
      severity: 'error',
      label: 'Execution failed',
      workflowName: 'My Workflow'
    })
    expect(context.problems[0]).toMatchObject({
      category: 'execution_failure',
      message: 'RuntimeError: tensor mismatch',
      details: 'Traceback line 1\nline 2',
      nodeId: '5',
      nodeType: 'KSampler',
      nodeTitle: 'Sampler'
    })
  })

  it('reads missing-model references from the sub-group context as warnings', () => {
    const context = buildGroupErrorContext(missingModelErrorGroup(), {
      ...EMPTY_CONTEXT,
      missingModelGroups: [missingModelGroup()]
    })

    expect(context.severity).toBe('warning')
    expect(context.problems).toEqual([
      {
        category: 'missing_model',
        message:
          'Missing model "sd_xl.safetensors" in checkpoints (widget ckpt_name)',
        nodeId: '4',
        nodeType: 'CheckpointLoaderSimple'
      }
    ])
  })

  it('reads missing-media references from the sub-group context', () => {
    const context = buildGroupErrorContext(missingMediaErrorGroup(), {
      ...EMPTY_CONTEXT,
      missingMediaGroups: [missingMediaGroup()]
    })

    expect(context.problems[0]).toMatchObject({
      category: 'missing_media',
      nodeId: '7',
      nodeType: 'LoadImage'
    })
    expect(context.problems[0].message).toContain(
      'Missing image input "photo.png"'
    )
  })
})

describe('buildAllErrorContext', () => {
  it('aggregates every group, escalating severity to error when any error exists', () => {
    const context = buildAllErrorContext(
      [executionGroup(), missingModelErrorGroup()],
      { ...EMPTY_CONTEXT, missingModelGroups: [missingModelGroup()] },
      { label: 'All issues', workflowName: 'My Workflow' }
    )

    expect(context).toMatchObject({
      scope: 'all',
      count: 2,
      severity: 'error',
      label: 'All issues'
    })
  })

  it('can label one card that contains several groups', () => {
    const context = buildAllErrorContext(
      [missingMediaErrorGroup()],
      { ...EMPTY_CONTEXT, missingMediaGroups: [missingMediaGroup()] },
      { label: 'Setup required', scope: 'card' }
    )

    expect(context.scope).toBe('card')
    expect(context.severity).toBe('warning')
    expect(context.label).toBe('Setup required')
  })
})
