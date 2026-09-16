const PACK_SPEC_TEST_COUNTS = {
  'ComfyUI-Impact-Pack': 2,
  'ComfyUI-VideoHelperSuite': 3,
  'ComfyUI-Easy-Use': 2,
  'ComfyUI-PromptChain': 1,
  'rgthree-comfy': 13
} as const

export function packSpecTestCount(
  entries: readonly { pack: string }[]
): number {
  const counts = new Map(
    Object.entries(PACK_SPEC_TEST_COUNTS).map(([pack, count]) => [
      pack.toLowerCase(),
      count
    ])
  )
  return entries.reduce(
    (total, entry) => total + (counts.get(entry.pack.toLowerCase()) ?? 0),
    0
  )
}
