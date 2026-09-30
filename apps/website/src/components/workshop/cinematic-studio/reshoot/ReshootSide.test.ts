import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
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
    gate: 'ready' as const,
    canGenerate: true,
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

  function renderPending(extra: Record<string, unknown>) {
    const analyze = vi.fn()
    render({
      setup: () => () =>
        h(ReshootSide, {
          ...props,
          ...extra,
          size: RESHOOT_SIZES[0],
          onAnalyze: analyze
        })
    })
    return analyze
  }

  it('says what failed in a depth read and offers to try again', async () => {
    const analyze = renderPending({
      depth: 'failed',
      error: 'The deployment is not ready.'
    })
    const step = screen.getByTestId('reshoot-depth-step')

    expect(step).toHaveTextContent(rc('reshoot.pending.depthFailed'))
    expect(step).toHaveTextContent('The deployment is not ready.')
    expect(screen.getByTestId('reshoot-aim-controls')).toHaveAttribute('inert')
    await userEvent.click(screen.getByTestId('reshoot-analyze'))
    expect(analyze).toHaveBeenCalledOnce()
  })

  it('says why a depth read has not started, without a retry', () => {
    renderPending({ depth: 'none', blocked: rc('reshoot.signIn') })
    const step = screen.getByTestId('reshoot-depth-step')

    expect(step).toHaveTextContent(rc('reshoot.pending.depthWaiting'))
    expect(step).toHaveTextContent(rc('reshoot.signIn'))
    expect(screen.getByTestId('reshoot-aim-controls')).toHaveAttribute('inert')
    expect(screen.queryByTestId('reshoot-analyze')).toBeNull()
  })
})
