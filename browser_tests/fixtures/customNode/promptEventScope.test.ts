import { describe, expect, it } from 'vitest'

import {
  eventsForPrompt,
  toPromptEvent
} from '@e2e/fixtures/customNode/promptEventScope'

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
        'current'
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
        'current'
      )
    ).toEqual([
      { type: 'execution_start', prompt_id: 'current' },
      { type: 'executing', node: '1' }
    ])
  })
})

describe('toPromptEvent', () => {
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
