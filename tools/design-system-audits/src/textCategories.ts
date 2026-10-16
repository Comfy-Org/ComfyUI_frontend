export type Category = 'color' | 'size' | 'weight' | 'family'
export const CATEGORIES: readonly Category[] = [
  'color',
  'size',
  'weight',
  'family'
]

const TEXT_SIZE = /^([2-9]?xl|[23]?xs|sm|base|lg)(\/|$)/
const NON_COLOR_TEXT =
  /^(left|center|right|justify|start|end|wrap|nowrap|balance|pretty|ellipsis|clip|shadow.*)$/
const FONT_WEIGHTS =
  /^(thin|extralight|light|normal|medium|semibold|bold|extrabold|black|\[\d+\])$/
export const RELATIVE_SIZE =
  /\d(?:(?:em|ex|ch|lh|cap|ic)\b|%)|\b(?:smaller|larger)\b/
const NON_FAMILY_FONT = /^(stretch|features|variant|numeric)/

function sizeLike(value: string) {
  return TEXT_SIZE.test(value) || /^[[(](length:|\d|calc|clamp)/.test(value)
}

function textCategory(value: string): Category | null {
  if (sizeLike(value)) return 'size'
  return NON_COLOR_TEXT.test(value) ? null : 'color'
}

function fontCategory(value: string): Category | null {
  if (FONT_WEIGHTS.test(value)) return 'weight'
  return NON_FAMILY_FONT.test(value) ? null : 'family'
}

export function classifyToken(token: string): Category | null {
  const utility = token.slice(token.lastIndexOf(':') + 1).replace(/^!|!$/g, '')
  if (utility.startsWith('leading-')) return 'size'
  const [, prefix, value] = utility.match(/^(text|font)-(.+)$/) ?? []
  if (prefix === 'text') return textCategory(value)
  return prefix === 'font' ? fontCategory(value) : null
}

export const ELEMENT_DEFAULTS: Partial<Record<string, readonly Category[]>> = {
  button: CATEGORIES,
  input: CATEGORIES,
  select: CATEGORIES,
  textarea: CATEGORIES,
  a: ['color'],
  mark: ['color'],
  h1: ['size', 'weight'],
  h2: ['size', 'weight'],
  h3: ['size', 'weight'],
  h4: ['size', 'weight'],
  h5: ['size', 'weight'],
  h6: ['size', 'weight'],
  b: ['weight'],
  strong: ['weight'],
  th: ['weight'],
  small: ['size'],
  sub: ['size'],
  sup: ['size'],
  code: ['size', 'family'],
  kbd: ['size', 'family'],
  pre: ['size', 'family'],
  samp: ['size', 'family']
}
