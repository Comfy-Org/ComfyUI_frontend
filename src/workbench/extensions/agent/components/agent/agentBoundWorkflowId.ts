import type { InjectionKey, Ref } from 'vue'

export const agentBoundWorkflowIdKey: InjectionKey<
  Readonly<Ref<string | undefined>>
> = Symbol('agentBoundWorkflowId')
