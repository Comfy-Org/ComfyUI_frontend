import { execFileSync } from 'node:child_process'

import * as ts from 'typescript'

const files = execFileSync('git', ['ls-files', ':(glob)src/**/*.test.ts'], {
  encoding: 'utf8'
})
  .trim()
  .split('\n')
  .filter(Boolean)

const program = ts.createProgram(files, {
  target: ts.ScriptTarget.Latest,
  noResolve: true,
  noLib: true,
  types: []
})
const checker = program.getTypeChecker()

type Finding = {
  file: string
  line: number
  name: string
  classification: 'direct-store-member' | 'derived-value' | 'other'
  initializer: string
}

const findings: Finding[] = []

for (const source of program.getSourceFiles()) {
  const file = source.fileName
  const declarations: Array<{
    name: ts.Identifier
    statement: ts.VariableStatement
  }> = []
  const assignments: Array<{
    name: ts.Identifier
    value: ts.Expression
  }> = []

  const visit = (node: ts.Node, inHook = false) => {
    if (ts.isVariableStatement(node)) {
      for (const declaration of node.declarationList.declarations) {
        if (
          ts.isIdentifier(declaration.name) &&
          !declaration.initializer &&
          (node.declarationList.flags & ts.NodeFlags.Let) !== 0
        ) {
          declarations.push({ name: declaration.name, statement: node })
        }
      }
    }

    const hook =
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      ['beforeEach', 'beforeAll'].includes(node.expression.text)
    if (
      inHook &&
      ts.isExpressionStatement(node) &&
      ts.isBinaryExpression(node.expression) &&
      node.expression.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isIdentifier(node.expression.left)
    ) {
      assignments.push({
        name: node.expression.left,
        value: node.expression.right
      })
    }
    ts.forEachChild(node, (child) => visit(child, inHook || hook))
  }
  visit(source)

  for (const declaration of declarations) {
    const name = declaration.name.text
    const symbol = checker.getSymbolAtLocation(declaration.name)
    if (!symbol) continue
    const assignment = assignments.find(
      (candidate) => checker.getSymbolAtLocation(candidate.name) === symbol
    )
    if (!assignment) continue

    const unwrapped =
      ts.isCallExpression(assignment.value) &&
      assignment.value.arguments.length === 1 &&
      assignment.value.expression.getText(source) === 'vi.mocked'
        ? assignment.value.arguments[0]
        : assignment.value
    const directStoreMember =
      ts.isPropertyAccessExpression(unwrapped) &&
      ts.isCallExpression(unwrapped.expression) &&
      ts.isIdentifier(unwrapped.expression.expression) &&
      /^use\w+Store$/.test(unwrapped.expression.expression.text)

    findings.push({
      file,
      line:
        source.getLineAndCharacterOfPosition(
          declaration.statement.getStart(source)
        ).line + 1,
      name,
      classification: directStoreMember
        ? 'direct-store-member'
        : ts.isPropertyAccessExpression(unwrapped)
          ? 'derived-value'
          : 'other',
      initializer: assignment.value.getText(source).replace(/\s+/g, ' ')
    })
  }
}

process.stdout.write(
  findings
    .sort((a, b) =>
      `${a.file}:${a.line}:${a.name}`.localeCompare(
        `${b.file}:${b.line}:${b.name}`
      )
    )
    .map(
      (finding) =>
        `${finding.classification}\t${finding.file}:${finding.line}\t${finding.name}\t${finding.initializer}`
    )
    .join('\n') + '\n'
)
