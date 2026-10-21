import userEvent from '@testing-library/user-event'
import { fireEvent, render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

import { translationsFor } from '@/i18n/translations'
import VfxProofHero from './VfxProofHero.vue'

const { t } = translationsFor('en')
const props = { locale: 'en', primaryHref: '/contact/' } as const

describe('VfxProofHero', () => {
  it('lets a keyboard user inspect the before and after comparison', async () => {
    const user = userEvent.setup()
    render(VfxProofHero, { props })

    const comparison = screen.getByRole('slider', {
      name: 'Utility Video Upscale image comparison'
    })
    comparison.focus()
    await user.keyboard('{ArrowRight}{ArrowRight}')
    expect(comparison).toHaveAttribute('aria-valuenow', '52')

    await user.keyboard('{Home}')
    expect(comparison).toHaveAttribute('aria-valuenow', '0')
    await user.keyboard('{End}')
    expect(comparison).toHaveAttribute('aria-valuenow', '100')
  })

  it('switches proof media through native buttons and removes the previous video', async () => {
    const user = userEvent.setup()
    render(VfxProofHero, { props })

    const cleanplate = screen.getByRole('button', {
      name: t('vfxV2.proof.cleanplate')
    })
    cleanplate.focus()
    await user.keyboard('{Enter}')

    expect(cleanplate).toHaveAttribute('aria-pressed', 'true')
    expect(
      screen.queryByRole('slider', { name: /image comparison/ })
    ).toBeNull()
    expect(screen.getByLabelText(t('vfxV2.proof.cleanplate'))).toHaveAttribute(
      'src',
      'https://media.comfy.org/hub-media/video/8a3a846f-5017-428e-b2a2-24025c55e884.mp4'
    )

    await user.click(
      screen.getByRole('button', { name: t('vfxV2.proof.restyling') })
    )
    expect(screen.queryByLabelText(t('vfxV2.proof.cleanplate'))).toBeNull()
    expect(screen.getByLabelText(t('vfxV2.proof.restyling'))).toHaveAttribute(
      'src',
      'https://media.comfy.org/hub-media/video/93d4af64-c1a4-4a44-8d5a-e1f4d0ea28e3.mp4'
    )
    expect(screen.queryByAltText('Minimax H3 Video Restyling')).toBeNull()
  })

  it('falls back to the workflow poster when the restyling clip cannot load', async () => {
    const user = userEvent.setup()
    render(VfxProofHero, { props })

    await user.click(
      screen.getByRole('button', { name: t('vfxV2.proof.restyling') })
    )
    await fireEvent.error(screen.getByLabelText(t('vfxV2.proof.restyling')))

    expect(screen.queryByLabelText(t('vfxV2.proof.restyling'))).toBeNull()
    expect(screen.getByAltText('Minimax H3 Video Restyling')).toBeTruthy()
  })

  it.for(['cleanplate', 'restyling'] as const)(
    'plays the %s clip without a sound control because it has no audio track',
    async (id) => {
      vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
      const user = userEvent.setup()
      render(VfxProofHero, { props })

      await user.click(
        screen.getByRole('button', { name: t(`vfxV2.proof.${id}`) })
      )
      await user.click(screen.getByRole('button', { name: 'Play' }))

      expect(screen.getByTestId('player-control-bar')).toBeTruthy()
      expect(screen.queryByRole('button', { name: 'Mute' })).toBeNull()
      expect(screen.queryByRole('button', { name: 'Unmute' })).toBeNull()
    }
  )
})
