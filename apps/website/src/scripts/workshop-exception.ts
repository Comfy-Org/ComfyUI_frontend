const EXCEPTION_NAMES = [
  'Error',
  'TypeError',
  'RangeError',
  'ReferenceError',
  'SyntaxError',
  'URIError',
  'AggregateError',
  'NotReadableError',
  'NotFoundError',
  'SecurityError',
  'InvalidStateError',
  'NotSupportedError',
  'DataCloneError',
  'EncodingError',
  'QuotaExceededError',
  'UnknownError',
  'AbortError',
  'NetworkError',
  'TimeoutError'
] as const

export interface WorkshopExceptionAnalytics {
  exception_name?: (typeof EXCEPTION_NAMES)[number] | 'OtherError' | 'NonError'
  exception_frames?: string[]
}

function applicationFrames(stack: string | undefined): string[] {
  return (stack ?? '')
    .slice(0, 16_384)
    .split('\n')
    .slice(0, 20)
    .flatMap((line) => {
      const match = line.match(
        /^(?:\s+at (?:[^()\n]*\()?|[^@\n]*@)https?:\/\/[^/\s()]+(\/_(?:website|astro)\/[\w.-]{1,160}\.js)(?:[?#][^\s)]*)?:(\d{1,8}):(\d{1,8})\)?$/
      )
      return match ? [`${match[1]}:${match[2]}:${match[3]}`] : []
    })
    .slice(0, 5)
}

export function workshopExceptionAnalytics(
  cause: unknown
): WorkshopExceptionAnalytics {
  if (!(cause instanceof Error) && !(cause instanceof DOMException))
    return { exception_name: 'NonError' }
  const frames = applicationFrames(
    'stack' in cause && typeof cause.stack === 'string'
      ? cause.stack
      : undefined
  )
  return {
    exception_name:
      EXCEPTION_NAMES.find((name) => name === cause.name) ?? 'OtherError',
    ...(frames.length ? { exception_frames: frames } : {})
  }
}
