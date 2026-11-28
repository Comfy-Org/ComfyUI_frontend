import type { InjectionKey, Ref } from 'vue'

export const agentBoundWorkflowIdKey: InjectionKey<
  Readonly<Ref<string | undefined>>
> = Symbol('agentBoundWorkflowId')

/** True while the bound workflow is the one on canvas. */
export const agentBoundWorkflowActiveKey: InjectionKey<Readonly<Ref<boolean>>> =
  Symbol('agentBoundWorkflowActive')
