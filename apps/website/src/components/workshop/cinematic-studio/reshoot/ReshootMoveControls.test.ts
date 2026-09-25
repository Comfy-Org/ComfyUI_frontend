import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'

import { DEFAULT_CAMERA } from '../../../../lib/workshop/cinematic-studio/reshoot'
import { rc } from '../../../../lib/workshop/cinematic-studio/reshoot-copy'
import ReshootMoveControls from './ReshootMoveControls.vue'

const keys = [
  { frame: 0, camera: DEFAULT_CAMERA },
  { frame: 24, camera: { ...DEFAULT_CAMERA, azimuth: 30 } }
]

describe('ReshootMoveControls', () => {
  it.for([true, false])(
    'lets keys be removed or jumped to only while not disabled: %s',
    (disabled) => {
      render(
        defineComponent({
          setup: () => () =>
            h(ReshootMoveControls, { keys, disabled, frame: 0 })
        })
      )
      const edits = [
        ...screen.getAllByRole('button', {
          name: new RegExp(rc('reshoot.move.remove').split('{time}')[0])
        }),
        ...screen.getAllByRole('button', {
          name: new RegExp(rc('reshoot.move.goTo').split('{time}')[0])
        })
      ]

      expect(edits).toHaveLength(4)
      for (const edit of edits)
        expect(edit.hasAttribute('disabled')).toBe(disabled)
    }
  )
})
