import { describe, expect, it } from 'vitest'

import type { ComfyMetadata } from '@/types/metadataTypes'

import { EXPECTED_PROMPT, EXPECTED_WORKFLOW } from './__fixtures__/helpers'
import {
  getFromLegacyComment,
  withLegacyCommentFallback
} from './legacyComment'

const PROMPT_JSON = JSON.stringify(EXPECTED_PROMPT)

describe('getFromLegacyComment', () => {
  it.for([
    {
      name: 'object workflow, string-encoded prompt (VHS before Jan 2026)',
      comment: JSON.stringify({
        prompt: PROMPT_JSON,
        workflow: EXPECTED_WORKFLOW
      }),
      expected: { workflow: EXPECTED_WORKFLOW, prompt: EXPECTED_PROMPT }
    },
    {
      name: 'both fields as objects',
      comment: JSON.stringify({
        prompt: EXPECTED_PROMPT,
        workflow: EXPECTED_WORKFLOW
      }),
      expected: { workflow: EXPECTED_WORKFLOW, prompt: EXPECTED_PROMPT }
    },
    {
      name: 'prompt only',
      comment: JSON.stringify({ prompt: PROMPT_JSON }),
      expected: { prompt: EXPECTED_PROMPT }
    },
    {
      name: 'bare NaN tokens from Python json.dumps',
      comment:
        '{"prompt": {"1": {"class_type": "KSampler", "inputs": {"cfg": NaN}}}}',
      expected: {
        prompt: { '1': { class_type: 'KSampler', inputs: { cfg: null } } }
      }
    },
    { name: 'plain text comment', comment: 'made with ffmpeg', expected: {} },
    { name: 'JSON array', comment: '[1, 2]', expected: {} },
    {
      name: 'unparseable string field',
      comment: JSON.stringify({ workflow: 'not json' }),
      expected: {}
    }
  ])('$name', ({ comment, expected }) => {
    expect(getFromLegacyComment(comment)).toEqual(expected)
  })
})

describe('withLegacyCommentFallback', () => {
  const comment = JSON.stringify({
    prompt: PROMPT_JSON,
    workflow: EXPECTED_WORKFLOW
  })

  it('keeps metadata that already has its own prompt', () => {
    const own: ComfyMetadata = {
      prompt: { '2': { class_type: 'Own', inputs: {} } }
    }
    expect(withLegacyCommentFallback(own, comment)).toBe(own)
  })

  it('fills workflow and prompt when neither key is present', () => {
    expect(withLegacyCommentFallback({ comment }, comment)).toEqual({
      comment,
      workflow: EXPECTED_WORKFLOW,
      prompt: EXPECTED_PROMPT
    })
  })
})
