import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import CinematicPresetSection from './CinematicPresetSection.vue'
import { defaultCreativeSettings } from '../../../lib/workshop/cinematic-studio/creative'

describe('scoped creative preset storage', () => {
  it('persists a palette across remount, loads into draft only and isolates workspaces', async () => {
    const user = userEvent.setup()
    const namespace = 'palette-storage-test'
    localStorage.removeItem(`cinematic-palette-presets-v1:${namespace}`)
    const settings = {
      ...defaultCreativeSettings(),
      palette: ['#ff0000'],
      paletteMain: 0
    }
    const firstProps = {
      kind: 'palette' as const,
      namespace,
      modelValue: settings
    }
    const first = render(CinematicPresetSection, { props: firstProps })
    await user.type(
      screen.getByRole('textbox', { name: 'Palette preset name' }),
      'Warm'
    )
    await user.click(screen.getByRole('button', { name: 'Save palette' }))
    expect(first.emitted('update:modelValue')).toBeUndefined()
    first.unmount()
    const current = { ...defaultCreativeSettings(), genre: 'noir' as const }
    const currentProps = {
      kind: 'palette' as const,
      namespace,
      modelValue: current
    }
    const view = render(CinematicPresetSection, { props: currentProps })
    await user.click(screen.getByRole('button', { name: 'Load palette: Warm' }))
    expect(view.emitted('update:modelValue')).toEqual([
      [{ ...current, palette: ['#ff0000'], paletteMain: 0 }]
    ])
    await view.rerender({ namespace: 'another-palette-workspace' })
    expect(
      screen.queryByRole('button', { name: 'Load palette: Warm' })
    ).not.toBeInTheDocument()
  })

  it('reports storage failure without claiming a preset was saved', async () => {
    const user = userEvent.setup()
    const failureProps = {
      kind: 'lighting' as const,
      namespace: 'lighting-failure',
      modelValue: {
        ...defaultCreativeSettings(),
        lights: [
          {
            position: 'front' as const,
            color: '#ffffff',
            brightness: 60,
            diffusion: 60
          }
        ]
      }
    }
    render(CinematicPresetSection, { props: failureProps })
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('Full')
    })
    await user.type(
      screen.getByRole('textbox', { name: 'Lighting preset name' }),
      'Key'
    )
    await user.click(screen.getByRole('button', { name: 'Save lighting' }))
    expect(screen.getByRole('status')).toHaveTextContent(
      'This browser could not save the preset.'
    )
    expect(
      screen.queryByRole('button', { name: 'Load lighting: Key' })
    ).not.toBeInTheDocument()
  })
})
