const POLICY_CODES = new Set([
  'content_filter',
  'content_moderation',
  'content_policy_violation',
  'datainspectionfailed',
  'image_content_policy_violation',
  'moderation_blocked'
])

const POLICY_CODE_FRAGMENTS = [
  'content_filter',
  'content_moderation',
  'content_policy_violation',
  'datainspectionfailed',
  'image_content_policy_violation',
  'moderation_blocked',
  'safety.input.',
  'safety.output.'
]

const POLICY_REASONS = new Set([
  'blocklist',
  'image_prohibited_content',
  'image_safety',
  'prohibited_content',
  'recitation',
  'safety'
])

const POLICY_PHRASES = [
  'blocked by content policy',
  'blocked due to safety',
  'content policy violation',
  'did not pass content moderation',
  'flagged by the content moderation',
  'may contain inappropriate content',
  'nsfw content detected',
  'rejected by the safety system',
  'rejected by risk control',
  'violates our content policy',
  'violates the content policy'
]

const POLICY_TEXT_FIELDS = new Set([
  'body',
  'detail',
  'error',
  'errormessage',
  'failure',
  'message',
  'rawresponse',
  'reason',
  'statusmessage',
  'taskstatusmessage'
])

const POLICY_CODE_FIELDS = new Set([
  'code',
  'errorcode',
  'errortype',
  'failurecode',
  'finishreason',
  'statuscode'
])

function normalizedKey(key: string): string {
  return key.toLowerCase().replaceAll(/[^a-z]/g, '')
}

function isPolicySignalField(field: string): boolean {
  if (!field) return true
  if (POLICY_TEXT_FIELDS.has(field)) return true
  return POLICY_CODE_FIELDS.has(field)
}

function codeSignalsPolicy(value: string, field: string): boolean {
  if (!isPolicySignalField(field)) return false
  if (POLICY_CODES.has(value)) return true
  return POLICY_CODE_FRAGMENTS.some((code) => value.includes(code))
}

function phraseSignalsPolicy(value: string, field: string): boolean {
  if (field && !POLICY_TEXT_FIELDS.has(field)) return false
  return POLICY_PHRASES.some((phrase) => value.includes(phrase))
}

function geminiBlockSignalsPolicy(value: string, field: string): boolean {
  if (field !== 'blockreason') return false
  if (value === 'block_reason_unspecified') return false
  return value.length > 0
}

function stringSignalsPolicy(value: string, key = ''): boolean {
  const normalized = value.trim().toLowerCase()
  const field = normalizedKey(key)
  if (codeSignalsPolicy(normalized, field)) return true
  if (phraseSignalsPolicy(normalized, field)) return true
  if (geminiBlockSignalsPolicy(normalized, field)) return true
  if (!POLICY_CODE_FIELDS.has(field)) return false
  return POLICY_REASONS.has(normalized)
}

export function workshopContentPolicyPayload(payload: unknown): boolean {
  const pending: { readonly key: string; readonly value: unknown }[] = [
    { key: '', value: payload }
  ]
  for (let index = 0; index < pending.length && index < 2048; index += 1) {
    const current = pending[index]
    if (typeof current.value === 'string') {
      if (stringSignalsPolicy(current.value, current.key)) return true
      continue
    }
    if (current.value === null || typeof current.value !== 'object') continue
    if (Array.isArray(current.value)) {
      pending.push(
        ...current.value.map((value) => ({ key: current.key, value }))
      )
      continue
    }
    pending.push(
      ...Object.entries(current.value).map(([key, value]) => ({ key, value }))
    )
  }
  return false
}

export function workshopContentPolicyBody(body: string): boolean {
  if (!body.trim()) return false
  try {
    const parsed: unknown = JSON.parse(body)
    return workshopContentPolicyPayload(parsed)
  } catch {
    return stringSignalsPolicy(body)
  }
}
