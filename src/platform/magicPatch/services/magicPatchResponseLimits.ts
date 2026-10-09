export const magicPatchResponseLimits = {
  version: 'magic-patch-client-response-limits/2',
  jsonBytes: 1024 * 1024,
  reportBytes: 8 * 1024 * 1024,
  streamReads: 16384,
  bodyMilliseconds: 10000
} as const
