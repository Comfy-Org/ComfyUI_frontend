/**
 * Keys managed elsewhere in the app (model info, outputs, imports) or treated
 * as system-owned. Shown read-only in the Custom Metadata accordion; cannot
 * be added as new custom primitive keys.
 */
const RESERVED_USER_METADATA_KEYS = new Set<string>([
  'name',
  'base_model',
  'additional_tags',
  'user_description',
  'filename',
  'trained_words',
  'source_arn',
  'description',
  'jobId',
  'nodeId',
  'subfolder',
  'outputCount',
  'allOutputs',
  'executionTimeInSeconds',
  'workflow',
  'format',
  'duration',
  'create_time',
  'source_url'
])

export function isReservedUserMetadataKey(key: string): boolean {
  return RESERVED_USER_METADATA_KEYS.has(key)
}
