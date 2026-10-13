/** A ready-made swap: a clip, the character to put in it and who to replace. */
export interface SwapExample {
  readonly id: 'road' | 'office' | 'square' | 'kitchen'
  readonly video: string
  readonly poster: string
  readonly character: string
  readonly target: string
}

const base = '/images/apps/openjutsu/examples'

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
  example('road', 'robot', 'the man in the red jacket'),
  example('office', 'astronaut', 'the woman in the white shirt'),
  example('square', 'knight', 'the man in the blue coat'),
  example('kitchen', 'pirate-chef', 'the cook in the black apron')
]
