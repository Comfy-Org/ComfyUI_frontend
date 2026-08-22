const GENERATED_PACKAGE = '@comfyorg/ingest-types'

interface Identifier {
  readonly type: 'Identifier'
  readonly name: string
}

interface QualifiedName {
  readonly type: 'TSQualifiedName'
  readonly left?: Identifier
  readonly right?: Identifier
}

interface MemberExpression {
  readonly type: 'MemberExpression'
}

interface TypeArguments {
  readonly params?: readonly TypeNode[]
}

interface PropertySignature {
  readonly type: string
  readonly computed?: boolean
  readonly key?: {
    readonly type: string
    readonly name?: string
    readonly value?: unknown
  }
}

interface TypeNode {
  readonly type: string
  readonly typeName?: Identifier | QualifiedName
  readonly types?: readonly TypeNode[]
  readonly typeArguments?: TypeArguments
  readonly members?: readonly PropertySignature[]
  readonly literal?: { readonly value?: unknown }
}

interface InterfaceHeritage {
  readonly expression?: Identifier | MemberExpression
  readonly typeArguments?: TypeArguments
}

interface ImportSpecifier {
  readonly type: string
  readonly local?: Identifier
  readonly imported?: { readonly type: string; readonly name?: string }
}

interface ImportDeclaration {
  readonly source: { readonly value: string }
  readonly specifiers?: readonly ImportSpecifier[]
}

interface NamedDeclaration {
  readonly id: Identifier
}

interface TypeAliasDeclaration extends NamedDeclaration {
  readonly typeAnnotation?: TypeNode
}

interface InterfaceDeclaration extends NamedDeclaration {
  readonly extends?: readonly InterfaceHeritage[]
  readonly body?: { readonly body?: readonly PropertySignature[] }
}

interface RuleContext {
  report(descriptor: { node: unknown; message: string }): void
}

function namesBinding(
  reference: Identifier | QualifiedName | MemberExpression | undefined,
  typeArguments: TypeArguments | undefined,
  bindings: ReadonlySet<string>
): boolean {
  if (reference?.type === 'Identifier' && bindings.has(reference.name)) {
    return true
  }
  return (typeArguments?.params ?? []).some((param) =>
    referencesBinding(param, bindings)
  )
}

function referencesBinding(
  node: TypeNode | undefined,
  bindings: ReadonlySet<string>
): boolean {
  if (node?.type !== 'TSTypeReference') return false
  return namesBinding(node.typeName, node.typeArguments, bindings)
}

function isComposite(node: TypeNode): boolean {
  return node.type === 'TSUnionType' || node.type === 'TSIntersectionType'
}

// `GeneratedX | null` and `Omit<GeneratedX, 'k'> & { … }` are both derivations,
// so unions and intersections alike are flattened before looking for the import.
function compositeLeaves(annotation: TypeNode): readonly TypeNode[] {
  return isComposite(annotation)
    ? (annotation.types ?? []).flatMap(compositeLeaves)
    : [annotation]
}

// Only an intersection can omit a key and add it back; a union's arms are
// alternatives, so each arm is examined on its own.
function intersectionGroups(
  annotation: TypeNode
): readonly (readonly TypeNode[])[] {
  if (annotation.type === 'TSUnionType') {
    return (annotation.types ?? []).flatMap(intersectionGroups)
  }
  return [
    annotation.type === 'TSIntersectionType'
      ? (annotation.types ?? [])
      : [annotation]
  ]
}

function heritageAsTypeReference(clause: InterfaceHeritage): TypeNode {
  return {
    type: 'TSTypeReference',
    typeName:
      clause.expression?.type === 'Identifier' ? clause.expression : undefined,
    typeArguments: clause.typeArguments
  }
}

// Resolves same-file aliases so `Omit<G, Keys>` is as readable as
// `Omit<G, 'a' | 'b'>`. Keys behind an import or a mapped type stay unreadable
// without type information, and are therefore never reported.
function stringLiteralsIn(
  node: TypeNode | undefined,
  literalUnionAliases: ReadonlyMap<string, TypeNode>,
  seen: Set<string> = new Set()
): string[] {
  if (node === undefined) return []
  if (node.type === 'TSLiteralType') {
    const value = node.literal?.value
    return typeof value === 'string' ? [value] : []
  }
  if (node.type === 'TSUnionType') {
    return (node.types ?? []).flatMap((member) =>
      stringLiteralsIn(member, literalUnionAliases, seen)
    )
  }
  if (node.type === 'TSTypeReference' && node.typeName?.type === 'Identifier') {
    const { name } = node.typeName
    if (seen.has(name)) return []
    const aliased = literalUnionAliases.get(name)
    if (aliased === undefined) return []
    return stringLiteralsIn(
      aliased,
      literalUnionAliases,
      new Set([...seen, name])
    )
  }
  return []
}

function keysOmittedFrom(
  member: TypeNode,
  bindings: ReadonlySet<string>,
  literalUnionAliases: ReadonlyMap<string, TypeNode>
): string[] {
  if (member.type !== 'TSTypeReference') return []
  if (member.typeName?.type !== 'Identifier') return []
  if (member.typeName.name !== 'Omit') return []

  const [source, keys] = member.typeArguments?.params ?? []
  if (!referencesBinding(source, bindings)) return []
  return stringLiteralsIn(keys, literalUnionAliases)
}

// `{ tier: T }` and `{ 'tier': T }` declare the same property, so both key
// forms have to count. Computed keys are unreadable and so never reported.
function propertyNamesIn(
  members: readonly PropertySignature[] | undefined
): string[] {
  const names: string[] = []
  for (const member of members ?? []) {
    if (member.type !== 'TSPropertySignature' || member.computed) continue
    const key = member.key
    if (key?.type === 'Identifier' && key.name !== undefined) {
      names.push(key.name)
    } else if (key?.type === 'Literal' && typeof key.value === 'string') {
      names.push(key.value)
    }
  }
  return names
}

// A key omitted from the generated type and then re-declared locally is drift
// wearing a derivation's clothes: the local shape claims to follow the contract
// while silently replacing that field's type or optionality. Relaxing presence
// with `Omit<G, K> & Partial<Pick<G, K>>` re-declares nothing, so it stays clean.
function keysOmittedThenRedeclared(
  members: readonly TypeNode[],
  ownProperties: readonly string[],
  bindings: ReadonlySet<string>,
  literalUnionAliases: ReadonlyMap<string, TypeNode>
): string[] {
  const redeclared = new Set(ownProperties)
  for (const member of members) {
    if (member.type !== 'TSTypeLiteral') continue
    for (const name of propertyNamesIn(member.members)) redeclared.add(name)
  }
  if (redeclared.size === 0) return []

  return [
    ...new Set(
      members
        .flatMap((member) =>
          keysOmittedFrom(member, bindings, literalUnionAliases)
        )
        .filter((key) => redeclared.has(key))
    )
  ]
}

function duplicateMessage(name: string): string {
  return `'${name}' is imported from ${GENERATED_PACKAGE} and re-declared here. Re-export the generated type, or give the local model a distinct name (e.g. '${name}View') so the contract and the local view cannot be confused. For remote response schemas, also see comfy/no-new-zod-for-remote-api-types — see docs/guidance/typescript.md.`
}

function driftMessage(name: string, keys: readonly string[]): string {
  const plural = keys.length > 1
  const list = keys.map((key) => `'${key}'`).join(', ')
  return `'${name}' omits ${list} from the generated '${name}' and re-declares ${plural ? 'them' : 'it'}, silently replacing the API contract for ${plural ? 'those fields' : 'that field'}. Keep the generated ${plural ? 'fields' : 'field'}, relax presence with 'Partial<Pick<...>>' so the ${plural ? 'types' : 'type'} still ${plural ? 'come' : 'comes'} from the contract, or rename the local model. For remote response schemas, also see comfy/no-new-zod-for-remote-api-types — see docs/guidance/typescript.md.`
}

// Imports and key aliases are only complete once the file has been walked, so
// declarations are queued and judged on Program:exit rather than in place.
export const noDuplicateIngestType = {
  create(context: RuleContext) {
    const exportNameByLocalBinding = new Map<string, string>()
    const literalUnionAliases = new Map<string, TypeNode>()
    const aliases: TypeAliasDeclaration[] = []
    const interfaces: InterfaceDeclaration[] = []

    const bindingsAliasing = (exportName: string): ReadonlySet<string> => {
      const bindings = new Set<string>()
      for (const [binding, exported] of exportNameByLocalBinding) {
        if (exported === exportName) bindings.add(binding)
      }
      return bindings
    }

    const reportDuplicate = (node: NamedDeclaration) =>
      context.report({
        node: node.id,
        message: duplicateMessage(node.id.name)
      })

    const reportDriftIfAny = (
      node: NamedDeclaration,
      members: readonly TypeNode[],
      ownProperties: readonly string[],
      bindings: ReadonlySet<string>
    ) => {
      const keys = keysOmittedThenRedeclared(
        members,
        ownProperties,
        bindings,
        literalUnionAliases
      )
      if (keys.length === 0) return
      context.report({
        node: node.id,
        message: driftMessage(node.id.name, keys)
      })
    }

    const checkInterface = (node: InterfaceDeclaration) => {
      const bindings = bindingsAliasing(node.id.name)
      if (bindings.size === 0) return

      const heritage = (node.extends ?? []).map(heritageAsTypeReference)
      if (!heritage.some((clause) => referencesBinding(clause, bindings))) {
        reportDuplicate(node)
        return
      }
      reportDriftIfAny(
        node,
        heritage,
        propertyNamesIn(node.body?.body),
        bindings
      )
    }

    const checkAlias = (node: TypeAliasDeclaration) => {
      const bindings = bindingsAliasing(node.id.name)
      if (bindings.size === 0) return

      const annotation = node.typeAnnotation
      if (annotation === undefined) {
        reportDuplicate(node)
        return
      }

      const leaves = compositeLeaves(annotation)
      if (!leaves.some((leaf) => referencesBinding(leaf, bindings))) {
        reportDuplicate(node)
        return
      }
      for (const group of intersectionGroups(annotation)) {
        reportDriftIfAny(node, group, [], bindings)
      }
    }

    return {
      ImportDeclaration(node: ImportDeclaration) {
        if (node.source.value !== GENERATED_PACKAGE) return
        for (const specifier of node.specifiers ?? []) {
          if (specifier.type !== 'ImportSpecifier') continue
          const { local, imported } = specifier
          if (!local || imported?.type !== 'Identifier') continue
          exportNameByLocalBinding.set(local.name, imported.name ?? local.name)
        }
      },
      TSInterfaceDeclaration(node: InterfaceDeclaration) {
        interfaces.push(node)
      },
      TSTypeAliasDeclaration(node: TypeAliasDeclaration) {
        aliases.push(node)
        const annotation = node.typeAnnotation
        if (
          annotation?.type === 'TSLiteralType' ||
          annotation?.type === 'TSUnionType' ||
          annotation?.type === 'TSTypeReference'
        ) {
          literalUnionAliases.set(node.id.name, annotation)
        }
      },
      'Program:exit'() {
        for (const node of interfaces) checkInterface(node)
        for (const node of aliases) checkAlias(node)
      }
    }
  }
}
