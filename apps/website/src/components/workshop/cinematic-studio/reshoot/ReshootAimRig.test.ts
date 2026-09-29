import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { h } from 'vue'

import { DEFAULT_CAMERA } from '../../../../lib/workshop/cinematic-studio/reshoot'
import { rc } from '../../../../lib/workshop/cinematic-studio/reshoot-copy'
import ReshootAimRig from './ReshootAimRig.vue'

describe('ReshootAimRig', () => {
  it.for(['reshoot.distanceHelp', 'reshoot.keepAimHelp'] as const)(
    'keeps %s behind an info button until asked for',
    async (key) => {
      render({
        setup: () => () =>
          h(ReshootAimRig, {
            clip: 'clip.mp4',
            camera: DEFAULT_CAMERA,
            keepAim: true
          })
      })
      const help = rc(key)

      // The slider keeps a screen-reader copy of its hint, so only the copies
      // a sighted reader could see count as the help being shown.
      const onScreen = { ignore: 'script, style, .sr-only' }

      expect(screen.queryByText(help, onScreen)).toBeNull()
      await userEvent.click(screen.getByRole('button', { name: help }))
      const [shownHelp] = await screen.findAllByText(help, onScreen)
      expect(shownHelp).toBeVisible()
    }
  )
})
