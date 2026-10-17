/** A ready-made swap: a clip, the character to put in it and who to replace. */
export interface SwapExample {
  readonly id: 'singer' | 'boxer' | 'painter' | 'cowboy'
  readonly video: string
  readonly poster: string
  readonly character: string
  readonly target: string
}

const base = 'https://media.comfy.org/website/workshop/openjutsu/examples'

const example = (
  id: SwapExample['id'],
  character: string,
  target: string
): SwapExample => ({
  id,
  video: `${base}/${id}.mp4`,
  poster: `${base}/${id}.jpg`,
  character: `${base}/${character}.jpg`,
  target
})

export const SWAP_EXAMPLES: readonly SwapExample[] = [
  example('singer', 'diva', 'the woman singing at the microphone'),
  example('boxer', 'comfy-tee', 'the boxer in the white tank top'),
  example('painter', 'ronin', 'the painter in the beret'),
  example('cowboy', 'chrome-robot', 'the cowboy in the hat')
]
