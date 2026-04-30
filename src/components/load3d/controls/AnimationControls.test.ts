import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'

import AnimationControls from '@/components/load3d/controls/AnimationControls.vue'

vi.mock('primevue/select', () => ({
  default: {
    name: 'Select',
    props: ['modelValue', 'options', 'optionLabel', 'optionValue'],
    emits: ['update:modelValue'],
    template: `
      <select
        :value="modelValue"
        @change="$emit('update:modelValue', isNaN(Number($event.target.value)) ? $event.target.value : Number($event.target.value))"
      >
        <option v-for="opt in options" :key="opt[optionValue]" :value="opt[optionValue]">
          {{ opt[optionLabel] }}
        </option>
      </select>
    `
  }
}))

vi.mock('@/components/ui/slider/Slider.vue', () => ({
  default: {
    name: 'UiSlider',
    props: ['modelValue', 'min', 'max', 'step'],
    emits: ['update:modelValue'],
    template: `
      <input
        type="range"
        role="slider"
        :value="Array.isArray(modelValue) ? modelValue[0] : modelValue"
        :min="min"
        :max="max"
        :step="step"
        @input="$emit('update:modelValue', [Number($event.target.value)])"
      />
    `
  }
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: { g: { playPause: 'Play / pause' } } }
})

type Animation = { name: string; index: number }

type RenderOpts = {
  animations?: Animation[]
  playing?: boolean
  selectedSpeed?: number
  selectedAnimation?: number
  animationProgress?: number
  animationDuration?: number
  onSeek?: (progress: number) => void
}

function renderComponent(opts: RenderOpts = {}) {
  const animations = ref<Animation[]>(opts.animations ?? [])
  const playing = ref<boolean>(opts.playing ?? false)
  const selectedSpeed = ref<number>(opts.selectedSpeed ?? 1)
  const selectedAnimation = ref<number>(opts.selectedAnimation ?? 0)
  const animationProgress = ref<number>(opts.animationProgress ?? 0)
  const animationDuration = ref<number>(opts.animationDuration ?? 10)

  const utils = render(AnimationControls, {
    props: {
      animations: animations.value,
      'onUpdate:animations': (v: Animation[] | undefined) => {
        if (v) animations.value = v
      },
      playing: playing.value,
      'onUpdate:playing': (v: boolean | undefined) => {
        if (v !== undefined) playing.value = v
      },
      selectedSpeed: selectedSpeed.value,
      'onUpdate:selectedSpeed': (v: number | undefined) => {
        if (v !== undefined) selectedSpeed.value = v
      },
      selectedAnimation: selectedAnimation.value,
      'onUpdate:selectedAnimation': (v: number | undefined) => {
        if (v !== undefined) selectedAnimation.value = v
      },
      animationProgress: animationProgress.value,
      'onUpdate:animationProgress': (v: number | undefined) => {
        if (v !== undefined) animationProgress.value = v
      },
      animationDuration: animationDuration.value,
      'onUpdate:animationDuration': (v: number | undefined) => {
        if (v !== undefined) animationDuration.value = v
      },
      onSeek: opts.onSeek
    },
    global: { plugins: [i18n] }
  })

  return {
    ...utils,
    animations,
    playing,
    selectedSpeed,
    selectedAnimation,
    animationProgress,
    user: userEvent.setup()
  }
}

describe('AnimationControls', () => {
  it('renders nothing when the animation list is empty', () => {
    renderComponent({ animations: [] })

    expect(
      screen.queryByRole('button', { name: 'Play / pause' })
    ).not.toBeInTheDocument()
  })

  it('renders the play / speed / track / progress widgets when animations are present', () => {
    renderComponent({
      animations: [
        { name: 'idle', index: 0 },
        { name: 'walk', index: 1 }
      ]
    })

    expect(
      screen.getByRole('button', { name: 'Play / pause' })
    ).toBeInTheDocument()
    expect(screen.getAllByRole('combobox')).toHaveLength(2)
    expect(screen.getByRole('slider')).toBeInTheDocument()
  })

  it('flips playing to true via v-model when starting from a paused state', async () => {
    const { user, playing } = renderComponent({
      animations: [{ name: 'idle', index: 0 }],
      playing: false
    })

    await user.click(screen.getByRole('button', { name: 'Play / pause' }))

    expect(playing.value).toBe(true)
  })

  it('flips playing to false via v-model when starting from a playing state', async () => {
    const { user, playing } = renderComponent({
      animations: [{ name: 'idle', index: 0 }],
      playing: true
    })

    await user.click(screen.getByRole('button', { name: 'Play / pause' }))

    expect(playing.value).toBe(false)
  })

  it('updates animationProgress and emits seek with the new progress when the slider moves', () => {
    const onSeek = vi.fn()
    const { animationProgress } = renderComponent({
      animations: [{ name: 'idle', index: 0 }],
      animationProgress: 0,
      onSeek
    })

    const slider = screen.getByRole('slider') as HTMLInputElement
    slider.value = '37.5'
    slider.dispatchEvent(new Event('input', { bubbles: true }))

    expect(animationProgress.value).toBe(37.5)
    expect(onSeek).toHaveBeenCalledWith(37.5)
  })

  it('formats the time display under one minute as Ns', () => {
    renderComponent({
      animations: [{ name: 'idle', index: 0 }],
      animationDuration: 30,
      animationProgress: 50 // half of 30s = 15s
    })

    expect(screen.getByText('15.0s / 30.0s')).toBeInTheDocument()
  })

  it('formats the time display over one minute as M:SS.S', () => {
    renderComponent({
      animations: [{ name: 'idle', index: 0 }],
      animationDuration: 90,
      animationProgress: 50 // half of 90s = 45s, total 1:30.0
    })

    expect(screen.getByText('45.0s / 1:30.0')).toBeInTheDocument()
  })

  it('shows 0s for currentTime when animationDuration is 0', () => {
    renderComponent({
      animations: [{ name: 'idle', index: 0 }],
      animationDuration: 0,
      animationProgress: 50
    })

    expect(screen.getByText('0.0s / 0.0s')).toBeInTheDocument()
  })
})
