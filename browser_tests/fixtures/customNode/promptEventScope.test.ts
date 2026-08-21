import { describe, expect, it } from 'vitest'

import { eventsForPrompt, toPromptEvent } from './promptEventScope'

describe('eventsForPrompt', () => {
  it('excludes prompt-less events outside the captured prompt lifetime', () => {
    expect(
      eventsForPrompt(
        [
          { type: 'executing', node: '1' },
          { type: 'execution_start', prompt_id: 'current' },
          { type: 'executing', node: '1' },
          { type: 'execution_success', prompt_id: 'current' },
          { type: 'executed', node: '1', output: 'late' }
        ],
        'current',
        new Set()
      )
    ).toEqual([
      { type: 'execution_start', prompt_id: 'current' },
      { type: 'executing', node: '1' },
      { type: 'execution_success', prompt_id: 'current' }
    ])
  })

  it('stops attributing prompt-less events when another prompt starts', () => {
    expect(
      eventsForPrompt(
        [
          { type: 'execution_start', prompt_id: 'current' },
          { type: 'executing', node: '1' },
          { type: 'execution_start', prompt_id: 'foreign' },
          { type: 'executing', node: '1' },
          { type: 'execution_success', prompt_id: 'foreign' }
        ],
        'current',
        new Set()
      )
    ).toEqual([
      { type: 'execution_start', prompt_id: 'current' },
      { type: 'executing', node: '1' }
    ])
  })

  it('preserves the seen-prompt fallback when response capture misses', () => {
    expect(
      eventsForPrompt(
        [
          { type: 'execution_success', prompt_id: 'seen' },
          { type: 'executing', node: '1' },
          { type: 'execution_success', prompt_id: 'new' }
        ],
        undefined,
        new Set(['seen'])
      )
    ).toEqual([
      { type: 'executing', node: '1' },
      { type: 'execution_success', prompt_id: 'new' }
    ])
  })

  it('normalizes backend error whitespace without changing content', () => {
    expect(
      toPromptEvent({
        type: 'execution_error',
        exception_message: ' leading whitespace is content \r\n'
      })
    ).toMatchObject({
      error: { exceptionMessage: ' leading whitespace is content' }
    })
  })
})
