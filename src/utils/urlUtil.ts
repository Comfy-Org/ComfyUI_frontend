import { mapValues, omitBy } from 'es-toolkit/object'

export function encodeParams(params: Record<string, unknown>) {
  const withoutNull = omitBy(params, (param) => param === undefined)
  const converted = mapValues(withoutNull, (param) =>
    Array.isArray(param) ? param.join(',') : String(param)
  )
  return new URLSearchParams(converted)
}
