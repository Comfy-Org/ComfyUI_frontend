import { isPlainObject } from 'es-toolkit'

import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import { callListener } from '@/platform/nodeApi/shared/listeners'
import type { NodeDef } from '@/platform/nodeApi/v4/types'

/** A node type a selector is asked about. Its definition is built only if a test needs it. */
export interface SelectorCandidate {
  readonly type: string
  readonly category: string
  def(): NodeDef
}

export type TypeSelection = (candidate: SelectorCandidate) => boolean

const SELECTOR_NEEDED =
  'a type name, a list of names, a RegExp, { category } or a function'

/** Refuses a selector an untyped caller got wrong, before anything is registered. */
export function checkedSelector(selector: unknown): TypeSelection {
  if (typeof selector === 'string') return ({ type }) => type === selector
  if (selector instanceof RegExp) {
    const pattern = statelessCopy(selector)
    return ({ type }) => pattern.test(type)
  }
  if (Array.isArray(selector)) return nameListSelection(selector)
  if (typeof selector === 'function') {
    return (candidate) =>
      callListener('extend selector', () => selector(candidate.def())) === true
  }
  if (isPlainObject(selector)) return categorySelection(selector)
  throw invalidArgument('extend', SELECTOR_NEEDED, selector)
}

function nameListSelection(names: readonly unknown[]): TypeSelection {
  const unusable = names.findIndex((name) => typeof name !== 'string')
  if (unusable !== -1) {
    throw invalidArgument('extend', 'a type name', names[unusable])
  }
  const types = new Set<unknown>(names)
  return ({ type }) => types.has(type)
}

function categorySelection(selector: object): TypeSelection {
  const fields = Object.keys(selector)
  if (fields.length !== 1 || fields[0] !== 'category') {
    throw invalidArgument('extend', SELECTOR_NEEDED, selector)
  }
  const category: unknown = Reflect.get(selector, 'category')
  if (typeof category === 'string') {
    return (candidate) => candidate.category === category
  }
  if (category instanceof RegExp) {
    const pattern = statelessCopy(category)
    return (candidate) => pattern.test(candidate.category)
  }
  throw invalidArgument('extend', 'a category name or RegExp', category)
}

function statelessCopy(pattern: RegExp): RegExp {
  return new RegExp(pattern.source, pattern.flags.replace(/[gy]/g, ''))
}
