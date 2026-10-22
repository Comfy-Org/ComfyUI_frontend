import type { Rule } from 'eslint'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import type { AST } from 'vue-eslint-parser'

import {
  FOR_STORIES,
  buttonVariants
} from '@comfyorg/design-system/button.variants'
import type { ButtonVariants } from '@comfyorg/design-system/button.variants'
import { cn } from '@comfyorg/tailwind-utils'

import type { Category } from '@comfyorg/design-system-audits/textCategories'
import {
  CATEGORIES,
  ELEMENT_DEFAULTS,
  RELATIVE_SIZE,
  classifyToken
} from '@comfyorg/design-system-audits/textCategories'

type VElement = AST.VElement
type VAttribute = AST.VAttribute

interface TemplateParserServices {
  defineTemplateBodyVisitor(visitor: {
    VElement: (node: VElement) => void
  }): Rule.RuleListener
}

const repoRoot = path.resolve(import.meta.dirname, '../..')

function templateVisitor(
  context: Rule.RuleContext,
  visit: (node: VElement) => void
): Rule.RuleListener {
  const services = context.sourceCode.parserServices as
    | Partial<TemplateParserServices>
    | undefined
  if (!services?.defineTemplateBodyVisitor) return {}
  return services.defineTemplateBodyVisitor({ VElement: visit })
}

const DYNAMIC_ELEMENTS = new Set([
  'component',
  'teleport',
  'suspense',
  'slot',
  'template'
])

function isNativeElement(node: VElement) {
  return (
    /^[a-z][a-z0-9]*$/.test(node.rawName) && !DYNAMIC_ELEMENTS.has(node.rawName)
  )
}

function staticClassAttribute(node: VElement): VAttribute | undefined {
  return node.startTag.attributes.find(
    (attribute): attribute is VAttribute =>
      !attribute.directive &&
      attribute.key.name === 'class' &&
      attribute.value !== null
  )
}

function hasBoundAttribute(node: VElement, name: string) {
  return node.startTag.attributes.some(
    (attribute) =>
      attribute.directive &&
      attribute.key.name.name === 'bind' &&
      (attribute.key.argument?.type !== 'VIdentifier' ||
        attribute.key.argument.name === name)
  )
}

function hasBoundClass(node: VElement) {
  return hasBoundAttribute(node, 'class')
}

function setsInlineStyle(node: VElement) {
  return (
    hasBoundAttribute(node, 'style') ||
    node.startTag.attributes.some(
      (attribute) => !attribute.directive && attribute.key.name === 'style'
    )
  )
}

function hasStyleBlock(context: Rule.RuleContext) {
  return /<style[\s>]/.test(context.sourceCode.text)
}

function classTokens(attribute: VAttribute) {
  return (attribute.value?.value ?? '').split(/\s+/).filter(Boolean)
}

function removeTokensFix(
  context: Rule.RuleContext,
  attribute: VAttribute,
  remove: ReadonlySet<string>
) {
  return (fixer: Rule.RuleFixer) => {
    const value = attribute.value
    if (!value) return null
    const raw = context.sourceCode.text.slice(...value.range)
    const quote = /^["']/.test(raw) ? raw[0] : ''
    const rawTokens = raw
      .slice(quote.length, raw.length - quote.length)
      .split(/\s+/)
      .filter(Boolean)
    const tokens = classTokens(attribute)
    if (rawTokens.length !== tokens.length) return null
    const kept = rawTokens.filter((_, index) => !remove.has(tokens[index]))
    return kept.length
      ? fixer.replaceTextRange(value.range, quote + kept.join(' ') + quote)
      : fixer.removeRange([attribute.range[0] - 1, attribute.range[1]])
  }
}

const MARGIN_ELEMENTS = new Set([
  'dialog',
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'menu',
  'dl',
  'dd',
  'figure',
  'blockquote',
  'pre',
  'hr',
  'fieldset',
  'form',
  'button',
  'input',
  'select',
  'textarea'
])
const PADDED_ELEMENTS = new Set([
  'dialog',
  'option',
  'ul',
  'ol',
  'menu',
  'button',
  'input',
  'select',
  'textarea',
  'fieldset',
  'td',
  'th',
  'legend'
])
const BORDERED_ELEMENTS = new Set([
  'dialog',
  'button',
  'input',
  'select',
  'textarea',
  'fieldset',
  'iframe',
  'table',
  'img',
  'hr'
])
const BACKGROUND_ELEMENTS = new Set([
  'dialog',
  'button',
  'input',
  'select',
  'textarea',
  'mark',
  'option'
])
const BORDER_WIDTH = /^border(-[trblxy])?(-\d+|-\[[^\]]+\])?$/
const ANY_BORDER_WIDTH =
  /(^|:)border(-[trblxy])?(-\d+|-\[[^\]]+\]|-\([^)]+\))?$/
const BORDER_STYLE = /(^|:)border-(solid|dashed|dotted|double|hidden)$/

function setsBorder(token: string, tokens: readonly string[]) {
  return tokens.some(
    (other) =>
      other !== token &&
      (ANY_BORDER_WIDTH.test(other) || BORDER_STYLE.test(other))
  )
}

function usesGrid(tokens: readonly string[]) {
  return tokens.some((token) => /(^|:)(inline-)?grid$/.test(token))
}

function hasToken(tokens: readonly string[], pattern: RegExp) {
  return tokens.some((token) => pattern.test(token))
}

const TRANSPARENT_COMPONENTS = new Set([
  'template',
  'Transition',
  'TransitionGroup',
  'transition',
  'transition-group'
])

function isTransparent(element: VElement) {
  return (
    TRANSPARENT_COMPONENTS.has(element.rawName) &&
    staticAttributeValue(element, 'tag') === undefined &&
    !hasBoundAttribute(element, 'tag')
  )
}

function domParent(node: VElement) {
  let parent = node.parent
  while (parent.type === 'VElement' && isTransparent(parent))
    parent = parent.parent
  return parent.type === 'VElement' && isNativeElement(parent) ? parent : null
}

const SPACING_PARENT = /(^|:)-?space-[xy]-/
const DIVIDER_PARENT = /(^|:)divide-/

function parentStylesChildren(node: VElement, pattern: RegExp) {
  const parent = domParent(node)
  if (!parent || hasBoundClass(parent)) return true
  const attribute = staticClassAttribute(parent)
  return attribute ? hasToken(classTokens(attribute), pattern) : false
}

const DEFAULT_UTILITIES: Record<
  string,
  (node: VElement, tokens: readonly string[]) => boolean
> = {
  'flex-row': (_, tokens) => !hasToken(tokens, /(^|:)flex-col(-reverse)?$/),
  'items-stretch': (_, tokens) =>
    !usesGrid(tokens) && !hasToken(tokens, /(^|:)place-items-/),
  'justify-start': (_, tokens) =>
    !usesGrid(tokens) && !hasToken(tokens, /(^|:)place-content-/),
  shrink: () => true,
  'box-border': () => true,
  'border-solid': (node, tokens) =>
    hasToken(tokens, BORDER_WIDTH) &&
    !parentStylesChildren(node, DIVIDER_PARENT),
  'm-0': (node) =>
    !MARGIN_ELEMENTS.has(node.rawName) &&
    !parentStylesChildren(node, SPACING_PARENT),
  'p-0': (node) => !PADDED_ELEMENTS.has(node.rawName),
  'bg-transparent': (node) => !BACKGROUND_ELEMENTS.has(node.rawName),
  'border-none': (node, tokens) =>
    !BORDERED_ELEMENTS.has(node.rawName) &&
    !setsBorder('border-none', tokens) &&
    !parentStylesChildren(node, DIVIDER_PARENT),
  'border-0': (node, tokens) =>
    !BORDERED_ELEMENTS.has(node.rawName) &&
    !setsBorder('border-0', tokens) &&
    !parentStylesChildren(node, DIVIDER_PARENT),
  'w-auto': (node) => ['div', 'span', 'p', 'section'].includes(node.rawName)
}

function conflictsWithAnother(token: string, tokens: readonly string[]) {
  return tokens.some(
    (other) =>
      other !== token &&
      !other.includes(':') &&
      (cn(other, token).split(' ').length < 2 ||
        cn(token, other).split(' ').length < 2)
  )
}

const noDefaultUtilities: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    fixable: 'code',
    docs: {
      description:
        'Disallow utilities on native elements that restate the browser or base-layer default'
    },
    messages: {
      redundant:
        '`{{token}}` restates the default for <{{element}}>; remove it.'
    },
    schema: []
  },
  create(context) {
    if (hasStyleBlock(context)) return {}
    return templateVisitor(context, (node) => {
      if (
        !isNativeElement(node) ||
        hasBoundClass(node) ||
        setsInlineStyle(node)
      )
        return
      const attribute = staticClassAttribute(node)
      if (!attribute) return
      const tokens = classTokens(attribute)
      if (!hasOnlyUtilities(tokens)) return
      const redundant = tokens.filter(
        (token) =>
          DEFAULT_UTILITIES[token]?.(node, tokens) &&
          !conflictsWithAnother(token, tokens)
      )
      for (const token of redundant) {
        context.report({
          node: attribute,
          messageId: 'redundant',
          data: { token, element: node.rawName },
          fix: removeTokensFix(context, attribute, new Set(redundant))
        })
      }
    })
  }
}

const componentDefaultsCache = new Map<string, string | null>()

const appSourceRoot = path.join(repoRoot, 'src')

function uiComponentFile(source: string, importer: string) {
  if (!importer.startsWith(appSourceRoot + path.sep)) return null
  const match = source.match(/^@\/(components\/ui\/.+\.vue)$/)
  return match ? path.join(appSourceRoot, match[1]) : null
}

const QUOTED = /'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g

function blankQuotedText(source: string) {
  return source.replace(QUOTED, (quoted) => ' '.repeat(quoted.length))
}

function callArguments(source: string, masked: string, open: number) {
  const cuts = [open]
  let depth = 0
  for (let index = open; index < masked.length; index++) {
    const char = masked[index]
    if ('([{'.includes(char)) depth++
    if (')]}'.includes(char)) depth--
    if (depth === 1 && char === ',') cuts.push(index)
    if (depth === 0) {
      cuts.push(index)
      return cuts
        .slice(1)
        .map((end, at) => source.slice(cuts[at] + 1, end).trim())
        .filter(Boolean)
    }
  }
  return []
}

const CN_CALL = /\bcn\(/g
const CLASS_PROP = /^(className|customClass|props\.class|\$?attrs\.class)$/
const STRING_LITERAL = /^'([^'\\]*)'$/

function mergedDefaults(args: readonly string[]) {
  if (!CLASS_PROP.test(args.at(-1) ?? '')) return null
  const literals = args.slice(0, -1).map((arg) => STRING_LITERAL.exec(arg)?.[1])
  if (!literals.length || literals.includes(undefined)) return null
  return literals.join(' ')
}

function componentDefaultClasses(file: string) {
  const cached = componentDefaultsCache.get(file)
  if (cached !== undefined) return cached
  const source = existsSync(file) ? readFileSync(file, 'utf8') : ''
  const masked = blankQuotedText(source)
  const callStarts = [...masked.matchAll(CN_CALL)]
  const calls =
    callStarts.length === [...source.matchAll(CN_CALL)].length
      ? callStarts.map((match) =>
          callArguments(source, masked, match.index + 2)
        )
      : []
  const classMerges = calls.filter((args) => CLASS_PROP.test(args.at(-1) ?? ''))
  const base = classMerges.length === 1 ? mergedDefaults(classMerges[0]) : null
  componentDefaultsCache.set(file, base)
  return base
}

function staticAttributeValue(node: VElement, name: string) {
  const attribute = node.startTag.attributes.find(
    (candidate): candidate is VAttribute =>
      !candidate.directive && candidate.key.name === name
  )
  return attribute?.value?.value
}

const buttonVariantNames: readonly string[] = FOR_STORIES.variants
const buttonSizeNames: readonly string[] = FOR_STORIES.sizes

function isButtonVariant(
  value: string | undefined
): value is ButtonVariants['variant'] {
  return value === undefined || buttonVariantNames.includes(value)
}

function isButtonSize(
  value: string | undefined
): value is ButtonVariants['size'] {
  return value === undefined || buttonSizeNames.includes(value)
}

function buttonDefaultClasses(node: VElement) {
  if (hasBoundAttribute(node, 'variant') || hasBoundAttribute(node, 'size'))
    return null
  const variant = staticAttributeValue(node, 'variant')
  const size = staticAttributeValue(node, 'size')
  if (!isButtonVariant(variant) || !isButtonSize(size)) return null
  return buttonVariants({ variant, size })
}

function importedUiComponents(context: Rule.RuleContext) {
  const imports = new Map<string, string>()
  for (const statement of context.sourceCode.ast.body) {
    if (statement.type !== 'ImportDeclaration') continue
    const source = String(statement.source.value)
    const file = uiComponentFile(source, context.filename)
    if (!file) continue
    for (const specifier of statement.specifiers) {
      if (specifier.type === 'ImportDefaultSpecifier')
        imports.set(specifier.local.name, file)
    }
  }
  return imports
}

function sortedClassSet(classes: string) {
  return [...new Set(classes.split(/\s+/).filter(Boolean))].sort().join(' ')
}

const noRedundantComponentClasses: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    fixable: 'code',
    docs: {
      description:
        "Disallow classes that a UI component's own default classes already apply"
    },
    messages: {
      redundant: '`{{token}}` is already applied by <{{component}}>; remove it.'
    },
    schema: []
  },
  create(context) {
    const components = importedUiComponents(context)
    if (!components.size) return {}
    return templateVisitor(context, (node) => {
      const file = components.get(node.rawName)
      if (!file) return
      const attribute = staticClassAttribute(node)
      if (!attribute) return
      const defaults =
        path.basename(file) === 'Button.vue'
          ? buttonDefaultClasses(node)
          : componentDefaultClasses(file)
      if (!defaults) return
      const tokens = classTokens(attribute)
      const merged = sortedClassSet(cn(defaults, tokens.join(' ')))
      const redundant = new Set<string>()
      let kept = tokens
      for (const token of tokens) {
        const without = kept.filter((other) => other !== token)
        if (sortedClassSet(cn(defaults, without.join(' '))) !== merged) continue
        redundant.add(token)
        kept = without
      }
      for (const token of redundant) {
        context.report({
          node: attribute,
          messageId: 'redundant',
          data: { token, component: node.rawName },
          fix: removeTokensFix(context, attribute, redundant)
        })
      }
    })
  }
}

const UTILITY_PREFIX =
  /^-?(flex|grid|inline|block|hidden|contents|table|gap|space|p[trblxyse]?|m[trblxyse]?|w|h|size|min|max|rounded|border|bg|text|font|leading|tracking|items|justify|self|place|content|order|col|row|basis|grow|shrink|overflow|truncate|whitespace|break|wrap|relative|absolute|fixed|sticky|static|inset|top|right|bottom|left|start|end|z|opacity|shadow|ring|outline|cursor|pointer|select|transition|duration|ease|delay|animate|transform|translate|rotate|scale|skew|origin|object|aspect|line-clamp|list|underline|decoration|uppercase|lowercase|capitalize|normal-case|italic|not-italic|align|sr-only|not-sr-only|isolate|visible|invisible|collapse|backdrop|blur|filter|fill|stroke|touch|scroll|snap|resize|appearance|will-change|contain|tabular-nums|scrollbar|icon|group|peer|@container|box|float|clear|columns|divide|accent|caret|mix-blend|drop-shadow|hyphens|indent|vertical)(-|$)/

function hasOnlyUtilities(tokens: readonly string[]) {
  return tokens.every((token) =>
    UTILITY_PREFIX.test(
      token.slice(token.lastIndexOf(':') + 1).replace(/^!|!$/g, '')
    )
  )
}

function isUnconditional(token: string) {
  return !token.includes(':')
}

function categoryTokens(tokens: readonly string[], category: Category) {
  return tokens.filter((token) => classifyToken(token) === category)
}

function resetsCategory(element: string, category: Category) {
  return ELEMENT_DEFAULTS[element]?.includes(category) ?? false
}

function isRelative(token: string) {
  return RELATIVE_SIZE.test(token)
}

function categoryValue(tokens: readonly string[]) {
  return tokens.length ? [...tokens].sort().join(' ') : null
}

function ancestorValue(ancestor: VElement, category: Category) {
  if (hasBoundClass(ancestor) || setsInlineStyle(ancestor)) return null
  const attribute = staticClassAttribute(ancestor)
  const tokens = attribute ? classTokens(attribute) : []
  if (!hasOnlyUtilities(tokens)) return null
  const own = categoryTokens(tokens, category)
  if (own.some((token) => !isUnconditional(token) || isRelative(token)))
    return null
  const value = categoryValue(own)
  if (value) return value
  return resetsCategory(ancestor.rawName, category) ? null : undefined
}

function inheritedValue(node: VElement, category: Category) {
  for (
    let ancestor = node.parent;
    ancestor.type === 'VElement';
    ancestor = ancestor.parent
  ) {
    if (isTransparent(ancestor)) continue
    if (!isNativeElement(ancestor)) return null
    const value = ancestorValue(ancestor, category)
    if (value !== undefined) return value
  }
  return null
}

function removableValue(tokens: readonly string[]) {
  const own = tokens.filter(isUnconditional)
  if (own.some((token) => token.includes('!') || isRelative(token))) return null
  return categoryValue(own)
}

function inheritedTokens(node: VElement, tokens: readonly string[]) {
  const redundant = CATEGORIES.filter((category) => {
    if (resetsCategory(node.rawName, category)) return false
    const own = removableValue(categoryTokens(tokens, category))
    return own !== null && own === inheritedValue(node, category)
  })
  return new Set(
    tokens.filter((token) => {
      const category = classifyToken(token)
      return (
        isUnconditional(token) &&
        category !== null &&
        redundant.includes(category)
      )
    })
  )
}

const noInheritedUtilities: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    fixable: 'code',
    docs: {
      description:
        'Disallow text color, size, weight and family utilities that repeat the value a native ancestor in the same template already sets'
    },
    messages: {
      redundant:
        '`{{token}}` repeats the value <{{element}}> already inherits; remove it.'
    },
    schema: []
  },
  create(context) {
    if (hasStyleBlock(context)) return {}
    return templateVisitor(context, (node) => {
      if (
        !isNativeElement(node) ||
        hasBoundClass(node) ||
        setsInlineStyle(node)
      )
        return
      const attribute = staticClassAttribute(node)
      if (!attribute) return
      const tokens = classTokens(attribute)
      if (!hasOnlyUtilities(tokens)) return
      const redundant = inheritedTokens(node, tokens)
      for (const token of redundant) {
        context.report({
          node: attribute,
          messageId: 'redundant',
          data: { token, element: node.rawName },
          fix: removeTokensFix(context, attribute, redundant)
        })
      }
    })
  }
}

export default {
  meta: { name: 'template-classes' },
  rules: {
    'no-default-utilities': noDefaultUtilities,
    'no-redundant-component-classes': noRedundantComponentClasses,
    'no-inherited-utilities': noInheritedUtilities
  }
}
