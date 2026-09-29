import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { h, ref } from 'vue'

import {
  DEFAULT_CAMERA,
  RESHOOT_ASPECTS,
  RESHOOT_MOTIONS,
  RESHOOT_SIZES
} from '../../../../lib/workshop/cinematic-studio/reshoot'
import { rc } from '../../../../lib/workshop/cinematic-studio/reshoot-copy'
import ReshootSide from './ReshootSide.vue'

describe('ReshootSide', () => {
  const props = {
    clip: 'clip.mp4',
    clipName: 'clip.mp4',
    isExample: true,
    camera: DEFAULT_CAMERA,
    keys: [],
    depth: 'ready' as const,
    aspect: RESHOOT_ASPECTS[0],
    seed: 0,
    keepAim: true,
    frame: 0,
    motion: RESHOOT_MOTIONS[0],
    prompt: ''
  }

  it('picks the output size from a menu that describes each size', async () => {
    const size = ref<(typeof RESHOOT_SIZES)[number]>(RESHOOT_SIZES[0])
    render({
      setup: () => () =>
        h(ReshootSide, {
          ...props,
          size: size.value,
          'onUpdate:size': (next: (typeof RESHOOT_SIZES)[number]) => {
            size.value = next
          }
        })
    })

    await userEvent.click(
      screen.getByRole('button', { name: `${rc('reshoot.size')}: 480p` })
    )
    await userEvent.click(
      await screen.findByRole('menuitemradio', {
        name: (name) => name.includes(rc('reshoot.size.768p'))
      })
    )

    expect(size.value).toBe('768p')
    expect(screen.queryByText(rc('reshoot.section.video'))).toBeNull()
    expect(
      screen.getByRole('button', { name: `${rc('reshoot.size')}: 768p` })
    ).toBeInTheDocument()
  })

  it('keeps the prompt help behind its info button until asked for', async () => {
    render({
      setup: () => () => h(ReshootSide, { ...props, size: RESHOOT_SIZES[0] })
    })
    const help = rc('reshoot.promptHelp')

    expect(screen.queryByText(help)).toBeNull()
    await userEvent.click(screen.getByText(rc('reshoot.advanced')))
    await userEvent.click(screen.getByRole('button', { name: help }))
    const [shownHelp] = await screen.findAllByText(help)
    expect(shownHelp).toBeVisible()
  })

  it('picks the aspect from a menu and names the choice on the trigger', async () => {
    const aspect = ref<(typeof RESHOOT_ASPECTS)[number]>(RESHOOT_ASPECTS[0])
    const chosen = RESHOOT_ASPECTS[1]
    render({
      setup: () => () =>
        h(ReshootSide, {
          ...props,
          size: RESHOOT_SIZES[0],
          aspect: aspect.value,
          'onUpdate:aspect': (next: (typeof RESHOOT_ASPECTS)[number]) => {
            aspect.value = next
          }
        })
    })

    await userEvent.click(
      screen.getByRole('button', {
        name: `${rc('reshoot.aspect')}: ${rc('reshoot.aspect.source')}`
      })
    )
    await userEvent.click(
      await screen.findByRole('menuitemradio', {
        name: (name) => name.includes(chosen)
      })
    )

    expect(aspect.value).toBe(chosen)
    expect(
      screen.getByRole('button', { name: `${rc('reshoot.aspect')}: ${chosen}` })
    ).toBeInTheDocument()
  })
})
