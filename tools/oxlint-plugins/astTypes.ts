import type { RuleTester } from 'oxlint/plugins-dev'

/** An oxlint JS plugin rule. */
export type Rule = Parameters<RuleTester['run']>[1]

type Visitor = ReturnType<Extract<Rule, { create: unknown }>['create']>

/** The ESTree node an oxlint visitor receives for the given node type. */
export type NodeOf<K extends keyof Visitor> = Parameters<
  NonNullable<Visitor[K]>
>[0]

/** Any ESTree node oxlint can hand to a visitor. */
export type AnyNode = NodeOf<'ThrowStatement'>['parent']
