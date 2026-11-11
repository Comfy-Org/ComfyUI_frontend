import type { InjectionKey, Ref } from 'vue'

export const agentRunCardsKey: InjectionKey<Readonly<Ref<boolean>>> =
  Symbol('agentRunCards')
