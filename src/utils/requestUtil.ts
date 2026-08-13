import { omitBy } from 'es-toolkit/object'
import { ref } from 'vue'

export function encodeParams(params: Record<string, unknown>) {
  const withoutNull = omitBy(params, (param) => param === undefined)
  const parts = Object.entries(withoutNull).map(([key, value]) => {
    const encoded = Array.isArray(value)
      ? value.map(String).map(encodeURIComponent).join(',')
      : encodeURIComponent(String(value))
    return `${encodeURIComponent(key)}=${encoded}`
  })
  return parts.join('&')
}

export function singletonInvocation<T>(fn: () => Promise<T>) {
  const loading = ref<Promise<T>>()
  function wrappedFn(): Promise<T> {
    if (!loading.value)
      loading.value = fn().finally(() => (loading.value = undefined))
    return loading.value
  }
  return { loading, fn: wrappedFn }
}
