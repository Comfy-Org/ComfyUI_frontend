import type { HandSwapResult } from './contract'

const EXTENSION = /\.(jpe?g|png|webp)$/i

/**
 * The result's download name: the hand photo's name, marked swapped with the
 * seed that made it, and the result's own image type (a drawn one is JPEG).
 */
export function swapFileName(handName: string, result: HandSwapResult) {
  const stem = handName.replace(/\.[^.]+$/, '') || 'hand'
  const extension = EXTENSION.exec(result.url)?.[1].toLowerCase() ?? 'jpg'
  return `${stem}-swapped-${result.seed}.${extension}`
}
