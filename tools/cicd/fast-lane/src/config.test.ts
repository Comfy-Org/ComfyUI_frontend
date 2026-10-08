import { beforeEach, describe, expect, it, vi } from 'vitest'

import { operatorLabelEvent } from './__fixtures__/lane.ts'
import { loadRuntimeConfig } from './config.ts'
import { lanes } from './lanes.ts'

it.for(lanes)('keeps the $id lane in the form the engine compares', (lane) => {
  for (const value of Object.values(lane.approval).flat()) {
    expect(value).toBe(value.toLowerCase())
  }
  for (const prefix of lane.pathPrefixes) {
    expect(prefix).toMatch(/\/$/)
    expect(prefix).not.toMatch(/^\/|(^|\/)\.\.\//)
  }
})

describe('runtime configuration', () => {
  beforeEach(() => {
    vi.stubEnv('FAST_LANE', 'website')
    vi.stubEnv('GITHUB_REPOSITORY', 'Comfy-Org/ComfyUI_frontend')
    vi.stubEnv('PR_NUMBER', '42')
    vi.stubEnv('PR_HEAD_SHA', 'head-sha')
    vi.stubEnv('FAST_LANE_DEFAULT_BRANCH', 'main')
  })

  it.for([
    {
      name: 'an operator label event',
      eventName: 'pull_request_target',
      action: 'labeled',
      expected: operatorLabelEvent
    },
    {
      name: 'an unlabeled event',
      eventName: 'pull_request_target',
      action: 'unlabeled',
      expected: undefined
    },
    {
      name: 'a check completion',
      eventName: 'workflow_run',
      action: 'labeled',
      expected: undefined
    }
  ])(
    'reads $name as label event $expected',
    ({ eventName, action, expected }) => {
      vi.stubEnv('GITHUB_EVENT_NAME', eventName)
      vi.stubEnv('FAST_LANE_EVENT_ACTION', action)
      vi.stubEnv('FAST_LANE_EVENT_ACTOR', 'DrJKL')
      vi.stubEnv('FAST_LANE_EVENT_LABEL', 'Website-Fast-Lane:Approve')
      expect(loadRuntimeConfig().labelEvent).toEqual(expected)
    }
  )

  it('rejects an unconfigured lane', () => {
    vi.stubEnv('FAST_LANE', 'docs')
    expect(() => loadRuntimeConfig()).toThrow('not a configured lane')
  })

  it('requires the pull request number', () => {
    vi.stubEnv('PR_NUMBER', '')
    expect(() => loadRuntimeConfig()).toThrow('PR_NUMBER is required')
  })
})
