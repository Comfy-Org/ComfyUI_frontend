import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import CinematicCreativeEditor from '../../../components/workshop/cinematic-studio/CinematicCreativeEditor.vue'
import {
  beginCreativeDraft,
  creativeHarmony,
  creativePrompt,
  defaultCreativeSettings,
  moveCreativeColor,
  parseCreativePresets,
  removeCreativeColor,
  validateCreativeSettings
} from './creative'

describe('creative directions', () => {
  it('saves a preset without applying, discards cancelled edits and applies a new draft explicitly', async () => {
    const user = userEvent.setup()
    const applied = defaultCreativeSettings()
    const view = render(CinematicCreativeEditor, {
      props: { open: true, modelValue: applied, namespace: 'test-draft' }
    })
    await user.selectOptions(await screen.findByLabelText('Genre'), 'drama')
    await user.type(screen.getByLabelText('Preset name'), 'Draft example')
    await user.click(
      screen.getByRole('button', { name: 'Save draft as preset' })
    )
    expect(view.emitted()['update:modelValue']).toBeUndefined()
    expect(applied.genre).toBe('auto')
    const cancel = screen.getAllByRole('button', { name: 'Cancel' }).at(-1)
    if (!cancel) throw new Error('Missing Cancel')
    await user.click(cancel)
    expect(view.emitted()['update:modelValue']).toBeUndefined()
    await view.rerender({ open: false })
    await view.rerender({ open: true })
    expect(await screen.findByLabelText('Genre')).toHaveValue('auto')
    await user.selectOptions(screen.getByLabelText('Genre'), 'noir')
    await user.click(screen.getByRole('button', { name: 'Apply' }))
    expect(view.emitted()['update:modelValue']).toEqual([
      [{ ...applied, genre: 'noir' }]
    ])
  })
  it('reloads presets when the account/workspace namespace changes', async () => {
    const user = userEvent.setup()
    const view = render(CinematicCreativeEditor, {
      props: {
        open: true,
        modelValue: defaultCreativeSettings(),
        namespace: 'user-a/workspace-a'
      }
    })
    await user.type(
      await screen.findByLabelText('Preset name'),
      'Workspace A look'
    )
    await user.click(
      screen.getByRole('button', { name: 'Save draft as preset' })
    )
    expect(
      localStorage.getItem('cinematic-creative-presets-v1:user-a%2Fworkspace-a')
    ).toContain('Workspace A look')
    await view.rerender({ namespace: 'user-b/workspace-b' })
    expect(screen.queryByText('Workspace A look')).toBeNull()
    expect(screen.getByLabelText('Preset name')).toHaveValue('')
    await view.rerender({ namespace: 'user-a/workspace-a' })
    expect(screen.getByText('Workspace A look')).toBeTruthy()
    expect(view.emitted()['update:modelValue']).toBeUndefined()
  })
  it('keeps applied settings intact while changing or cancelling a draft', () => {
    const applied = {
      ...defaultCreativeSettings(),
      palette: ['#112233'],
      lights: [
        {
          position: 'front' as const,
          color: '#ffffff',
          brightness: 60,
          diffusion: 20
        }
      ]
    }
    const draft = beginCreativeDraft(applied)
    draft.palette[0] = '#abcdef'
    draft.lights[0].brightness = 90
    expect(applied.palette).toEqual(['#112233'])
    expect(applied.lights[0].brightness).toBe(60)
    const committed = validateCreativeSettings(draft)
    draft.lights[0].brightness = 30
    expect(committed.lights[0].brightness).toBe(90)
    expect(beginCreativeDraft(applied).palette).toEqual(['#112233'])
  })
  it('tracks main color identity through duplicate colors, reorder and deletion', () => {
    const settings = {
      ...defaultCreativeSettings(),
      palette: ['#aaaaaa', '#aaaaaa', '#bbbbbb'],
      paletteMain: 1
    }
    const moved = moveCreativeColor(settings, 1, 2)
    expect(moved.paletteMain).toBe(2)
    expect(removeCreativeColor(moved, 0).paletteMain).toBe(1)
    expect(removeCreativeColor(moved, 2).paletteMain).toBeNull()
    expect(settings.paletteMain).toBe(1)
  })
  it.for([
    { movements: ['static', 'static'] },
    { movements: ['static', 'dolly-in', 'dolly-out', 'pan-left', 'pan-right'] },
    { palette: Array(9).fill('#112233') },
    { palette: ['red'] },
    { palette: ['#112233'], paletteMain: 1 },
    {
      lights: [
        {
          position: 'front',
          color: '#ffffff',
          brightness: Number.NaN,
          diffusion: 50
        }
      ]
    },
    {
      lights: [
        { position: 'invalid', color: '#ffffff', brightness: 50, diffusion: 50 }
      ]
    },
    {
      lights: Array(4).fill({
        position: 'front',
        color: '#ffffff',
        brightness: 50,
        diffusion: 50
      })
    }
  ])('rejects invalid or unsupported controls: %j', (patch) => {
    expect(() =>
      validateCreativeSettings({ ...defaultCreativeSettings(), ...patch })
    ).toThrow()
  })
  it('preserves ordered motion only for video and includes palette priority and light values', () => {
    const settings = validateCreativeSettings({
      ...defaultCreativeSettings(),
      genre: 'drama',
      tempo: 'single',
      movements: ['dolly-out', 'pan-left'],
      palette: ['#112233'],
      paletteMain: 0,
      lights: [
        { position: 'left', color: '#abcdef', brightness: 35, diffusion: 80 }
      ]
    })
    const video = creativePrompt(settings, 'video')
    expect(video).toContain(
      'Camera moves backward revealing the environment. Then Camera pans left'
    )
    expect(video).toContain('One continuous shot, no cuts.')
    expect(video).toContain('#112233 is the main color')
    expect(video).toContain(
      'left light, #abcdef, 35% relative brightness, 80% diffusion'
    )
    expect(creativePrompt(settings)).not.toContain('Camera movement')
    expect(creativePrompt(defaultCreativeSettings())).toBe('')
  })
  it('retains exact gray base color in harmonies and rejects invalid colors', () => {
    expect(creativeHarmony('#808080', 'triad')).toEqual([
      '#808080',
      '#808080',
      '#808080'
    ])
    expect(creativeHarmony('#FF0000', 'complementary')).toEqual([
      '#ff0000',
      '#00ffff'
    ])
    expect(() => creativeHarmony('bad', 'triad')).toThrow()
  })
  it('recovers only valid bounded presets from browser storage', () => {
    expect(parseCreativePresets('invalid')).toEqual([])
    expect(
      parseCreativePresets(
        JSON.stringify([
          { name: 'Bad', settings: {} },
          { name: 'Good', settings: defaultCreativeSettings() }
        ])
      ).map((preset) => preset.name)
    ).toEqual(['Good'])
    expect(
      parseCreativePresets(
        JSON.stringify(
          Array.from({ length: 20 }, (_, i) => ({
            name: String(i),
            settings: defaultCreativeSettings()
          }))
        )
      )
    ).toHaveLength(16)
  })
})
