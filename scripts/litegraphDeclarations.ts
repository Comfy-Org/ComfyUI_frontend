import { readdirSync, readFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import ts from 'typescript'

interface Registration {
  file: string
  names: { name: string; alias: string }[]
}

function registryAugmentation(node: ts.Node): node is ts.ModuleDeclaration & {
  body: ts.ModuleBlock
} {
  return (
    ts.isModuleDeclaration(node) &&
    ts.isStringLiteral(node.name) &&
    node.name.text.endsWith('/entityRegistry') &&
    node.body !== undefined &&
    ts.isModuleBlock(node.body)
  )
}

export function createLitegraphDeclarationTransform(root: string) {
  const registrations: Registration[] = readdirSync(root, {
    recursive: true,
    encoding: 'utf8'
  }).flatMap((file) => {
    if (!file.endsWith('.ts')) return []
    const content = readFileSync(resolve(root, file), 'utf8')
    if (!content.includes('declare module')) return []
    const source = ts.createSourceFile(
      file,
      content,
      ts.ScriptTarget.Latest,
      true
    )
    const names = source.statements
      .filter(registryAugmentation)
      .flatMap((node) =>
        node.body.statements.flatMap((statement) => {
          if (!ts.isInterfaceDeclaration(statement)) return []
          if (statement.name.text === 'LitegraphEntityRegistry') {
            return statement.members.flatMap((member) =>
              ts.isPropertySignature(member) && member.type
                ? [
                    {
                      name: member.name.getText(source),
                      alias: member.type.getText(source)
                    }
                  ]
                : []
            )
          }
          return (
            statement.heritageClauses?.flatMap((clause) =>
              clause.types.map((type) => ({
                name: statement.name.text,
                alias: type.expression.getText(source)
              }))
            ) ?? []
          )
        })
      )
    return names.length ? [{ file: file.replaceAll('\\', '/'), names }] : []
  })

  return (
    filePath: string,
    content: string
  ): { content: string } | undefined => {
    const outputPath = filePath.replaceAll('\\', '/')
    if (outputPath.endsWith('/types/entityRegistry.d.ts')) {
      return {
        content: registrations
          .map(({ file, names }) => {
            const owner = relative('types', file)
              .replaceAll('\\', '/')
              .replace(/\.ts$/, '')
            return `export type { ${names.map(({ name, alias }) => `${alias} as ${name}`).join(', ')} } from '${owner.startsWith('.') ? owner : './' + owner}'`
          })
          .join('\n')
      }
    }
    const registration = registrations.find(({ file }) =>
      outputPath.endsWith('/' + file.replace(/\.ts$/, '.d.ts'))
    )
    if (!registration) return undefined
    const source = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true
    )
    const aliases = new Set(registration.names.map(({ alias }) => alias))
    const edits = source.statements.flatMap((statement) => {
      if (registryAugmentation(statement)) {
        return [
          { start: statement.getFullStart(), end: statement.getEnd(), text: '' }
        ]
      }
      if (
        ts.isTypeAliasDeclaration(statement) &&
        aliases.has(statement.name.text) &&
        !statement.modifiers?.some(
          (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
        )
      ) {
        return [
          {
            start: statement.getStart(source),
            end: statement.getStart(source),
            text: 'export '
          }
        ]
      }
      return []
    })
    return {
      content: edits
        .reverse()
        .reduce(
          (text, edit) =>
            text.slice(0, edit.start) + edit.text + text.slice(edit.end),
          content
        )
    }
  }
}
