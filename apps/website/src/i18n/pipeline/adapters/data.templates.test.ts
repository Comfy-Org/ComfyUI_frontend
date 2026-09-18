import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  createSourceFile,
  forEachChild,
  isArrayLiteralExpression,
  isObjectLiteralExpression,
  isPropertyAssignment,
  isStringLiteral,
  isTemplateExpression,
  isVariableDeclaration,
  ScriptTarget
} from 'typescript'
import type { Node } from 'typescript'
import { describe, expect, it } from 'vitest'

import { isLocale } from '../../../config/locales'

const KNOWN_UNREACHABLE = new Set([
  'qwenImage21.ts.qwenImage21Page.faq.items.how-to-run.answer.en',
  'qwenImage21.ts.qwenImage21Page.faq.items.how-to-run.answer.zh-CN',
  'ltx.ts.ltxPage.faq.items.what-is-ltx.answer.en',
  'ltx.ts.ltxPage.faq.items.what-is-ltx.answer.zh-CN',
  'ltx.ts.ltxPage.faq.items.whats-new.answer.en',
  'ltx.ts.ltxPage.faq.items.whats-new.answer.zh-CN',
  'ltx.ts.ltxPage.faq.items.which-variant.answer.en',
  'ltx.ts.ltxPage.faq.items.which-variant.answer.zh-CN',
  'ltx.ts.ltxPage.faq.items.run-in-comfyui.answer.en',
  'ltx.ts.ltxPage.faq.items.run-in-comfyui.answer.zh-CN',
  'ltx.ts.ltxPage.faq.items.is-it-free.answer.en',
  'ltx.ts.ltxPage.faq.items.is-it-free.answer.zh-CN',
  'minimax.ts.minimaxPage.faq.items.what-is-minimax.answer.en',
  'minimax.ts.minimaxPage.faq.items.what-is-minimax.answer.zh-CN',
  'minimax.ts.minimaxPage.faq.items.run-in-comfyui.answer.en',
  'minimax.ts.minimaxPage.faq.items.run-in-comfyui.answer.zh-CN',
  'minimaxLicense.ts.minimaxLicensePage.steps.items.enterprise.description.en',
  'minimaxLicense.ts.minimaxLicensePage.steps.items.enterprise.description.zh-CN',
  'minimaxLicense.ts.minimaxLicensePage.faq.items.who-needs-a-license.answer.en',
  'minimaxLicense.ts.minimaxLicensePage.faq.items.who-needs-a-license.answer.zh-CN',
  'wan3.ts.wan3Page.faq.items.how-to-run.answer.en',
  'wan3.ts.wan3Page.faq.items.how-to-run.answer.zh-CN'
])

function interpolatedLocaleValues(file: string, text: string): string[] {
  const source = createSourceFile(file, text, ScriptTarget.Latest, true)
  const found: string[] = []

  function walk(node: Node, path: string[]): void {
    if (isVariableDeclaration(node) || isPropertyAssignment(node)) {
      const name = node.name.getText(source).replace(/^['"]|['"]$/g, '')
      const nextPath = [...path, name]
      if (
        isPropertyAssignment(node) &&
        isLocale(name) &&
        isTemplateExpression(node.initializer)
      ) {
        found.push(nextPath.join('.'))
      }
      if (node.initializer) walk(node.initializer, nextPath)
      return
    }
    if (isArrayLiteralExpression(node)) {
      node.elements.forEach((element, index) => {
        const id = isObjectLiteralExpression(element)
          ? element.properties.find(
              (property) =>
                isPropertyAssignment(property) &&
                ['id', 'slug'].includes(property.name.getText(source)) &&
                isStringLiteral(property.initializer)
            )
          : undefined
        const key =
          id && isPropertyAssignment(id) && isStringLiteral(id.initializer)
            ? id.initializer.text
            : String(index)
        walk(element, [...path, key])
      })
      return
    }
    forEachChild(node, (child) => walk(child, path))
  }

  walk(source, [file])
  return found
}

describe('localized copy the data adapter cannot reach', () => {
  it('allows existing violations to disappear but forbids new entries', () => {
    const dataDir = join(process.cwd(), 'src', 'data')
    const violations = readdirSync(dataDir)
      .filter((file) => file.endsWith('.ts'))
      .flatMap((file) =>
        interpolatedLocaleValues(
          file,
          readFileSync(join(dataDir, file), 'utf8')
        )
      )

    expect(violations.filter((key) => !KNOWN_UNREACHABLE.has(key))).toEqual([])
  })
})
