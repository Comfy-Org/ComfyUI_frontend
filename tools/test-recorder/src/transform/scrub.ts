export interface ScrubResult {
  code: string
  findings: string[]
}

const TYPING_CALL = /\.(?:fill|pressSequentially|type)\(/
const SENSITIVE_FIELD =
  /password|passcode|passwd|one[\s-]?time\s?(?:code|password)|verification code|\b2fa\b|\botp\b|type=["']password["']/i
const JWT =
  /(?<![A-Za-z0-9])eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g
const LONG_TOKEN_FILL = /(\.fill\(\s*)(['"])([A-Za-z0-9+/_=-]{32,})(\2)/g

const API_KEY = new RegExp(
  [
    String.raw`(?<![A-Za-z0-9])sk-(?:ant-|proj-)?[A-Za-z0-9_-]{40,}`,
    String.raw`(?<![A-Za-z0-9])gh[posur]_[A-Za-z0-9_]{10,}(?:\.[A-Za-z0-9_-]{8,}){0,2}`,
    String.raw`(?<![A-Za-z0-9])github_pat_[A-Za-z0-9_]{20,}`,
    String.raw`(?<![A-Za-z0-9])glpat-[A-Za-z0-9_-]{20,}`,
    String.raw`(?<![A-Za-z0-9])AKIA[0-9A-Z]{16,}`,
    String.raw`(?<![A-Za-z0-9])xox[bpars]-[A-Za-z0-9-]{10,}`,
    String.raw`(?<![A-Za-z0-9])xapp-[A-Za-z0-9-]{10,}`,
    String.raw`(?<![A-Za-z0-9])AIza[0-9A-Za-z_-]{35,}`,
    String.raw`(?<![A-Za-z0-9])shpat_[A-Za-z0-9]{20,}`
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

  let scrubbed = line.replace(API_KEY, '[REDACTED]').replace(JWT, '[REDACTED]')
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
