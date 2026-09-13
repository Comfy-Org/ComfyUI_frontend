import { readFileSync } from 'node:fs'
import { posix, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { globSync } from 'glob'
import postcss from 'postcss'
import parseCssValue from 'postcss-value-parser'
import { parse as parseVue } from 'vue/compiler-sfc'

type CssBoundaryViolation = {
  directive: 'import' | 'source'
  filename: string
  lineNumber: number
  reference: string
}

const ownerRoot = (filename: string): string | undefined => {
  const match = /^(?:apps|packages|src)\/[^/]+/.exec(filename)
  return match?.[0]
}

const decodeCssEscapes = (value: string) =>
  value.replace(
    /\\([0-9a-fA-F]{1,6}[\t\n\f\r ]?|\r\n|[\s\S])/g,
    (_, escaped: string) => {
      const hex = /^[0-9a-fA-F]{1,6}/.exec(escaped)?.[0]
      if (!hex) return /^[\n\f\r]/.test(escaped) ? '' : escaped

      const codePoint = Number.parseInt(hex, 16)
      return codePoint === 0 || codePoint > 0x10ffff
        ? '\uFFFD'
        : String.fromCodePoint(codePoint)
    }
  )

const directiveReference = (params: string) => {
  const nodes = parseCssValue(params).nodes.filter(
    ({ type }) => type !== 'space' && type !== 'comment'
  )
  const firstNode = nodes.at(0)
  const node = firstNode?.value === 'not' ? nodes.at(1) : firstNode
  if (node?.type === 'string' || node?.type === 'word') return node.value
  if (node?.type !== 'function' || node.value.toLowerCase() !== 'url') return

  const value = node.nodes.find(
    ({ type }) => type !== 'space' && type !== 'comment'
  )
  return value?.type === 'string' || value?.type === 'word'
    ? value.value
    : undefined
}

export const findCrossBoundaryCssReferences = (
  filename: string,
  contents: string
): CssBoundaryViolation[] => {
  const normalizedFilename = filename.split('\\').join('/')
  const sourceOwner = ownerRoot(normalizedFilename)
  if (!sourceOwner) return []

  const stylesheets = normalizedFilename.endsWith('.vue')
    ? parseVue(contents, {
        filename: normalizedFilename
      }).descriptor.styles.map((style) => ({
        contents: style.content,
        lineOffset: style.loc.start.line - 1
      }))
    : [{ contents, lineOffset: 0 }]

  return stylesheets.flatMap(({ contents, lineOffset }) => {
    const violations: CssBoundaryViolation[] = []
    postcss
      .parse(contents, { from: normalizedFilename })
      .walkAtRules((rule) => {
        const directive = rule.name.toLowerCase()
        if (directive !== 'import' && directive !== 'source') return

        const reference = directiveReference(rule.params)
        if (!reference) return

        const decodedReference = decodeCssEscapes(reference)
        if (!decodedReference.startsWith('.')) return

        const target = posix.normalize(
          posix.join(posix.dirname(normalizedFilename), decodedReference)
        )
        if (
          ownerRoot(target) === sourceOwner &&
          !target.split('/').includes('node_modules')
        ) {
          return
        }

        violations.push({
          directive,
          filename: normalizedFilename,
          lineNumber: lineOffset + (rule.source?.start?.line ?? 1),
          reference
        })
      })
    return violations
  })
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  const filenames = globSync('{apps,packages,src}/**/*.{css,vue}', {
    nodir: true
  })
  const violations = filenames.flatMap((filename) =>
    findCrossBoundaryCssReferences(filename, readFileSync(filename, 'utf8'))
  )

  if (violations.length) {
    const details = violations
      .map(
        ({ directive, filename, lineNumber, reference }) =>
          `${filename}:${lineNumber}: @${directive} '${reference}' crosses the '${ownerRoot(filename)}' CSS ownership boundary`
      )
      .join('\n')
    throw new Error(`Cross-boundary relative CSS references found:\n${details}`)
  }

  process.stdout.write('CSS import boundaries validated\n')
}
