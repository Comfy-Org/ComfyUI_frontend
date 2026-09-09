import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  createSourceFile,
  forEachChild,
  isPropertyAssignment,
  isTemplateExpression,
  ScriptTarget
} from 'typescript'
import type { Node } from 'typescript'
import { describe, expect, it } from 'vitest'

import { isLocale } from '../../../config/locales'

/**
 * A `LocalizedText` value written as an interpolated template is invisible to
 * the translation pipeline.
 *
 * `literalText` in the adapter accepts a string literal and a template with no
 * substitutions, and returns `undefined` for anything else. A value like
 * `` `... [the blog](${links.post}).` `` is therefore never extracted, never
 * reaches `content/en.json`, and can never be translated — while the English
 * renders perfectly, so nothing looks wrong.
 *
 * That is how `ltx.faq.*` came to have Japanese questions with English answers:
 * not a missing translation, but copy the pipeline could not see.
 *
 * The real fix is to write these as plain strings with a `{placeholder}` and
 * substitute at render, the way `enterprise.faq.security.answer` does. Until
 * that conversion happens, this test pins the known set so the gap cannot grow.
 */
const KNOWN_UNREACHABLE: Readonly<Record<string, number>> = {
  'ltx.ts': 10,
  'minimax.ts': 4,
  'minimaxLicense.ts': 4,
  'wan3.ts': 2
}

function interpolatedLocaleValues(file: string, text: string): number {
  const source = createSourceFile(file, text, ScriptTarget.Latest, true)
  let count = 0
  const walk = (node: Node) => {
    if (
      isPropertyAssignment(node) &&
      isTemplateExpression(node.initializer) &&
      isLocale(node.name.getText().replace(/['"]/g, ''))
    ) {
      count += 1
    }
    forEachChild(node, walk)
  }
  forEachChild(source, walk)
  return count
}

describe('localized copy the data adapter cannot reach', () => {
  const dataDir = join(process.cwd(), 'src', 'data')
  const counts: Record<string, number> = {}

  for (const file of readdirSync(dataDir).filter((f) => f.endsWith('.ts'))) {
    const found = interpolatedLocaleValues(
      file,
      readFileSync(join(dataDir, file), 'utf8')
    )
    if (found > 0) counts[file] = found
  }

  it('has not grown beyond the recorded backlog', () => {
    expect(counts).toEqual(KNOWN_UNREACHABLE)
  })
})
