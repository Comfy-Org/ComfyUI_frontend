import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { translationsFor } from '@/i18n/translations'
import RouterVideoSection from './RouterVideoSection.vue'

const { t } = translationsFor('en')

describe('RouterVideoSection', () => {
  it('presents the explainer video with an accessible label', () => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)

    render(RouterVideoSection, { props: { locale: 'en' } })

    const video = screen.getByLabelText(t('platform.router.video.alt'))

    expect(video).toBeTruthy()
    expect(video.hasAttribute('muted')).toBe(true)
    // The section now sits right below the hero, so it loads eagerly
    // (native `autoplay`) instead of waiting on `lazy-autoplay` + scroll.
    expect(video.hasAttribute('autoplay')).toBe(true)
  })

  it('keeps controls visible so visitors can unmute the video', async () => {
    const user = userEvent.setup()
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)

    render(RouterVideoSection, { props: { locale: 'en' } })

    await user.click(await screen.findByRole('button', { name: 'Unmute' }))

    expect(screen.getByRole('button', { name: 'Mute' })).toBeTruthy()
    expect(screen.queryByRole('slider')).toBeNull()
  })
})
