/**
 * Reading the pipeline's own artifacts safely.
 *
 * `content/`, `resolved/`, `pending/` and `manifest.json` are generated, but
 * they are also committed, so they arrive from git rather than from the process
 * that wrote them. They can be truncated by a bad merge, hand-edited, or
 * replaced with something of the wrong shape entirely.
 *
 * Three outcomes have to stay distinct, and collapsing any two of them is how a
 * locale silently reverts to English with the build green:
 *
 *  - ABSENT is normal. A locale with no machine layer yet resolves to English,
 *    which is the designed fallback.
 *  - UNREADABLE or malformed must stop the run. Treated as empty, it publishes a
 *    layer holding only the current run's keys and discards everything already
 *    translated, with a success message.
 *  - WRONG SHAPE must also stop the run. `JSON.parse('[]')` succeeds, and an
 *    array answers every key with `undefined`; asserted through
 *    `as TranslationLayer` nothing notices until a reader sees English.
 */
import fs from 'node:fs'

import type { TranslationLayer } from './types'

/**
 * A parsed artifact, checked rather than asserted.
 *
 * The shape is the same for every artifact the pipeline reads: a flat
 * `key -> string` map. Nested objects are the likeliest hand-edit, by grouping
 * keys under their namespace, and they would answer every flat lookup with
 * `undefined`.
 */
export function parseTranslationLayer(
  text: string,
  file: string
): TranslationLayer {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    throw new Error(`${file} is not valid JSON.`, { cause: error })
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${file} must be a flat map of keys to strings.`)
  }

  const layer: TranslationLayer = {}
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value !== 'string') {
      throw new Error(`${file}: "${key}" is not a string.`)
    }
    layer[key] = value
  }
  return layer
}

/**
 * Read an artifact from disk, treating only absence as empty.
 *
 * Any other read failure is thrown rather than swallowed: a permissions error
 * or an I/O fault says nothing about whether the locale has translations, and
 * answering "none" would publish that guess.
 */
export function readTranslationLayer(file: string): TranslationLayer {
  let text: string
  try {
    text = fs.readFileSync(file, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {}
    throw error
  }
  return parseTranslationLayer(text, file)
}
