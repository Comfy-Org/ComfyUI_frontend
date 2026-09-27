type Params = Record<string, string[] | string | number | boolean>

function sortedParams(params: Params = {}): Params {
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
