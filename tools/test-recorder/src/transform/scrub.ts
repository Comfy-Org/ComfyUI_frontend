export interface ScrubResult {
  code: string
  findings: string[]
}

const TYPING_CALL = /\.(?:fill|pressSequentially|type)\(/
const SENSITIVE_FIELD =
  /password|passcode|passwd|one[\s-]?time\s?(?:code|password)|verification code|\b2fa\b|\botp\b|type=["']password["']/i
const JWT = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g
const LONG_TOKEN_FILL = /(\.fill\(\s*)(['"])([A-Za-z0-9+/_=-]{32,})(\2)/g

// Common API-key formats (OpenAI, Anthropic, GitHub, GitLab, AWS, Slack,
// Google, Shopify), redacted wherever they appear on a line. The bare sk-
// branch needs 40+ trailing characters so everyday hyphenated identifiers
// (sk-learn-… and friends) are not caught.
const API_KEY = new RegExp(
  [
    String.raw`\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{40,}`, // OpenAI / Anthropic
    String.raw`\bghp_[A-Za-z0-9]{20,}`, // GitHub classic PAT
    String.raw`\bgho_[A-Za-z0-9]{20,}`, // GitHub app token
    String.raw`\bgithub_pat_[A-Za-z0-9_]{20,}`, // GitHub fine-grained PAT
    String.raw`\bglpat-[A-Za-z0-9_-]{20,}`, // GitLab PAT
    String.raw`\bAKIA[0-9A-Z]{16,}`, // AWS access key id
    String.raw`\bxox[bpars]-[A-Za-z0-9-]{10,}`, // Slack token
    String.raw`\bAIza[0-9A-Za-z_-]{35,}`, // Google API key
    String.raw`\bshpat_[A-Za-z0-9]{20,}` // Shopify token
  ].join('|'),
  'g'
)

function scrubLine(
  line: string,
  lineNumber: number,
  findings: string[]
): string {
  if (TYPING_CALL.test(line) && SENSITIVE_FIELD.test(line)) {
    findings.push(`Removed typing into a sensitive field (line ${lineNumber})`)
    const indentation = line.match(/^\s*/)?.[0] ?? ''
    return `${indentation}// [comfy-test] removed: typing into a sensitive field`
  }

  let scrubbed = line.replace(JWT, '[REDACTED]').replace(API_KEY, '[REDACTED]')
  if (scrubbed !== line) {
    findings.push(`Redacted a credential-shaped token (line ${lineNumber})`)
  }

  const beforeFillScrub = scrubbed
  scrubbed = scrubbed.replace(
    LONG_TOKEN_FILL,
    (_match, prefix: string, quote: string) =>
      `${prefix}${quote}[REDACTED]${quote}`
  )
  if (scrubbed !== beforeFillScrub) {
    findings.push(`Redacted a credential-shaped value (line ${lineNumber})`)
  }

  return scrubbed
}

export function scrubSecrets(code: string): ScrubResult {
  if (code === '') return { code, findings: [] }

  const findings: string[] = []
  const scrubbedLines = code
    .split('\n')
    .map((line, index) => scrubLine(line, index + 1, findings))

  return { code: scrubbedLines.join('\n'), findings }
}
