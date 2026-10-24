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
  const metadata = exportedMetadata(source)
  const property = metadata?.properties.find(
    (property) =>
      ts.isPropertyAssignment(property) &&
      property.name.getText(source).replace(/['"]/g, '') === 'component'
  )
  if (
    !property ||
    !ts.isPropertyAssignment(property) ||
    !ts.isIdentifier(property.initializer)
  )
    return undefined
  return vueImport(source, property.initializer.text)
}

function vueImport(source: ts.SourceFile, component: string) {
  const declaration = source.statements.find(
    (node) =>
      ts.isImportDeclaration(node) &&
      node.importClause?.name?.text === component
  )
  if (
    !declaration ||
    !ts.isImportDeclaration(declaration) ||
    !ts.isStringLiteral(declaration.moduleSpecifier) ||
    !declaration.moduleSpecifier.text.endsWith('.vue')
  )
    return undefined
  return { component, componentPath: declaration.moduleSpecifier.text }
}

export function showcaseComponentImports(contents: string) {
  const source = ts.createSourceFile(
    'story.ts',
    contents,
    ts.ScriptTarget.Latest,
    true
  )
  const parameters = objectProperty(exportedMetadata(source), 'parameters')
  const catalog = objectProperty(parameters, 'catalog')
  const components = objectProperty(catalog, 'components')
  if (!components) return []
  return components.properties.flatMap((property) => {
    const identifier = ts.isShorthandPropertyAssignment(property)
      ? property.name
      : ts.isPropertyAssignment(property) &&
          ts.isIdentifier(property.initializer)
        ? property.initializer
        : undefined
    const imported = identifier && vueImport(source, identifier.text)
    if (!imported)
      throw new Error(
        `Invalid catalog component: ${property.name?.getText(source)}`
      )
    return [imported]
  })
}

function objectProperty(
  object: ts.ObjectLiteralExpression | undefined,
  name: string
): ts.ObjectLiteralExpression | undefined {
  const property = object?.properties.find(
    (property) =>
      ts.isPropertyAssignment(property) &&
      property.name.getText().replace(/['"]/g, '') === name
  )
  return property &&
    ts.isPropertyAssignment(property) &&
    ts.isObjectLiteralExpression(property.initializer)
    ? property.initializer
    : undefined
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
  const metadata = exportedMetadata(source)
  if (!metadata) return []
  const tags = metadata.properties.find(
    (property) =>
      ts.isPropertyAssignment(property) &&
      property.name.getText(source).replace(/['"]/g, '') === 'tags'
  )
  return literalTags(tags)
}

function exportedMetadata(
  source: ts.SourceFile
): ts.ObjectLiteralExpression | undefined {
  const exported = source.statements.find(ts.isExportAssignment)
  if (!exported) return undefined
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
  if (!ts.isObjectLiteralExpression(metadata)) return undefined
  return metadata
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
