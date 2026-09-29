import { splitTask } from '../../config/models-catalogue'
import { words } from './model-summary'
import { providerName } from './provider-name'

const BARE_VERSION = /^v?\d+(\.\d+)*$/i
const NUMBER = /^\d+$/

export function describesCapability(
  tag: string,
  model: { name: string; provider?: string }
): boolean {
  if (
    BARE_VERSION.test(tag) ||
    providerName(tag.toLowerCase()) === model.provider
  )
    return false
  if (splitTask(tag.toLowerCase())) return true
  const tagWords = words(tag)
  return tagWords.length === 0 || !echoesName(tagWords, words(model.name))
}

// A tag word may span name words ("wan2" is "Wan 2"), and only a version
// number may sit between them: seedream-5-pro echoes "Seedream 5.0 Pro".
function echoesName(
  tagWords: readonly string[],
  nameWords: readonly string[]
): boolean {
  return nameWords.some((_, start) => {
    let at = start
    return tagWords.every((tagWord, index) => {
      for (;;) {
        const end = spanEnd(tagWord, nameWords, at)
        if (end !== undefined) {
          at = end
          return true
        }
        if (index === 0 || !NUMBER.test(nameWords[at] ?? '')) return false
        at++
      }
    })
  })
}

function spanEnd(
  tagWord: string,
  nameWords: readonly string[],
  from: number
): number | undefined {
  let joined = ''
  for (let at = from; at < nameWords.length; at++) {
    joined += nameWords[at]
    if (joined === tagWord) return at + 1
    if (!tagWord.startsWith(joined)) return undefined
  }
  return undefined
}
