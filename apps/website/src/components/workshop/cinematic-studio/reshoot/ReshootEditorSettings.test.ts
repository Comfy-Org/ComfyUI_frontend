import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { translationsFor } from '@/i18n/translations'
import {
  DEFAULT_CAMERA,
  RESHOOT_ASPECTS,
  RESHOOT_SIZES
} from '@/lib/workshop/cinematic-studio/reshoot'
import { fileSecondsOf } from '@/lib/workshop/cinematic-studio/reshoot-clip'
import ReshootEditorSettings from './ReshootEditorSettings.vue'

vi.mock(import('@/lib/workshop/cinematic-studio/reshoot-clip'), () => ({
  fileSecondsOf: vi.fn()
}))

const { t } = translationsFor('en')

const props = {
  clip: 'blob:clip',
  clipName: 'street.mp4',
  isExample: false,
  camera: DEFAULT_CAMERA,
  keys: [],
  depth: 'ready' as const,
  frames: 120,
  aspect: RESHOOT_ASPECTS[0],
  size: RESHOOT_SIZES[0],
  keepAim: true,
  frame: 0,
  prompt: ''
}

const clipFile = new File(['clip'], 'pier.mp4', { type: 'video/mp4' })

describe('ReshootEditorSettings', () => {
  it('shows the clip on top with its length and no way to empty it', () => {
    render(ReshootEditorSettings, { props })

    expect(
      screen.getByRole('button', { name: 'Change: street.mp4' })
    ).toBeVisible()
    expect(screen.getByTestId('reshoot-clip-length')).toHaveTextContent('5.0 s')
    expect(screen.queryByRole('button', { name: /^Remove/ })).toBeNull()
  })

  it.for([
    { seconds: 8, takes: true },
    { seconds: 20, takes: false }
  ])(
    'replaces the clip only when it fits: $seconds s',
    async ({ seconds, takes }) => {
      vi.mocked(fileSecondsOf).mockResolvedValue(seconds)
      const { emitted } = render(ReshootEditorSettings, { props })

      await userEvent.upload(screen.getByTestId('reshoot-clip-file'), clipFile)

      expect(emitted('update:upload')).toEqual(takes ? [[clipFile]] : undefined)
      expect(screen.queryAllByRole('alert')).toHaveLength(takes ? 0 : 1)
    }
  )

  it('says why the current clip cannot be used', () => {
    render(ReshootEditorSettings, {
      props: { ...props, clipError: 'This clip is 20.0 s long.' }
    })

    expect(screen.getByRole('alert')).toHaveTextContent(
      'This clip is 20.0 s long.'
    )
  })

  it('takes the prompt and a fixed seed from their fields', async () => {
    const { emitted } = render(ReshootEditorSettings, { props })

    await userEvent.type(
      screen.getByLabelText(t('reshoot.section.prompt')),
      'a stone wall'
    )
    await userEvent.type(
      screen.getByLabelText(t('reshoot.seed.label')),
      '42{Tab}'
    )

    expect(emitted('update:prompt').at(-1)).toEqual(['a stone wall'])
    expect(emitted('update:seed')).toEqual([[42]])
  })

  it('picks the size from the format bar', async () => {
    const { emitted } = render(ReshootEditorSettings, { props })

    await userEvent.click(
      screen.getByRole('button', { name: `${t('reshoot.size.label')}: 480p` })
    )
    await userEvent.click(
      await screen.findByRole('menuitemradio', { name: /768p/ })
    )

    expect(emitted('update:size')).toEqual([['768p']])
  })

  it('leaves the guidance to placeholders and tooltips', () => {
    render(ReshootEditorSettings, { props })

    for (const key of [
      'reshoot.aim.globe',
      'reshoot.prompt.dialogue',
      'reshoot.advanced.label'
    ] as const)
      expect(screen.queryByText(t(key))).toBeNull()
    expect(screen.getByLabelText(t('reshoot.section.prompt'))).toHaveAttribute(
      'placeholder',
      t('reshoot.prompt.box')
    )
  })
})
