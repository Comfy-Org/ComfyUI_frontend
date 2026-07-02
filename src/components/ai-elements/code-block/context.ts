import type { ComputedRef, InjectionKey } from 'vue'

export interface CodeBlockContext {
  code: ComputedRef<string>
}

export const CodeBlockKey: InjectionKey<CodeBlockContext> = Symbol('CodeBlock')
