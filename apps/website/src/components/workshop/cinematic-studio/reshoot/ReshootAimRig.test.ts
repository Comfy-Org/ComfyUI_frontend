import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { h } from 'vue'

import { DEFAULT_CAMERA } from '@/lib/workshop/cinematic-studio/reshoot'
import { translationsFor } from '@/i18n/translations'
import ReshootAimRig from './ReshootAimRig.vue'

const { t: rc } = translationsFor('en')

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

      expect(screen.queryByText(help)).toBeNull()
      await userEvent.click(screen.getByRole('button', { name: help }))
      const [shownHelp] = await screen.findAllByText(help)
      expect(shownHelp).toBeVisible()
    }
  )
})
