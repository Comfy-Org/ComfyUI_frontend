#!/usr/bin/env node

/**
 * Generates a JSON snapshot of the public API surface from TypeScript definitions.
 * This snapshot is used to track API changes between versions.
 */

import * as fs from 'fs'
import * as path from 'path'
import * as ts from 'typescript'

const args = process.argv.slice(2)
if (args.length === 0) {
  console.error('Usage: snapshot-api.js <path-to-index.d.ts>')
  process.exit(1)
}

const filePath = args[0]
if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`)
  process.exit(1)
}

/**
 * Extract API surface from TypeScript definitions
 */
function extractApiSurface(sourceFile) {
  const api = {
    types: {},
    interfaces: {},
    enums: {},
    functions: {},
    classes: {},
    constants: {}
  }

  function visit(node) {
    // Extract type aliases
    if (ts.isTypeAliasDeclaration(node) && node.name) {
      const name = node.name.text
      const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart())
      api.types[name] = {
        kind: 'type',
        name,
        text: node.getText(sourceFile),
        exported: hasExportModifier(node),
        line: line + 1 // Convert to 1-indexed
      }
    }

    // Extract interfaces
    if (ts.isInterfaceDeclaration(node) && node.name) {
      const name = node.name.text
      const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart())
      const members = []

      node.members.forEach((member) => {
        if (ts.isPropertySignature(member) && member.name) {
          members.push({
            name: member.name.getText(sourceFile),
            type: member.type ? member.type.getText(sourceFile) : 'any',
            optional: !!member.questionToken
          })
        } else if (ts.isMethodSignature(member) && member.name) {
          members.push({
            name: member.name.getText(sourceFile),
            kind: 'method',
            parameters: member.parameters.map((p) => ({
              name: p.name.getText(sourceFile),
              type: p.type ? p.type.getText(sourceFile) : 'any',
              optional: !!p.questionToken
            })),
            returnType: member.type ? member.type.getText(sourceFile) : 'void'
          })
        }
      })

      api.interfaces[name] = {
        kind: 'interface',
        name,
        members,
        exported: hasExportModifier(node),
        heritage: node.heritageClauses
          ? node.heritageClauses
              .map((clause) =>
                clause.types.map((type) => type.getText(sourceFile))
              )
              .flat()
          : [],
        line: line + 1 // Convert to 1-indexed
      }
    }

    // Extract enums
    if (ts.isEnumDeclaration(node) && node.name) {
      const name = node.name.text
      const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart())
      const members = node.members.map((member) => ({
        name: member.name.getText(sourceFile),
        value: member.initializer
          ? member.initializer.getText(sourceFile)
          : undefined
      }))

      api.enums[name] = {
        kind: 'enum',
        name,
        members,
        exported: hasExportModifier(node),
        line: line + 1 // Convert to 1-indexed
      }
    }

    // Extract functions
    if (ts.isFunctionDeclaration(node) && node.name) {
      const name = node.name.text
      const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart())
      api.functions[name] = {
        kind: 'function',
        name,
        parameters: node.parameters.map((p) => ({
          name: p.name.getText(sourceFile),
          type: p.type ? p.type.getText(sourceFile) : 'any',
          optional: !!p.questionToken
        })),
        returnType: node.type ? node.type.getText(sourceFile) : 'any',
        exported: hasExportModifier(node),
        line: line + 1 // Convert to 1-indexed
      }
    }

    // Extract classes
    if (ts.isClassDeclaration(node) && node.name) {
      const name = node.name.text
      const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart())
      const members = []
      const methods = []

      node.members.forEach((member) => {
        if (ts.isPropertyDeclaration(member) && member.name) {
          members.push({
            name: member.name.getText(sourceFile),
            type: member.type ? member.type.getText(sourceFile) : 'any',
            static: hasStaticModifier(member),
            visibility: getVisibility(member)
          })
        } else if (ts.isMethodDeclaration(member) && member.name) {
          methods.push({
            name: member.name.getText(sourceFile),
            parameters: member.parameters.map((p) => ({
              name: p.name.getText(sourceFile),
              type: p.type ? p.type.getText(sourceFile) : 'any',
              optional: !!p.questionToken
            })),
            returnType: member.type ? member.type.getText(sourceFile) : 'any',
            static: hasStaticModifier(member),
            visibility: getVisibility(member)
          })
        }
      })

      api.classes[name] = {
        kind: 'class',
        name,
        members,
        methods,
        exported: hasExportModifier(node),
        heritage: node.heritageClauses
          ? node.heritageClauses
              .map((clause) =>
                clause.types.map((type) => type.getText(sourceFile))
              )
              .flat()
          : [],
        line: line + 1 // Convert to 1-indexed
      }
    }

    // Extract variable declarations (constants)
    if (ts.isVariableStatement(node)) {
      const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart())
      node.declarationList.declarations.forEach((decl) => {
        if (decl.name && ts.isIdentifier(decl.name)) {
          const name = decl.name.text
          api.constants[name] = {
            kind: 'constant',
            name,
            type: decl.type ? decl.type.getText(sourceFile) : 'unknown',
            exported: hasExportModifier(node),
            line: line + 1 // Convert to 1-indexed
          }
        }
      })
    }

    ts.forEachChild(node, visit)
  }

  function hasExportModifier(node) {
    return (
      node.modifiers &&
      node.modifiers.some((mod) => mod.kind === ts.SyntaxKind.ExportKeyword)
    )
  }

  function hasStaticModifier(node) {
    return (
      node.modifiers &&
      node.modifiers.some((mod) => mod.kind === ts.SyntaxKind.StaticKeyword)
    )
  }

  function getVisibility(node) {
    if (!node.modifiers) return 'public'
    if (node.modifiers.some((mod) => mod.kind === ts.SyntaxKind.PrivateKeyword))
      return 'private'
    if (
      node.modifiers.some((mod) => mod.kind === ts.SyntaxKind.ProtectedKeyword)
    )
      return 'protected'
    return 'public'
  }

  visit(sourceFile)
  return api
}

// Read and parse the file
const sourceCode = fs.readFileSync(filePath, 'utf-8')
const sourceFile = ts.createSourceFile(
  path.basename(filePath),
  sourceCode,
  ts.ScriptTarget.Latest,
  true
)

const apiSurface = extractApiSurface(sourceFile)

// Output as JSON
console.log(JSON.stringify(apiSurface, null, 2))
