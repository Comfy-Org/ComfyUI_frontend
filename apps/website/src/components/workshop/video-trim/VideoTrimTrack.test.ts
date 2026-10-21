import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { clock } from '@/lib/workshop/video-trim/track'
import VideoTrimTrack from './VideoTrimTrack.vue'

const labels = {
  start: 'Start of the part to keep',
  end: 'End of the part to keep',
  seek: 'Seek within the selected part',
  time: clock
}

const props = {
  duration: 60,
  limits: { min: 5, max: 15 },
  tiles: [undefined, undefined],
  labels,
  range: { start: 10, end: 20 },
  playhead: 12
}

const shortest = { ...props, range: { start: 10, end: 15 } }
const nearEnd = { ...props, playhead: 19.95 }

const start = () => screen.getByRole('button', { name: labels.start })
const end = () => screen.getByRole('button', { name: labels.end })
const seek = () => screen.getByRole('slider', { name: labels.seek })

async function press(target: HTMLElement, keys: string) {
  target.focus()
  await userEvent.keyboard(keys)
}

describe('VideoTrimTrack', () => {
  it('moves a handle with the arrow keys and shows that moment', async () => {
    const { emitted } = render(VideoTrimTrack, { props })

    await press(start(), '{Shift>}{ArrowRight}{/Shift}')
    await press(end(), '{Shift>}{ArrowLeft}{/Shift}')

    expect(emitted('update:range')).toEqual([
      [{ start: 11, end: 20 }],
      [{ start: 11, end: 19 }]
    ])
    expect(emitted('seek')).toEqual([[11], [19]])
  })

  it('will not let the keys shrink the part below the shortest allowed', async () => {
    const { emitted } = render(VideoTrimTrack, { props: shortest })

    await press(start(), '{Shift>}{ArrowRight}{/Shift}')

    expect(emitted('update:range')).toEqual([[{ start: 10, end: 15 }]])
  })

  it('scrubs the playhead with the keys, inside the part only', async () => {
    const { emitted } = render(VideoTrimTrack, { props: nearEnd })

    await press(seek(), '{ArrowRight}')

    expect(emitted('update:playhead')).toEqual([[20]])
    expect(emitted('update:range')).toBeUndefined()
  })

  it('reads the playhead out as a time', () => {
    render(VideoTrimTrack, { props })

    expect(seek()).toHaveAttribute('aria-valuetext', '0:12.0')
    expect(start()).toHaveAttribute('title', '0:10.0')
  })

  it('ignores keys that are not arrows, and everything while disabled', async () => {
    const { emitted, rerender } = render(VideoTrimTrack, { props })

    await press(start(), '{Enter}')
    await rerender({ disabled: true })
    await press(seek(), '{ArrowRight}')

    expect(emitted('update:range')).toBeUndefined()
    expect(emitted('update:playhead')).toBeUndefined()
    expect(start()).toBeDisabled()
  })
})
