const STEPS: Partial<Record<string, readonly [number, number]>> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1]
}

/**
 * The move an arrow key asks for, as a fraction of the image: 1% a press,
 * 5% with Shift. Undefined for any other key.
 */
export function nudgeFor(
  event: Pick<KeyboardEvent, 'key' | 'shiftKey'>
): readonly [number, number] | undefined {
  const step = STEPS[event.key]
  if (!step) return undefined
  const size = event.shiftKey ? 0.05 : 0.01
  return [step[0] * size, step[1] * size]
}
