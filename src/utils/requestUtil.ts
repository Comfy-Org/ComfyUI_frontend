import { omitBy } from 'es-toolkit/object'

type Params = Record<string, string[] | string | number | boolean>

export function encodeParams(params: Params) {
  const withoutNull = omitBy(params, (param) => param === undefined)
  const parts = Object.entries(withoutNull).map(([key, value]) => {
    const encoded = Array.isArray(value)
      ? value.map(String).map(encodeURIComponent).join(',')
      : encodeURIComponent(String(value))
    return `${encodeURIComponent(key)}=${encoded}`
  })
  return parts.join('&')
}

export function sortedParams(params: Params = {}): Params {
  const keys = Object.keys(params)
    .filter((k) => params[k] !== undefined)
    .sort()
  const obj: Params = {}
  for (const k of keys) {
    const v = params[k]
    obj[k] = Array.isArray(v) ? v.toSorted((a, b) => a.localeCompare(b)) : v
  }
  return obj
}
