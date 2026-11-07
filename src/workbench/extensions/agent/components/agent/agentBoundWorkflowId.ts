import type { InjectionKey, Ref } from 'vue'

export const agentBoundWorkflowIdKey: InjectionKey<
  Readonly<Ref<string | undefined>>
> = Symbol('agentBoundWorkflowId')

/**
 * Whether the bound workflow is the one on canvas. Anything that reads live
 * graph state for the bound workflow — widget values, link connections — is
 * only reading the right workflow while this holds.
 */
export const agentBoundWorkflowActiveKey: InjectionKey<Readonly<Ref<boolean>>> =
  Symbol('agentBoundWorkflowActive')
