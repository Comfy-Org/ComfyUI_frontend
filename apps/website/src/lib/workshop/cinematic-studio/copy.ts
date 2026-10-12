import type { TranslationKey } from '@/i18n/translations'

export type CinematicCopyKey = Extract<TranslationKey, `cinematic.${string}`>
export type ReshootCopyKey = Extract<TranslationKey, `reshoot.${string}`>
