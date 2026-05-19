import type { InjectionKey, Ref } from 'vue'
import { inject, provide } from 'vue'

const starRatingHostKey: InjectionKey<Ref<HTMLElement | undefined>> =
  Symbol('starRatingHost')

export function provideStarRatingHost(hostRef: Ref<HTMLElement | undefined>) {
  provide(starRatingHostKey, hostRef)
}

export function useStarRatingHost() {
  return inject(starRatingHostKey, undefined)
}
