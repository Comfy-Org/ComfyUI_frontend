import type { Locator } from '@playwright/test'

export class AudioPreview {
  public readonly download: Locator
  public readonly play: Locator
  public readonly upload: Locator
  public readonly volume: Locator
  public readonly audio: Locator

  constructor(node: Locator) {
    this.download = node.getByLabel('Download audio')
    this.play = node.getByLabel('Play/Pause')
    this.upload = node.locator('input')
    this.volume = node.getByLabel('Volume')
    this.audio = node.locator('audio')
  }
  async isPlaying() {
    return await this.audio.evaluate((audio: HTMLAudioElement) => !audio.paused)
  }
  async isMuted() {
    return await this.audio.evaluate((audio: HTMLAudioElement) => audio.muted)
  }
}

/*
 * Generates a buffer of a 20 second wav file for testing with
 */
export function getWav() {
  const header = 'UklGRixxAgBXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQBxAgA='
  const notes = [8 / 9, 1, 9 / 8, 6 / 5, 4 / 3, 3 / 2, 0]
  const buffer = Buffer.alloc(160_044, header, 'base64')
  for (let t = 0; t < 160000; t++) {
    const measure = [0xd2d2c8, 0xce4088, 0xca32c8, 0x8e4009][(t >> 14) & 3]
    const beat = ((t >> 10) & 15) > 9 ? 18 : (t >> 10) & 15
    const noteIndex = (measure >> (((0x3dbe4688 >> (beat * 3)) & 7) * 3)) & 7
    buffer.writeInt8(((t << 3) * notes[noteIndex]) & 127, t + 44)
  }
  return buffer
}
