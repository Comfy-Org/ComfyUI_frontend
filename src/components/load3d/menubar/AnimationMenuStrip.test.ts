import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'vue-component-type-helpers'
import { createI18n } from 'vue-i18n'

import AnimationMenuStrip from '@/components/load3d/menubar/AnimationMenuStrip.vue'
import enMessages from '@/locales/en/main.json' with { type: 'json' }

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

const clips = [
  { name: 'idle', index: 0 },
  { name: 'walk', index: 1 }
]

type RenderProps = Partial<ComponentProps<typeof AnimationMenuStrip>>

function renderStrip(props: RenderProps = {}) {
  const result = render(AnimationMenuStrip, {
    props: { animations: clips, animationDuration: 10, ...props },
    global: { plugins: [i18n], directives: { tooltip: () => {} } }
  })
  return { ...result, user: userEvent.setup() }
}

describe('AnimationMenuStrip', () => {
  it('toggles playback from the play button', async () => {
    const onUpdatePlaying = vi.fn()
    const { user } = renderStrip({
      playing: false,
      'onUpdate:playing': onUpdatePlaying
    })

    await user.click(screen.getByRole('button', { name: 'Play' }))

    expect(onUpdatePlaying).toHaveBeenCalledWith(true)
  })

  it('shows a pause button while playing', () => {
    renderStrip({ playing: true })

    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
  })

  it('shows the current time against the total duration', () => {
    renderStrip({ animationProgress: 50, animationDuration: 150 })

    expect(screen.getByTestId('load3d-animation-time')).toHaveTextContent(
      '1:15.0 / 2:30.0'
    )
  })

  it('hides the time readout in compact mode', () => {
    renderStrip({ compact: true })

    expect(
      screen.queryByTestId('load3d-animation-time')
    ).not.toBeInTheDocument()
  })

  it('emits seek and updates progress when the slider moves', async () => {
    const onSeek = vi.fn()
    const onUpdateProgress = vi.fn()
    const { user } = renderStrip({
      animationProgress: 20,
      onSeek,
      'onUpdate:animationProgress': onUpdateProgress
    })

    const thumb = await screen.findByRole('slider')
    thumb.focus()
    await user.keyboard('{ArrowRight}')

    expect(onSeek).toHaveBeenCalledWith(20.1)
    expect(onUpdateProgress).toHaveBeenCalledWith(20.1)
  })

  it('selects a playback speed from the speed menu', async () => {
    const onUpdateSpeed = vi.fn()
    const { user } = renderStrip({
      selectedSpeed: 1,
      'onUpdate:selectedSpeed': onUpdateSpeed
    })

    await user.click(screen.getByRole('button', { name: 'Playback speed' }))
    await user.click(screen.getByRole('button', { name: '0.5x' }))

    expect(onUpdateSpeed).toHaveBeenCalledWith(0.5)
  })

  it('selects an animation clip from the clip menu', async () => {
    const onUpdateClip = vi.fn()
    const { user } = renderStrip({
      selectedAnimation: 0,
      'onUpdate:selectedAnimation': onUpdateClip
    })

    await user.click(screen.getByRole('button', { name: 'Animation clip' }))
    await user.click(screen.getByRole('button', { name: 'walk' }))

    expect(onUpdateClip).toHaveBeenCalledWith(1)
  })

  it('labels the clip menu with the selected clip name', () => {
    renderStrip({ animations: [clips[0]], selectedAnimation: 0 })

    expect(
      screen.getByRole('button', { name: 'Animation clip' })
    ).toHaveTextContent('idle')
  })
})
