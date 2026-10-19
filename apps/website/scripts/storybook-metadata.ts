import { storyNameFromExport, toId } from 'storybook/internal/csf'
import ts from 'typescript'

export function storyId(title: string, exportName: string): string {
  return toId(title, storyNameFromExport(exportName))
}

export function componentImport(contents: string):
  | {
      component: string
      componentPath: string
    }
  | undefined {
  const source = ts.createSourceFile(
    'component.stories.ts',
    contents,
    ts.ScriptTarget.Latest,
    true
  )
  const imports = new Map<string, string>()
  let component: string | undefined

  function visit(node: ts.Node) {
    if (
      ts.isImportDeclaration(node) &&
      node.importClause?.name &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      imports.set(node.importClause.name.text, node.moduleSpecifier.text)
    }
    if (
      ts.isPropertyAssignment(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'component' &&
      ts.isIdentifier(node.initializer)
    ) {
      component = node.initializer.text
    }
    ts.forEachChild(node, visit)
  }

  visit(source)
  const componentPath = component && imports.get(component)
  if (!component || !componentPath?.endsWith('.vue')) return undefined
  return { component, componentPath }
}

function unwrap(expression: ts.Expression): ts.Expression {
  if (
    ts.isSatisfiesExpression(expression) ||
    ts.isAsExpression(expression) ||
    ts.isParenthesizedExpression(expression)
  )
    return unwrap(expression.expression)
  return expression
}

export function storyTags(contents: string): string[] {
  const source = ts.createSourceFile(
    'story.ts',
    contents,
    ts.ScriptTarget.Latest,
    true
  )
  const exported = source.statements.find(ts.isExportAssignment)
  if (!exported) return []
  const expression = unwrap(exported.expression)
  const name = ts.isIdentifier(expression) ? expression.text : undefined
  const declaration = source.statements
    .filter(ts.isVariableStatement)
    .flatMap((statement) => [...statement.declarationList.declarations])
    .find(
      (declaration) =>
        ts.isIdentifier(declaration.name) && declaration.name.text === name
    )
  const metadata = unwrap(declaration?.initializer ?? expression)
  if (!ts.isObjectLiteralExpression(metadata)) return []
  const tags = metadata.properties.find(
    (property) =>
      ts.isPropertyAssignment(property) &&
      property.name.getText(source).replace(/['"]/g, '') === 'tags'
  )
  return literalTags(tags)
}

function literalTags(tags: ts.ObjectLiteralElementLike | undefined): string[] {
  if (
    !tags ||
    !ts.isPropertyAssignment(tags) ||
    !ts.isArrayLiteralExpression(tags.initializer)
  )
    return []
  return tags.initializer.elements
    .filter(ts.isStringLiteral)
    .map((tag) => tag.text)
}

export function portablePath(path: string): string {
  return path.replaceAll('\\', '/')
}
