import { fireEvent, render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import type { FileValue } from '../../config/workshop-playground'
import SelectedFileRow from './SelectedFileRow.vue'

const recording: FileValue = {
  name: 'voice.wav',
  size: 2048,
  type: 'audio/wav',
  previewUrl: 'https://media.example/voice.wav'
}

describe('selected file rows', () => {
  // A live recording, and some containers, report no length. The line then has
  // nothing to move within, so the position it announces has to stay inside the
  // range it advertises however far the element has actually played.
  it('announces no position within a recording that has no length', async () => {
    render(SelectedFileRow, { props: { file: recording } })
    const line = screen.getByRole('slider', { name: 'Seek voice.wav' })
    expect(line.getAttribute('aria-disabled')).toBe('true')
    expect(line.getAttribute('aria-valuemax')).toBe('0')

    const player = screen.getByTestId('audio-source-player')
    if (!(player instanceof HTMLAudioElement))
      throw new Error('The row rendered no audio element to play')
    player.currentTime = 5
    await fireEvent.timeUpdate(player)

    expect(line.getAttribute('aria-valuenow')).toBe('0')
    expect(line.getAttribute('aria-valuetext')).toBe('0:05 / 0:00')
  })
})
