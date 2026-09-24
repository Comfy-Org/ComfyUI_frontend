import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import HubVideoCompare from './HubVideoCompare.vue'

const props = {
  before: 'https://media.example/clip.mp4',
  after: 'https://media.example/result.mp4',
  beforeLabel: 'Source',
  afterLabel: 'Result',
  label: 'Drag to compare'
}

const seam = () => screen.getByTestId('hub-video-compare-seam')
const clipped = () =>
  screen.getByTestId('hub-video-compare-after').getAttribute('style') ?? ''

describe('HubVideoCompare', () => {
  it('lays the result over the clip and names both corners', () => {
    render(HubVideoCompare, { props })

    expect(
      screen.getByTestId('hub-video-compare-before').getAttribute('src')
    ).toBe(props.before)
    expect(
      screen.getByTestId('hub-video-compare-after').getAttribute('src')
    ).toBe(props.after)
    expect(screen.getByText('Source')).toBeTruthy()
    expect(screen.getByText('Result')).toBeTruthy()
    expect(clipped()).toContain('inset(0 50% 0 0)')
    expect(seam().getAttribute('aria-valuenow')).toBe('50')
  })

  it.for([
    { case: 'left moves the seam back', key: '{ArrowLeft}', at: '46' },
    { case: 'right moves it forward', key: '{ArrowRight}', at: '54' },
    { case: 'home puts it at the clip', key: '{Home}', at: '0' },
    { case: 'end puts it at the result', key: '{End}', at: '100' }
  ])('by keyboard, $case', async ({ key, at }) => {
    render(HubVideoCompare, { props })
    const user = userEvent.setup()

    await user.tab()
    await user.keyboard(key)

    expect(seam().getAttribute('aria-valuenow')).toBe(at)
    expect(clipped()).toContain(`inset(0 ${100 - Number(at)}% 0 0)`)
  })

  it('does not let the seam leave the frame', async () => {
    render(HubVideoCompare, { props })
    const user = userEvent.setup()

    await user.tab()
    await user.keyboard('{Home}{ArrowLeft}')
    expect(seam().getAttribute('aria-valuenow')).toBe('0')

    await user.keyboard('{End}{ArrowRight}')
    expect(seam().getAttribute('aria-valuenow')).toBe('100')
  })
})
