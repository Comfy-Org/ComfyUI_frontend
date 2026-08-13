import { mapValues, omitBy } from 'es-toolkit/object'
import { ref } from 'vue'

export function encodeParams(params: Record<string, unknown>) {
  const withoutNull = omitBy(params, (param) => param === undefined)
  const converted = mapValues(withoutNull, (param) =>
    Array.isArray(param) ? param.join(',') : String(param)
  )
  return new URLSearchParams(converted)
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
