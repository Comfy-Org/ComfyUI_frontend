import type { InjectionKey, Ref } from 'vue'

// Shares the root open-state with the content so it can lift its z-index above
// a dialog that joined the incrementing modal counter (otherwise the
// body-portaled content renders behind the settings dialog).
export const hoverCardOpenKey: InjectionKey<Ref<boolean>> =
  Symbol('hoverCardOpen')
