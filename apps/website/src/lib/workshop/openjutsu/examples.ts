/** A ready-made swap: a clip and the character to put in it. */
export interface SwapExample {
  readonly id: 'singer' | 'boxer' | 'painter' | 'cowboy'
  readonly video: string
  readonly poster: string
  readonly character: string
}

const base = 'https://media.comfy.org/website/workshop/openjutsu/examples'

const example = (id: SwapExample['id'], character: string): SwapExample => ({
  id,
  video: `${base}/${id}.mp4`,
  poster: `${base}/${id}.jpg`,
  character: `${base}/${character}.jpg`
})

export const SWAP_EXAMPLES: readonly SwapExample[] = [
  example('singer', 'diva'),
  example('boxer', 'comfy-tee'),
  example('painter', 'ronin'),
  example('cowboy', 'chrome-robot')
]
