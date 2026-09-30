import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'

import {
  DEFAULT_CAMERA,
  frameTime
} from '../../../../lib/workshop/cinematic-studio/reshoot'
import { rc } from '../../../../lib/workshop/cinematic-studio/reshoot-copy'
import ReshootMoveControls from './ReshootMoveControls.vue'

const keys = [
  { frame: 0, camera: DEFAULT_CAMERA },
  { frame: 24, camera: { ...DEFAULT_CAMERA, azimuth: 30 } }
]

describe('ReshootMoveControls', () => {
  it.for([true, false])(
    'lets keys be removed or cleared only while not disabled: %s',
    (disabled) => {
      render(
        defineComponent({
          setup: () => () =>
            h(ReshootMoveControls, {
              keys,
              disabled,
              frame: 0,
              motion: 'linear'
            })
        })
      )
      const edits = [
        ...keys.map((key) =>
          screen.getByRole('button', {
            name: rc('reshoot.move.remove', 'en', {
              time: frameTime(key.frame)
            })
          })
        ),
        screen.getByRole('button', { name: rc('reshoot.move.clear') })
      ]

      for (const edit of edits)
        expect(edit.hasAttribute('disabled')).toBe(disabled)
    }
  )
})
