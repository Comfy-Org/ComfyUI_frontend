import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { h } from 'vue'

import type { ReshootTake } from '@/composables/useReshoot'
import { translationsFor } from '@/i18n/translations'
import { DEFAULT_CAMERA } from '@/lib/workshop/cinematic-studio/reshoot'
import ReshootOutputBar from './ReshootOutputBar.vue'

const { t: rc } = translationsFor('en')

const take = (extra: Partial<ReshootTake> = {}): ReshootTake => ({
  id: 'take-1',
  n: 1,
  camera: DEFAULT_CAMERA,
  keys: 0,
  status: 'done',
  startedAt: 0,
  url: 'take.mp4',
  ...extra
})

describe('ReshootOutputBar', () => {
  it.for([
    { name: 'a plain take', extra: {}, warp: false, sound: false },
    {
      name: 'a take with its guide and original audio',
      extra: { warpUrl: 'warp.mp4', originalUrl: 'original.mp4' },
      warp: true,
      sound: true
    }
  ])(
    'offers only what $name has: warp $warp, sound $sound',
    ({ extra, warp, sound }) => {
      render({
        setup: () => () =>
          h(ReshootOutputBar, {
            take: take(extra),
            href: 'take.mp4',
            fileName: 'crossview-take-1.mp4',
            view: 'result',
            sound: 'generated'
          })
      })

      expect(
        screen.queryByRole('radio', { name: rc('reshoot.view.warp') }) !== null
      ).toBe(warp)
      expect(
        screen.queryByRole('button', { name: rc('reshoot.sound.original') }) !==
          null
      ).toBe(sound)
      expect(
        screen.getByRole('link', { name: rc('reshoot.download') })
      ).toHaveAttribute('download', 'crossview-take-1.mp4')
    }
  )
})
