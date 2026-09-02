export interface ScrubResult {
  code: string
  findings: string[]
}

const TYPING_CALL = /\.(?:fill|pressSequentially|type)\(/
const SENSITIVE_FIELD =
  /password|passcode|passwd|one[\s-]?time\s?(?:code|password)|verification code|\b2fa\b|\botp\b|type=["']password["']/i
const JWT = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g
const LONG_TOKEN_FILL = /(\.fill\(\s*)(['"])([A-Za-z0-9+/_=-]{32,})(\2)/g

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

  let scrubbed = line.replace(JWT, '[REDACTED]')
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
