import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { rc } from '../../../../lib/workshop/cinematic-studio/reshoot-copy'
import ReshootUpload from './ReshootUpload.vue'

describe('ReshootUpload', () => {
  it('lets the same clip be chosen again after it is read', async () => {
    render(ReshootUpload)
    const user = userEvent.setup()
    const input = screen.getByLabelText(new RegExp(rc('reshoot.pick.drop')))
    const clip = new File(['clip'], 'clip.mp4', { type: 'video/mp4' })
    if (!(input instanceof HTMLInputElement)) throw new Error('No file input')

    await user.upload(input, clip)

    expect(input.files).toHaveLength(0)
  })
})
