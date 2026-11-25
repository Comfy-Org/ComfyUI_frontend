/**
 * Consumer-facing seam for the app singleton. Kept separate from
 * `appRegistry` so tests can mock it without re-entering `@/scripts/app`
 * (see vitest.setup.ts).
 */
export { useApp } from '@/scripts/appRegistry'
