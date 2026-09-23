import { describe, expect, it } from 'vitest'

import { workflowReach } from './workflow-reach'

describe('workflowReach', () => {
  // Both of these run in the visitor's browser and differ only in which
  // engine it talks to, so neither is a reason to mark a card.
  it.for([
    { inline: false, expected: 'cloud' },
    { inline: true, expected: 'here' }
  ])(
    'runs an ordinary workflow in the browser ($expected)',
    ({ inline, expected }) => {
      expect(workflowReach('video_ltx2_3_i2v', inline)).toBe(expected)
    }
  )

  // The one with a server of its own is the one nothing shared can run, and
  // it stays that way however it is opened.
  it.for([{ inline: false }, { inline: true }])(
    'keeps the one that needs its own deployment out of reach',
    ({ inline }) => {
      expect(
        workflowReach(
          'template_ltx2_3_obscura_remova_lora_remove_object_from_video',
          inline
        )
      ).toBe('endpoint')
    }
  )

  it('asks nothing of a workflow the launch list does not carry', () => {
    expect(workflowReach('not-a-template', false)).toBe('cloud')
  })
})
