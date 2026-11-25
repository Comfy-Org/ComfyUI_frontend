import path from 'node:path'

import { babelParse, parse } from 'vue/compiler-sfc'
import type { SFCDescriptor } from 'vue/compiler-sfc'

import type { Category } from './textCategories'
import {
  CATEGORIES,
  ELEMENT_DEFAULTS,
  RELATIVE_SIZE,
  classifyToken
} from './textCategories'

type RootNode = NonNullable<NonNullable<SFCDescriptor['template']>['ast']>
type ElementNode = Extract<RootNode['children'][number], { tag: string }>
type Prop = ElementNode['props'][number]
type Program = ReturnType<typeof babelParse>['program']
type Expression = Extract<
  Program['body'][number],
  { type: 'ExpressionStatement' }
>['expression']
type ArrayElement = NonNullable<
  Extract<Expression, { type: 'ArrayExpression' }>['elements'][number]
>
type CallArgument = Extract<
  Expression,
  { type: 'CallExpression' }
>['arguments'][number]
type ClassNode = Expression | ArrayElement | CallArgument
type ImportDeclaration = Extract<
  Program['body'][number],
  { type: 'ImportDeclaration' }
>
type ImportSpecifier = ImportDeclaration['specifiers'][number]

const UNKNOWN = '<unknown>'
const BODY = '<body>'
const ELEMENT_DEFAULT = '<element default>'

type Values = ReadonlySet<string>

interface ClassToken {
  token: string
  category: Category
  conditional: boolean
}

interface ElementClasses {
  tokens: ClassToken[]
  opaque: Set<Category>
}

interface Setter {
  values: Set<string>
  passes: boolean
}

type NodeKind =
  | 'root'
  | 'element'
  | 'component'
  | 'slot-content'
  | 'slot-outlet'
  | 'passthrough'
  | 'portal'
  | 'unknown'

interface TemplateNode {
  tag: string
  kind: NodeKind
  parent: TemplateNode | null
  component: ComponentFile
  element: ElementNode | null
  target: string | null
  slotName: string
  classes: ElementClasses
}

interface ComponentFile {
  path: string
  nodes: TemplateNode[]
  topLevel: TemplateNode[]
  fallsThrough: boolean
  usages: TemplateNode[]
}

interface Instance {
  context: (category: Category) => Values
  fallthrough: (category: Category) => Setter | null
  cache: Map<TemplateNode, Map<Category, Values>>
}

export interface Finding {
  file: string
  line: number
  tag: string
  tokens: string[]
  edit: { start: number; end: number; remove: string[] } | null
}

const CSS_PROPERTY_CATEGORIES: Partial<Record<string, readonly Category[]>> = {
  color: ['color'],
  'font-size': ['size'],
  'line-height': ['size'],
  'font-weight': ['weight'],
  'font-family': ['family'],
  font: ['size', 'weight', 'family'],
  all: CATEGORIES
}

const BUILTIN_KINDS: Partial<Record<string, NodeKind>> = {
  slot: 'slot-outlet',
  component: 'unknown',
  Teleport: 'portal',
  Transition: 'passthrough',
  TransitionGroup: 'passthrough',
  KeepAlive: 'passthrough',
  Suspense: 'passthrough'
}
const REKA_BUTTON =
  /(Trigger|Close|Cancel|Action|Increment|Decrement|ToggleGroupItem|RadioGroupItem|SwitchRoot|CheckboxRoot)$/

const TS_VUE_IMPORT = /(?:from|import\()\s*['"]([^'"]+\.vue)['"]/g
const DYNAMIC_VUE_IMPORT = /import\(\s*['"]([^'"]+\.vue)['"]/g

interface StyleSheet {
  classCategories: Map<string, Set<Category>>
  elementCategories: Map<string, Set<Category>>
  componentCategories: Map<string, Set<Category>>
}

function addAll<K>(
  map: Map<K, Set<Category>>,
  key: K,
  values: Iterable<Category>
) {
  const set = map.get(key) ?? new Set<Category>()
  for (const value of values) set.add(value)
  map.set(key, set)
}

function declarationCategories(declaration: string): readonly Category[] {
  const applied = declaration.match(/^@apply\s+(.+)$/)?.[1]
  if (applied)
    return applied
      .split(/\s+/)
      .map(classifyToken)
      .filter((category) => category !== null)
  const property = declaration.match(/^([\w-]+)\s*:/)?.[1] ?? ''
  return CSS_PROPERTY_CATEGORIES[property] ?? []
}

function cssDeclarations(css: string) {
  const declarations: { selector: string; categories: readonly Category[] }[] =
    []
  const selectors: string[] = []
  let buffer = ''
  const flush = () => {
    const categories = declarationCategories(buffer.trim())
    if (categories.length && selectors.length)
      declarations.push({ selector: selectors.join(' '), categories })
    buffer = ''
  }
  for (const char of css.replace(/\/\*[\s\S]*?\*\//g, '')) {
    if (char === '{') {
      selectors.push(buffer.trim())
      buffer = ''
    } else if (char === ';') flush()
    else if (char === '}') {
      flush()
      selectors.pop()
    } else buffer += char
  }
  return declarations
}

function subjectTag(selector: string) {
  const compound =
    selector
      .trim()
      .split(/[\s>+~]+/)
      .at(-1) ?? ''
  return compound.match(/^[a-z][a-z0-9]*/)?.[0] ?? null
}

function addStyles(sheet: StyleSheet, css: string, owner: string | null) {
  for (const { selector, categories } of cssDeclarations(css)) {
    for (const [, name] of selector.matchAll(/\.([A-Za-z_][\w-]*)/g))
      addAll(sheet.classCategories, name, categories)
    for (const part of selector.split(',')) {
      const tag = subjectTag(part.replace(/::?[\w-]+(\([^)]*\))?/g, ''))
      if (tag) addAll(sheet.elementCategories, tag, categories)
      if (owner && (tag || !part.includes('.')))
        addAll(sheet.componentCategories, owner, categories)
    }
  }
}

interface ClassLiteral {
  value: string
  conditional: boolean
}

interface ClassExtraction {
  literals: ClassLiteral[]
  opaque: boolean
}

function parseExpression(source: string): Expression | null {
  try {
    const statement = babelParse(`(${source})`, {
      plugins: ['typescript']
    }).program.body.at(0)
    return statement?.type === 'ExpressionStatement'
      ? statement.expression
      : null
  } catch {
    return null
  }
}

function templateLiteralClasses(
  node: Extract<ClassNode, { type: 'TemplateLiteral' }>,
  conditional: boolean,
  out: ClassExtraction
) {
  if (node.expressions.length) out.opaque = true
  for (const quasi of node.quasis)
    out.literals.push({ value: quasi.value.cooked ?? '', conditional })
}

function objectClasses(
  node: Extract<ClassNode, { type: 'ObjectExpression' }>,
  out: ClassExtraction
) {
  for (const property of node.properties) {
    const key =
      property.type === 'ObjectProperty' && !property.computed
        ? property.key
        : null
    if (key?.type === 'StringLiteral')
      out.literals.push({ value: key.value, conditional: true })
    else if (key?.type === 'Identifier')
      out.literals.push({ value: key.name, conditional: true })
    else out.opaque = true
  }
}

function branchClasses(node: ClassNode): ClassNode[] | null {
  if (node.type === 'ConditionalExpression')
    return [node.consequent, node.alternate]
  if (node.type !== 'LogicalExpression') return null
  return node.operator === '&&' ? [node.right] : [node.left, node.right]
}

function listClasses(node: ClassNode): ClassNode[] | null {
  if (node.type === 'ArrayExpression')
    return node.elements.filter((element) => element !== null)
  if (node.type === 'TSAsExpression') return [node.expression]
  const isCn =
    node.type === 'CallExpression' &&
    node.callee.type === 'Identifier' &&
    node.callee.name === 'cn'
  return isCn ? node.arguments : null
}

function isEmptyClass(node: ClassNode) {
  return (
    node.type === 'NullLiteral' ||
    node.type === 'BooleanLiteral' ||
    (node.type === 'Identifier' && node.name === 'undefined')
  )
}

function collectClasses(
  node: ClassNode,
  conditional: boolean,
  out: ClassExtraction
): void {
  if (node.type === 'StringLiteral') {
    out.literals.push({ value: node.value, conditional })
    return
  }
  if (node.type === 'TemplateLiteral')
    return templateLiteralClasses(node, conditional, out)
  if (node.type === 'ObjectExpression') return objectClasses(node, out)
  const branches = branchClasses(node)
  if (branches) return branches.forEach((b) => collectClasses(b, true, out))
  const list = listClasses(node)
  if (list)
    return list.forEach((item) => collectClasses(item, conditional, out))
  if (!isEmptyClass(node)) out.opaque = true
}

function boundClasses(source: string): ClassExtraction {
  const out: ClassExtraction = { literals: [], opaque: false }
  const expression = parseExpression(source)
  if (expression) collectClasses(expression, false, out)
  else out.opaque = true
  return out
}

function isDirective(prop: Prop): prop is Extract<Prop, { arg: unknown }> {
  return 'arg' in prop
}

function directiveArgument(prop: Prop) {
  if (!isDirective(prop) || !prop.arg) return null
  return 'content' in prop.arg ? prop.arg.content : null
}

function staticAttribute(element: ElementNode, name: string) {
  return element.props.find(
    (prop): prop is Exclude<Prop, { arg: unknown }> =>
      !isDirective(prop) && prop.name === name
  )
}

function boundExpression(element: ElementNode, name: string) {
  const binds = element.props.filter(
    (prop) => isDirective(prop) && prop.name === 'bind'
  )
  if (binds.some((prop) => directiveArgument(prop) === null)) return UNKNOWN
  const bind = binds.find((prop) => directiveArgument(prop) === name)
  if (!bind || !isDirective(bind)) return null
  return bind.exp && 'content' in bind.exp ? bind.exp.content : UNKNOWN
}

function inlineStyleCategories(element: ElementNode) {
  const categories = new Set<Category>()
  if (boundExpression(element, 'style') !== null)
    CATEGORIES.forEach((c) => categories.add(c))
  const style = staticAttribute(element, 'style')?.value?.content ?? ''
  for (const [property, values = []] of Object.entries(CSS_PROPERTY_CATEGORIES))
    if (new RegExp(`(^|;)\\s*${property}\\s*:`).test(style))
      values.forEach((c) => categories.add(c))
  return categories
}

function addLiteral(
  classes: ElementClasses,
  sheet: StyleSheet,
  { value, conditional }: ClassLiteral
) {
  for (const token of value.split(/\s+/).filter(Boolean)) {
    const category = classifyToken(token)
    if (category === 'size' && RELATIVE_SIZE.test(token))
      classes.opaque.add(category)
    else if (category)
      classes.tokens.push({
        token,
        category,
        conditional: conditional || token.includes(':')
      })
    else sheet.classCategories.get(token)?.forEach((c) => classes.opaque.add(c))
  }
}

function elementClasses(
  element: ElementNode,
  sheet: StyleSheet,
  componentPath: string
): ElementClasses {
  const classes: ElementClasses = {
    tokens: [],
    opaque: inlineStyleCategories(element)
  }
  sheet.componentCategories
    .get(componentPath)
    ?.forEach((c) => classes.opaque.add(c))
  const value = staticAttribute(element, 'class')?.value?.content ?? ''
  addLiteral(classes, sheet, { value, conditional: false })
  const bound = boundExpression(element, 'class')
  if (bound === null) return classes
  const extraction = bound === UNKNOWN ? null : boundClasses(bound)
  extraction?.literals.forEach((literal) => addLiteral(classes, sheet, literal))
  if (!extraction || extraction.opaque)
    CATEGORIES.forEach((c) => classes.opaque.add(c))
  return classes
}

type Resolution =
  | { kind: 'component'; file: string }
  | { kind: 'reka'; name: string }
  | { kind: 'unknown' }

interface ResolvedKind {
  kind: NodeKind
  target: string | null
  tag: string
}

function slotDirective(element: ElementNode) {
  return element.props.find((prop) => isDirective(prop) && prop.name === 'slot')
}

function slotNameOf(element: ElementNode, kind: NodeKind) {
  const slot = slotDirective(element)
  const name =
    kind === 'slot-outlet'
      ? staticAttribute(element, 'name')?.value?.content
      : slot && directiveArgument(slot)
  return name ?? 'default'
}

function rekaKind(name: string): ResolvedKind {
  if (name.endsWith('Portal'))
    return { kind: 'portal', target: null, tag: name }
  const tag = REKA_BUTTON.test(name) ? 'button' : name
  return { kind: 'element', target: null, tag }
}

function resolvedKind(
  tag: string,
  resolution: Resolution | null
): ResolvedKind {
  if (!resolution) {
    const native = /^[a-z][a-z0-9]*$/.test(tag)
    return { kind: native ? 'element' : 'unknown', target: null, tag }
  }
  if (resolution.kind === 'component')
    return { kind: 'component', target: resolution.file, tag }
  return resolution.kind === 'reka'
    ? rekaKind(resolution.name)
    : { kind: 'unknown', target: null, tag }
}

function nodeKind(
  element: ElementNode,
  resolution: Resolution | null
): ResolvedKind {
  const { tag } = element
  if (tag === 'template') {
    const kind = slotDirective(element) ? 'slot-content' : 'passthrough'
    return { kind, target: null, tag }
  }
  const builtin = BUILTIN_KINDS[tag]
  return builtin
    ? { kind: builtin, target: null, tag }
    : resolvedKind(tag, resolution)
}

function valueImports(source: string): ImportDeclaration[] {
  const program = babelParse(source, {
    sourceType: 'module',
    plugins: ['typescript']
  }).program
  return program.body.flatMap((statement) =>
    statement.type === 'ImportDeclaration' && statement.importKind !== 'type'
      ? [statement]
      : []
  )
}

function importedName(specifier: ImportSpecifier) {
  if (specifier.type === 'ImportNamespaceSpecifier') return null
  if (specifier.type === 'ImportDefaultSpecifier') return 'default'
  return specifier.imported.type === 'Identifier'
    ? specifier.imported.name
    : specifier.imported.value
}

class Project {
  readonly components = new Map<string, ComponentFile>()
  readonly sheet: StyleSheet = {
    classCategories: new Map(),
    elementCategories: new Map(),
    componentCategories: new Map()
  }
  private readonly externallyMounted = new Set<string>()
  private readonly globals = new Map<string, string>()
  private readonly contexts = new Map<string, Values>()
  private readonly generic = new Map<ComponentFile, Instance>()
  private readonly forwarding = new Set<string>()

  constructor(private readonly files: ReadonlyMap<string, string>) {
    this.readScriptsAndStyles()
    this.readGlobalComponents()
    const descriptors = new Map(
      [...files]
        .filter(([file]) => file.endsWith('.vue'))
        .map(([file, source]) => [file, parse(source).descriptor])
    )
    for (const [file, descriptor] of descriptors)
      descriptor.styles.forEach((style) =>
        addStyles(this.sheet, style.content, file)
      )
    for (const [file, descriptor] of descriptors)
      this.components.set(file, this.buildComponent(file, descriptor))
    this.linkUsages()
  }

  private readScriptsAndStyles() {
    for (const [file, source] of this.files) {
      if (file.endsWith('.css')) addStyles(this.sheet, source, null)
      if (file.endsWith('.ts')) this.markVueImports(file, source, TS_VUE_IMPORT)
    }
  }

  private readGlobalComponents() {
    const declarations = this.files.get('components.d.ts') ?? ''
    for (const [, name, file] of declarations.matchAll(
      /(\w+): typeof import\('\.\/(.+?\.vue)'\)/g
    ))
      this.globals.set(name, file)
  }

  private linkUsages() {
    const nodes = [...this.components.values()].flatMap((c) => c.nodes)
    for (const node of nodes)
      if (node.target) this.components.get(node.target)?.usages.push(node)
  }

  private markVueImports(file: string, source: string, pattern: RegExp) {
    if (/\.(test|spec|stories)\.ts$|\.d\.ts$/.test(file)) return
    for (const [, specifier] of source.matchAll(pattern)) {
      const target = this.resolveFile(specifier, file)
      if (target) this.externallyMounted.add(target)
    }
  }

  private resolveFile(specifier: string, from: string): string | null {
    const base = this.specifierBase(specifier, from)
    if (!base) return null
    return (
      [base, `${base}.ts`, `${base}/index.ts`].find((candidate) =>
        this.files.has(candidate)
      ) ?? null
    )
  }

  private specifierBase(specifier: string, from: string) {
    if (specifier.startsWith('.'))
      return path.posix.join(path.posix.dirname(from), specifier)
    if (specifier.startsWith('@/')) {
      const app = from.match(/^((?:apps|packages)\/[^/]+)\//)?.[1]
      return path.posix.join(app ? `${app}/src` : 'src', specifier.slice(2))
    }
    const [, pkg, rest] = specifier.match(/^@comfyorg\/([^/]+)\/?(.*)$/) ?? []
    return pkg ? path.posix.join('packages', pkg, 'src', rest) : null
  }

  private barrelExport(file: string, name: string, depth = 0): string | null {
    const source = this.files.get(file) ?? ''
    if (depth > 4) return null
    for (const [, list, specifier] of source.matchAll(
      /export\s*\{([^}]*)\}\s*from\s*['"](.+?)['"]/g
    )) {
      const entry = list
        .split(',')
        .map((part) => part.trim().split(/\s+as\s+/))
        .find((names) => names.at(-1) === name)
      if (!entry) continue
      const target = this.resolveFile(specifier, file)
      if (target?.endsWith('.vue') && entry[0] === 'default') return target
      if (target?.endsWith('.ts'))
        return this.barrelExport(target, entry[0], depth + 1)
    }
    return null
  }

  private importTarget(
    specifier: string,
    imported: string,
    from: string
  ): Resolution {
    if (specifier === 'reka-ui') return { kind: 'reka', name: imported }
    const target = this.resolveFile(specifier, from)
    if (target?.endsWith('.vue') && imported === 'default')
      return { kind: 'component', file: target }
    const viaBarrel = target?.endsWith('.ts')
      ? this.barrelExport(target, imported)
      : null
    return viaBarrel
      ? { kind: 'component', file: viaBarrel }
      : { kind: 'unknown' }
  }

  private scriptImports(file: string, descriptor: SFCDescriptor) {
    const imports = new Map<string, Resolution>()
    for (const block of [descriptor.script, descriptor.scriptSetup]) {
      if (!block) continue
      this.markVueImports(file, block.content, DYNAMIC_VUE_IMPORT)
      for (const statement of valueImports(block.content))
        for (const specifier of statement.specifiers) {
          const imported = importedName(specifier)
          if (imported)
            imports.set(
              specifier.local.name,
              this.importTarget(statement.source.value, imported, file)
            )
        }
    }
    return imports
  }

  private resolveTag(
    tag: string,
    imports: Map<string, Resolution>,
    file: string
  ): Resolution | null {
    const pascal = tag.replace(/(^|-)(\w)/g, (_, __, char: string) =>
      char.toUpperCase()
    )
    const imported = imports.get(tag) ?? imports.get(pascal)
    if (imported) return imported
    const global = file.startsWith('src/') ? this.globals.get(pascal) : null
    return global ? { kind: 'component', file: global } : null
  }

  private buildComponent(file: string, descriptor: SFCDescriptor) {
    const component: ComponentFile = {
      path: file,
      nodes: [],
      topLevel: [],
      fallsThrough: !/inheritAttrs\s*:\s*false/.test(
        `${descriptor.script?.content}${descriptor.scriptSetup?.content}`
      ),
      usages: []
    }
    const ast = descriptor.template?.ast
    if (!ast) return component
    const imports = this.scriptImports(file, descriptor)
    const root = this.createNode(component, null, null, 'root', null, '#root')
    const usedTags = new Set<string>()
    const build = (element: ElementNode, parent: TemplateNode) => {
      usedTags.add(element.tag)
      const resolution = this.resolveTag(element.tag, imports, file)
      const { kind, target, tag } = nodeKind(element, resolution)
      const node = this.createNode(
        component,
        parent,
        element,
        kind,
        target,
        tag
      )
      component.nodes.push(node)
      for (const child of element.children)
        if ('tag' in child) build(child, node)
    }
    for (const child of ast.children) if ('tag' in child) build(child, root)
    component.topLevel = topLevelElements(root, component.nodes)
    this.markUnusedImports(imports, usedTags)
    return component
  }

  private markUnusedImports(
    imports: Map<string, Resolution>,
    usedTags: Set<string>
  ) {
    const used = [...usedTags].map((tag) =>
      tag.replace(/(^|-)(\w)/g, (_, __, char: string) => char.toUpperCase())
    )
    for (const [local, resolution] of imports)
      if (resolution.kind === 'component' && !used.includes(local))
        this.externallyMounted.add(resolution.file)
  }

  private createNode(
    component: ComponentFile,
    parent: TemplateNode | null,
    element: ElementNode | null,
    kind: NodeKind,
    target: string | null,
    tag: string
  ): TemplateNode {
    const classes =
      element && (kind === 'element' || kind === 'component')
        ? elementClasses(element, this.sheet, component.path)
        : { tokens: [], opaque: new Set<Category>() }
    const slotName = element ? slotNameOf(element, kind) : 'default'
    return { tag, kind, parent, component, element, target, slotName, classes }
  }

  blocksInheritance(node: TemplateNode, category: Category) {
    const defaults = ELEMENT_DEFAULTS[node.tag] ?? []
    const styled = this.sheet.elementCategories.get(node.tag)
    return defaults.includes(category) || styled?.has(category) === true
  }

  genericInstance(component: ComponentFile): Instance {
    const existing = this.generic.get(component)
    if (existing) return existing
    const instance: Instance = {
      context: (category) => this.contextOf(component, category),
      fallthrough: (category) => this.genericFallthrough(component, category),
      cache: new Map()
    }
    this.generic.set(component, instance)
    return instance
  }

  private genericFallthrough(component: ComponentFile, category: Category) {
    if (!component.fallsThrough) return null
    const key = `${component.path}|${category}`
    if (this.forwarding.has(key))
      return { values: new Set([UNKNOWN]), passes: true }
    this.forwarding.add(key)
    const setters = component.usages.map((usage) =>
      forwardedSetter(usage, category, this.genericInstance(usage.component))
    )
    if (this.externallyMounted.has(component.path))
      setters.push({ values: new Set([UNKNOWN]), passes: true })
    this.forwarding.delete(key)
    if (!setters.some(Boolean)) return null
    return setters.reduce<Setter | null>(
      (merged, setter) =>
        mergeSetters(merged, setter ?? { values: new Set(), passes: true }),
      null
    )
  }

  private contextOf(component: ComponentFile, category: Category): Values {
    const key = `${component.path}|${category}`
    const known = this.contexts.get(key)
    if (known) return known
    this.contexts.set(key, new Set([UNKNOWN]))
    const values = this.computeContext(component, category)
    this.contexts.set(key, values)
    return values
  }

  private computeContext(component: ComponentFile, category: Category) {
    if (path.posix.basename(component.path) === 'App.vue')
      return new Set([BODY])
    if (!component.usages.length) return new Set([UNKNOWN])
    const values = new Set<string>()
    if (this.externallyMounted.has(component.path)) values.add(UNKNOWN)
    for (const usage of component.usages)
      for (const value of this.valueAt(
        usage.parent!,
        this.genericInstance(usage.component),
        category
      ))
        values.add(value)
    return values
  }

  valueAt(
    node: TemplateNode,
    instance: Instance,
    category: Category,
    depth = 0
  ): Values {
    const cached = instance.cache.get(node)?.get(category)
    if (cached) return cached
    const values =
      depth > 60
        ? new Set([UNKNOWN])
        : this.computeValue(node, instance, category, depth)
    const byCategory = instance.cache.get(node) ?? new Map()
    byCategory.set(category, values)
    instance.cache.set(node, byCategory)
    return values
  }

  private computeValue(
    node: TemplateNode,
    instance: Instance,
    category: Category,
    depth: number
  ): Values {
    switch (node.kind) {
      case 'root':
        return instance.context(category)
      case 'portal':
        return new Set([BODY])
      case 'unknown':
        return new Set([UNKNOWN])
      case 'component':
        return this.slotValue(node, 'default', instance, category, depth)
      case 'slot-content':
        return this.slotValue(
          node.parent!,
          node.slotName,
          instance,
          category,
          depth
        )
      case 'element':
        return this.elementValue(node, instance, category, depth)
      default:
        return this.valueAt(node.parent!, instance, category, depth + 1)
    }
  }

  private elementValue(
    node: TemplateNode,
    instance: Instance,
    category: Category,
    depth: number
  ): Values {
    const fallthrough = node.component.topLevel.includes(node)
      ? instance.fallthrough(category)
      : null
    const setter = mergeSetters(setterOf(node, category), fallthrough)
    if (setter && !setter.passes) return setter.values
    const inherited = this.blocksInheritance(node, category)
      ? new Set([ELEMENT_DEFAULT])
      : this.valueAt(node.parent!, instance, category, depth + 1)
    return setter ? new Set([...setter.values, ...inherited]) : inherited
  }

  private slotValue(
    host: TemplateNode,
    slotName: string,
    instance: Instance,
    category: Category,
    depth: number
  ): Values {
    const child = host.target ? this.components.get(host.target) : undefined
    if (host.kind !== 'component' || !child) return new Set([UNKNOWN])
    const outlets = child.nodes.filter(
      (node) => node.kind === 'slot-outlet' && node.slotName === slotName
    )
    if (!outlets.length) return new Set([UNKNOWN])
    const childInstance: Instance = {
      context: (c) => this.valueAt(host.parent!, instance, c, depth + 1),
      fallthrough: (c) =>
        child.fallsThrough ? forwardedSetter(host, c, instance) : null,
      cache: new Map()
    }
    return new Set(
      outlets.flatMap((outlet) => [
        ...this.valueAt(outlet, childInstance, category, depth + 1)
      ])
    )
  }
}

function topLevelElements(root: TemplateNode, nodes: TemplateNode[]) {
  const top: TemplateNode[] = []
  const collect = (parent: TemplateNode) =>
    nodes
      .filter((node) => node.parent === parent)
      .forEach((node) =>
        node.kind === 'passthrough' && node.tag === 'template'
          ? collect(node)
          : top.push(node)
      )
  collect(root)
  const conditional = top.every((node) =>
    node.element?.props.some(
      (prop) => isDirective(prop) && /^(if|else-if|else)$/.test(prop.name)
    )
  )
  return top.length === 1 || conditional ? top : []
}

function sizeValue(tokens: ClassToken[]) {
  return tokens
    .map(({ token }) => token)
    .sort()
    .join(' ')
}

function setterOf(node: TemplateNode, category: Category): Setter | null {
  const tokens = node.classes.tokens.filter((t) => t.category === category)
  const opaque = node.classes.opaque.has(category)
  if (!tokens.length && !opaque) return null
  const fixed = tokens.filter((t) => !t.conditional)
  const values = new Set(
    tokens.filter((t) => t.conditional).map((t) => t.token)
  )
  if (fixed.length && category === 'size') values.add(sizeValue(fixed))
  else fixed.forEach((t) => values.add(t.token))
  if (opaque) values.add(UNKNOWN)
  return { values, passes: !fixed.length }
}

function forwardedSetter(
  usage: TemplateNode,
  category: Category,
  instance: Instance
) {
  const incoming = usage.component.topLevel.includes(usage)
    ? instance.fallthrough(category)
    : null
  return mergeSetters(setterOf(usage, category), incoming)
}

function mergeSetters(a: Setter | null, b: Setter | null): Setter | null {
  if (!a || !b) return a ?? b
  return {
    values: new Set([...a.values, ...b.values]),
    passes: a.passes && b.passes
  }
}

function staticEdit(element: ElementNode, tokens: string[]) {
  const attribute = staticAttribute(element, 'class')?.value
  if (!attribute) return null
  const present = new Set(attribute.content.split(/\s+/))
  if (!tokens.every((token) => present.has(token))) return null
  return {
    start: attribute.loc.start.offset,
    end: attribute.loc.end.offset,
    remove: tokens
  }
}

function inheritableTokens(
  project: Project,
  node: TemplateNode,
  category: Category
) {
  if (project.blocksInheritance(node, category)) return []
  if (node.classes.opaque.has(category)) return []
  return node.classes.tokens.filter(
    (t) => t.category === category && !t.conditional
  )
}

function ownValue(fixed: ClassToken[], category: Category) {
  if (category === 'size') return fixed.length ? sizeValue(fixed) : null
  return fixed.length === 1 ? fixed[0].token : null
}

function redundantTokens(
  project: Project,
  node: TemplateNode,
  category: Category
): string[] {
  const fixed = inheritableTokens(project, node, category)
  const value = ownValue(fixed, category)
  if (!value) return []
  const instance = project.genericInstance(node.component)
  if (node.component.topLevel.includes(node) && instance.fallthrough(category))
    return []
  const inherited = project.valueAt(node.parent!, instance, category)
  return inherited.size === 1 && inherited.has(value)
    ? fixed.map((t) => t.token)
    : []
}

export function findInheritedClasses(
  files: ReadonlyMap<string, string>
): Finding[] {
  const project = new Project(files)
  const findings: Finding[] = []
  for (const component of project.components.values()) {
    for (const node of component.nodes) {
      if (node.kind !== 'element' || !node.element) continue
      const tokens = CATEGORIES.flatMap((category) =>
        redundantTokens(project, node, category)
      )
      if (!tokens.length) continue
      findings.push({
        file: component.path,
        line: node.element.loc.start.line,
        tag: node.tag,
        tokens,
        edit: staticEdit(node.element, tokens)
      })
    }
  }
  return findings
}

export function applyFindings(source: string, findings: Finding[]) {
  const edits = findings
    .flatMap(({ edit }) => (edit ? [edit] : []))
    .sort((a, b) => b.start - a.start)
  let result = source
  for (const { start, end, remove } of edits) {
    const kept = result
      .slice(start, end)
      .replace(/^["']|["']$/g, '')
      .split(/\s+/)
      .filter((token) => token && !remove.includes(token))
    result = kept.length
      ? `${result.slice(0, start)}"${kept.join(' ')}"${result.slice(end)}`
      : `${result.slice(0, start).replace(/\s+class=$/, '')}${result.slice(end)}`
  }
  return result
}
