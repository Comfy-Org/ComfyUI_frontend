// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { fireEvent, render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import OutputTransport from './OutputTransport.vue'

async function mountPlayer() {
  render(OutputTransport, { props: { src: 'https://assets.example/audio' } })
  await nextTick()
  const audio = screen.getByTestId('output-audio')
  if (!(audio instanceof HTMLAudioElement))
    throw new Error('Missing audio element')
  return audio
}

describe('OutputTransport', () => {
  it('shows actual media time, not an independently simulated clock', async () => {
    const audio = await mountPlayer()
    expect(audio.src).toBe('https://assets.example/audio')
    expect(screen.getByTestId('output-time').textContent).toBe('00:00')
    audio.currentTime = 65
    await fireEvent.timeUpdate(audio)
    expect(screen.getByTestId('output-time').textContent).toBe('01:05')
  })

  it('plays and pauses the actual media element', async () => {
    const audio = await mountPlayer()
    const play = vi.spyOn(audio, 'play').mockResolvedValue()
    const pause = vi.spyOn(audio, 'pause').mockImplementation(() => {})
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Play' }))
    expect(play).toHaveBeenCalledOnce()
    await fireEvent.play(audio)
    await user.click(screen.getByRole('button', { name: 'Pause' }))
    expect(pause).toHaveBeenCalledOnce()
  })

  it('seeks only after metadata loads and changes the media position', async () => {
    const audio = await mountPlayer()
    const seek = screen.getByRole('slider', { name: 'Seek' })
    expect(seek.hasAttribute('disabled')).toBe(true)
    vi.spyOn(audio, 'duration', 'get').mockReturnValue(90)
    await fireEvent.durationChange(audio)
    expect(seek.hasAttribute('disabled')).toBe(false)
    await fireEvent.update(seek, '25')
    expect(audio.currentTime).toBe(25)
  })

  it('changes the actual mute property', async () => {
    const audio = await mountPlayer()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Turn sound off' }))
    expect(audio.muted).toBe(true)
    await user.click(screen.getByRole('button', { name: 'Turn sound on' }))
    expect(audio.muted).toBe(false)
  })
})
