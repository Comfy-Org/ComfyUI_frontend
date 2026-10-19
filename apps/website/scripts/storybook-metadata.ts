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
