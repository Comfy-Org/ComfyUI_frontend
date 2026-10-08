import { readFileSync } from 'node:fs'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { loadRuntimeConfig, parseFastLaneConfig } from './config.ts'
import type { FastLaneConfig } from './types.ts'

const lane: FastLaneConfig = {
  schemaVersion: 1,
  id: 'website',
  pathPrefixes: ['apps/website/'],
  approval: {
    identity: 'christian-byrne',
    trustedAuthors: ['bertfy'],
    approvalLabel: 'website-fast-lane:approve',
    trustedLabelers: ['drjkl'],
    holdLabel: 'website-fast-lane:hold'
  },
  merge: { mode: 'automatic', method: 'SQUASH' }
}

describe('lane configuration', () => {
  it('normalizes logins while preserving the reviewed path policy', () => {
    expect(
      parseFastLaneConfig({
        ...lane,
        approval: {
          ...lane.approval,
          identity: 'Christian-Byrne',
          trustedAuthors: ['BertFY', 'bertfy'],
          trustedLabelers: ['DrJKL']
        }
      })
    ).toEqual(lane)
  })

  it('parses the checked-in website lane', () => {
    const shipped: unknown = JSON.parse(
      readFileSync('.github/fast-lanes/website.json', 'utf8')
    )
    expect(parseFastLaneConfig(shipped).pathPrefixes).toEqual(['apps/website/'])
  })

  it.for([
    {
      key: 'schema version',
      value: { ...lane, schemaVersion: 2 },
      message: 'schemaVersion must be 1'
    },
    {
      key: 'empty path policy',
      value: { ...lane, pathPrefixes: [] },
      message: 'pathPrefixes must be an array'
    },
    {
      key: 'ambiguous path prefix',
      value: { ...lane, pathPrefixes: ['apps/website'] },
      message: 'relative directory prefixes'
    },
    {
      key: 'absolute path prefix',
      value: { ...lane, pathPrefixes: ['/apps/website/'] },
      message: 'relative directory prefixes'
    },
    {
      key: 'parent path segment',
      value: { ...lane, pathPrefixes: ['apps/website/../'] },
      message: 'relative directory prefixes'
    },
    {
      key: 'unknown merge mode',
      value: { ...lane, merge: { mode: 'sometimes', method: 'SQUASH' } },
      message: 'automatic or manual'
    },
    {
      key: 'unknown merge method',
      value: { ...lane, merge: { mode: 'automatic', method: 'FAST_FORWARD' } },
      message: 'MERGE, REBASE, or SQUASH'
    }
  ])('rejects $key', ({ value, message }) => {
    expect(() => parseFastLaneConfig(value)).toThrow(message)
  })
})

describe('runtime configuration', () => {
  beforeEach(() => {
    vi.stubEnv('FAST_LANE_CONFIG', '.github/fast-lanes/website.json')
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
      expected: { actor: 'drjkl', label: 'website-fast-lane:approve' }
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

  it('requires the resolved pull request number', () => {
    vi.stubEnv('PR_NUMBER', '')
    expect(() => loadRuntimeConfig()).toThrow('PR_NUMBER is required')
  })
})
