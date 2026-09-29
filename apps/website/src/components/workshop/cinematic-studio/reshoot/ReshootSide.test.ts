import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { h } from 'vue'

import {
  DEFAULT_CAMERA,
  RESHOOT_ASPECTS,
  RESHOOT_MOTIONS,
  RESHOOT_SIZES
} from '../../../../lib/workshop/cinematic-studio/reshoot'
import { rc } from '../../../../lib/workshop/cinematic-studio/reshoot-copy'
import ReshootSide from './ReshootSide.vue'

describe('ReshootSide', () => {
  it('keeps the prompt help behind its info button until asked for', async () => {
    render({
      setup: () => () =>
        h(ReshootSide, {
          clip: 'clip.mp4',
          clipName: 'clip.mp4',
          isExample: true,
          camera: DEFAULT_CAMERA,
          keys: [],
          depth: 'ready',
          aspect: RESHOOT_ASPECTS[0],
          size: RESHOOT_SIZES[0],
          seed: 0,
          keepAim: true,
          frame: 0,
          motion: RESHOOT_MOTIONS[0],
          prompt: ''
        })
    })
    const help = rc('reshoot.promptHelp')

    expect(screen.queryByText(help)).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: help }))
    const [shownHelp] = await screen.findAllByText(help)
    expect(shownHelp).toBeVisible()
  })
})
