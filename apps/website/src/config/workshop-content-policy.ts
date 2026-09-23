const POLICY_CODES = new Set([
  'content_filter',
  'content_moderation',
  'content_policy_violation',
  'datainspectionfailed',
  'image_content_policy_violation',
  'moderation_blocked'
])

const POLICY_REASONS = new Set([
  'blocklist',
  'image_prohibited_content',
  'image_safety',
  'jailbreak',
  'model_armor',
  'prohibited_content',
  'recitation',
  'safety'
])

const POLICY_STATUSES = new Set([
  'content moderated',
  'nsfw',
  'request moderated'
])

const POLICY_PHRASES = [
  'blocked by content policy',
  'blocked due to safety',
  'content policy violation',
  'did not pass content moderation',
  'flagged by the content moderation',
  'failure to pass the risk control system',
  'may contain inappropriate content',
  'nsfw content detected',
  'rejected by the safety system',
  'rejected by risk control',
  'violates our content policy',
  'violates the content policy'
]

const POLICY_TEXT_FIELDS = new Set([
  'error',
  'errormessage',
  'failure',
  'rawresponse',
  'statusmessage',
  'taskstatusmessage',
  'taskstatusmsg'
])

const POLICY_CODE_FIELDS = new Set([
  'code',
  'errorcode',
  'errortype',
  'failurecode',
  'finishreason',
  'statuscode'
])

const NESTED_PAYLOAD_FIELDS = new Set([
  'body',
  'detail',
  'error',
  'failure',
  'rawresponse'
])

const MAX_POLICY_NODES = 2048
const RUNWAY_POLICY_CODE =
  /^(?:input_preprocessing\.safety|safety\.(?:input|output))\.(?:audio|image|multimodal|text|video)$/

interface PolicyNode {
  readonly key: string
  readonly value: unknown
}

function normalizedKey(key: string): string {
  return key.toLowerCase().replaceAll(/[^a-z]/g, '')
}

function codeSignalsPolicy(value: string, field: string): boolean {
  if (!POLICY_CODE_FIELDS.has(field)) return false
  return POLICY_CODES.has(value) || RUNWAY_POLICY_CODE.test(value)
}

function phraseSignalsPolicy(value: string, field: string): boolean {
  if (!POLICY_TEXT_FIELDS.has(field)) return false
  return POLICY_PHRASES.some((phrase) => value.includes(phrase))
}

function geminiBlockSignalsPolicy(value: string, field: string): boolean {
  if (field !== 'blockreason') return false
  return POLICY_REASONS.has(value)
}

function stringSignalsPolicy(value: string, key = ''): boolean {
  const normalized = value.trim().toLowerCase()
  const field = normalizedKey(key)
  if (codeSignalsPolicy(normalized, field)) return true
  if (phraseSignalsPolicy(normalized, field)) return true
  if (geminiBlockSignalsPolicy(normalized, field)) return true
  if (field === 'status' && POLICY_STATUSES.has(normalized)) return true
  if (!POLICY_CODE_FIELDS.has(field)) return false
  return POLICY_REASONS.has(normalized)
}

function nestedPayload(value: string, key: string): unknown | undefined {
  if (!NESTED_PAYLOAD_FIELDS.has(normalizedKey(key))) return
  try {
    return JSON.parse(value) as unknown
  } catch {
    return
  }
}

function appendArrayNodes(
  pending: PolicyNode[],
  values: readonly unknown[],
  key: string
): void {
  for (const value of values) {
    if (pending.length >= MAX_POLICY_NODES) return
    pending.push({ key, value })
  }
}

function appendObjectNodes(pending: PolicyNode[], value: object): void {
  for (const [key, child] of Object.entries(value)) {
    if (pending.length >= MAX_POLICY_NODES) return
    pending.push({ key, value: child })
  }
}

function appendPolicyNodes(pending: PolicyNode[], current: PolicyNode): void {
  if (typeof current.value === 'string') {
    const nested = nestedPayload(current.value, current.key)
    if (nested !== undefined && pending.length < MAX_POLICY_NODES)
      pending.push({ key: '', value: nested })
    return
  }
  if (current.value === null || typeof current.value !== 'object') return
  if (Array.isArray(current.value)) {
    appendArrayNodes(pending, current.value, current.key)
    return
  }
  appendObjectNodes(pending, current.value)
}

export function workshopContentPolicyPayload(payload: unknown): boolean {
  const pending: PolicyNode[] = [{ key: '', value: payload }]
  for (let index = 0; index < pending.length; index += 1) {
    const current = pending[index]
    if (
      typeof current.value === 'string' &&
      stringSignalsPolicy(current.value, current.key)
    )
      return true
    appendPolicyNodes(pending, current)
  }
  return false
}

export function workshopContentPolicyBody(body: string): boolean {
  if (!body.trim()) return false
  try {
    const parsed: unknown = JSON.parse(body)
    return workshopContentPolicyPayload(parsed)
  } catch {
    return false
  }
}
