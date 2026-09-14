import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

import * as ts from 'typescript'

export function findUntypedMockFactories(file: string, text: string) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  const sites: {
    file: string
    line: number
    endLine: number
    module: string
  }[] = []

  function visit(node: ts.Node) {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === 'vi' &&
      ['mock', 'doMock'].includes(node.expression.name.text) &&
      node.typeArguments?.length === 1 &&
      node.typeArguments[0].kind === ts.SyntaxKind.UnknownKeyword
    ) {
      const argument = node.arguments[0]
      const module =
        argument &&
        ts.isCallExpression(argument) &&
        argument.expression.kind === ts.SyntaxKind.ImportKeyword
          ? argument.arguments[0]
          : argument
      sites.push({
        file,
        line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
        endLine: source.getLineAndCharacterOfPosition(node.end).line + 1,
        module: module && ts.isStringLiteral(module) ? module.text : '<dynamic>'
      })
    }
    ts.forEachChild(node, visit)
  }

  visit(source)
  return sites
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const files = execFileSync('git', ['ls-files', '-z', 'src'], {
    encoding: 'utf8'
  })
    .split('\0')
    .filter((file) => /\.tsx?$/.test(file))
  const sites = files.flatMap((file) =>
    findUntypedMockFactories(file, readFileSync(file, 'utf8'))
  )
  console.log(JSON.stringify(sites, null, 2))
}
