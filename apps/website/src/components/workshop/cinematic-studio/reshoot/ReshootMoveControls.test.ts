import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'

import {
  DEFAULT_CAMERA,
  frameTime
} from '@/lib/workshop/cinematic-studio/reshoot'
import { translationsFor } from '@/i18n/translations'
import ReshootMoveControls from './ReshootMoveControls.vue'

const { t: rc } = translationsFor('en')

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
        ...keys.map((key) =>
          screen.getByRole('button', {
            name: rc(
              'reshoot.move.remove',
              {
                time: frameTime(key.frame)
              },
              { locale: 'en' }
            )
          })
        ),
        ...keys.map((key) =>
          screen.getByRole('button', {
            name: rc(
              'reshoot.move.goTo',
              { time: frameTime(key.frame) },
              { locale: 'en' }
            )
          })
        )
      ]

      expect(edits).toHaveLength(4)
      for (const edit of edits)
        expect(edit.hasAttribute('disabled')).toBe(disabled)
    }
  )
})
