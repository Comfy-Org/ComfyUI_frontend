import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

import type { AST } from 'vue-eslint-parser'
import { parseForESLint } from 'vue-eslint-parser'

const json = process.argv.includes('--json')
const candidates: {
  file: string
  line: number
  wrapper: string
  child: string
  attributes: string[]
}[] = []

function reportWrappers(node: AST.VElement, file: string, source: string) {
  const children = node.children.filter(
    (child) => child.type !== 'VText' || child.value.trim()
  )
  const [child] = children
  if (
    (node.rawName === 'div' || node.rawName === 'span') &&
    children.length === 1 &&
    child.type === 'VElement'
  ) {
    const attributes = node.startTag.attributes.map(({ key }) =>
      source.slice(...key.range)
    )
    candidates.push({
      file,
      line: node.loc.start.line,
      wrapper: node.rawName,
      child: child.rawName,
      attributes
    })
  }
  for (const child of children) {
    if (child.type === 'VElement') reportWrappers(child, file, source)
  }
}

const paths = process.argv.slice(2).filter((arg) => arg !== '--json')
const files = execFileSync(
  'git',
  [
    'ls-files',
    '-z',
    '--',
    ...(paths.length ? paths : ['src/renderer/extensions/vueNodes'])
  ],
  { encoding: 'utf8' }
)

for (const file of files.split('\0').filter((file) => file.endsWith('.vue'))) {
  const source = readFileSync(file, 'utf8')
  const { ast } = parseForESLint(source, { filePath: file, parser: false })
  if (ast.templateBody) reportWrappers(ast.templateBody, file, source)
}

if (json) {
  process.stdout.write(
    `${JSON.stringify({ schemaVersion: 1, candidates }, null, 2)}\n`
  )
} else {
  for (const { file, line, wrapper, child, attributes } of candidates) {
    process.stdout.write(
      `${file}:${line}\t<${wrapper}> > <${child}>\t${attributes.join(' ')}\n`
    )
  }
}
