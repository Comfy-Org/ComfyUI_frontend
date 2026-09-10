import { readFileSync } from 'node:fs'
import { posix, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { globSync } from 'glob'

const ownerRoot = (filename: string): string | undefined => {
  const match = /^(?:apps|packages|src)\/[^/]+/.exec(filename)
  return match?.[0]
}

export const findCrossBoundaryCssReferences = (
  filename: string,
  contents: string
) => {
  const normalizedFilename = filename.split('\\').join('/')
  const sourceOwner = ownerRoot(normalizedFilename)
  if (!sourceOwner) return []

  const uncommented = contents.replace(/\/\*[\s\S]*?\*\//g, (comment) =>
    comment.replace(/[^\n]/g, ' ')
  )
  const directivePattern =
    /^[\t ]*@(import|source)[\t ]+(?:not[\t ]+)?(?:url\([\t ]*)?(['"])([^'"]+)\2/gm

  return [...uncommented.matchAll(directivePattern)].flatMap((match) => {
    const directive = match[1]
    const reference = match[3]
    if (
      (directive !== 'import' && directive !== 'source') ||
      !reference.startsWith('.')
    ) {
      return []
    }

    const target = posix.normalize(
      posix.join(posix.dirname(normalizedFilename), reference)
    )
    if (
      ownerRoot(target) === sourceOwner &&
      !target.split('/').includes('node_modules')
    ) {
      return []
    }

    return [
      {
        directive,
        filename: normalizedFilename,
        lineNumber: uncommented.slice(0, match.index).split('\n').length,
        reference
      }
    ]
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
