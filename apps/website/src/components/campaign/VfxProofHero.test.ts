import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

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
    expect(screen.getByAltText('Minimax H3 Video Restyling')).toBeTruthy()
  })
})
