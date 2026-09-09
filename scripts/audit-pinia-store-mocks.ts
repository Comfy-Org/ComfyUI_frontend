import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import * as ts from 'typescript'

const files = execFileSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
  { encoding: 'utf8' }
)
  .split('\0')
  .filter((file) => /\.[cm]?[jt]sx?$/.test(file))
  .sort((a, b) => a.localeCompare(b))

const matches: { file: string; line: number; module: string }[] = []

for (const file of files) {
  const text = readFileSync(file, 'utf8')
  if (!/\bvi\.(?:mock|doMock)\b/.test(text)) continue

  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)

  function visit(node: ts.Node) {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.expression.getText(source) === 'vi' &&
      ['mock', 'doMock'].includes(node.expression.name.text)
    ) {
      const argument = node.arguments.at(0)
      const target =
        argument && ts.isCallExpression(argument)
          ? argument.arguments.at(0)
          : argument
      if (target && ts.isStringLiteralLike(target)) {
        const module = target.text
        const path = module.startsWith('@/')
          ? resolve('src', module.slice(2))
          : module.startsWith('.')
            ? resolve(dirname(file), module)
            : undefined
        const resolved = path
          ? [path, `${path}.ts`, `${path}/index.ts`].find(
              (candidate) => candidate.endsWith('.ts') && existsSync(candidate)
            )
          : undefined
        if (
          module === 'pinia' ||
          (resolved &&
            /\bdefineStore\s*\(/.test(readFileSync(resolved, 'utf8')))
        ) {
          matches.push({
            file,
            line:
              source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
            module
          })
        }
      }
    }
    ts.forEachChild(node, visit)
  }

  visit(source)
}

for (const { file, line, module } of matches) {
  process.stdout.write(`${file}:${line}\t${module}\n`)
}
process.stdout.write(
  `${matches.length} store-module mock candidates in ${new Set(matches.map(({ file }) => file)).size} files\n`
)
