import type { InjectionKey, Ref } from 'vue'

/** True while the published model page waits on the Hub page choice. */
export const LIVE_PAGE_HELD: InjectionKey<Readonly<Ref<boolean>>> =
  Symbol('live-page-held')
