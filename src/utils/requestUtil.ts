type ParamValue = string[] | string | number | boolean
type Params = Record<string, ParamValue | undefined>

function sortedParams(params: Params = {}): Record<string, ParamValue> {
  const keys = Object.keys(params).sort()
  const obj: Record<string, ParamValue> = {}
  for (const k of keys) {
    const v = params[k]
    if (v === undefined) continue
    obj[k] = Array.isArray(v) ? v.toSorted((a, b) => a.localeCompare(b)) : v
  }
  return obj
}

export function encodeParams(params: Params = {}) {
  const sorted = sortedParams(params)
  const parts = Object.entries(sorted).map(([key, value]) => {
    const encoded = Array.isArray(value)
      ? value.map(String).map(encodeURIComponent).join(',')
      : encodeURIComponent(String(value))
    return `${encodeURIComponent(key)}=${encoded}`
  })
  return parts.join('&')
}
