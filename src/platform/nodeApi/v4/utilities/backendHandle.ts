import { reportError } from '@comfyorg/telemetry/reportError'
import { until } from '@vueuse/core'

import { createHostEvent } from '@/platform/nodeApi/shared/hostEvent'
import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import { frozenSavable } from '@/platform/nodeApi/shared/savableValue'
import type { BackendHandle, Unsubscribe } from '@/platform/nodeApi/v4/types'
import { api } from '@/scripts/api'

import { isCallback, isName, isObject } from './packArguments'

type BackendMessages = (listener: (detail: unknown) => void) => Unsubscribe

export function createBackendHandle(): BackendHandle {
  const copyOfPayload = payloadCopier()
  const messagesByEvent = new Map<string, BackendMessages>()

  const backend: BackendHandle = {
    url: (route) => api.apiURL(sameOriginRoute('backend.url', route)),

    assetUrl: (route) =>
      api.fileURL(sameOriginRoute('backend.assetUrl', route)),

    fetch(route, init) {
      const path = sameOriginRoute('backend.fetch', route)
      if (init !== undefined && !isObject(init)) {
        throw invalidArgument('backend.fetch', 'request options', init)
      }
      const { headers, ...options } = init ?? {}
      return api.fetchApi(path, { ...options, headers: headersOf(headers) })
    },

    on(event, listener) {
      if (!isName(event)) {
        throw invalidArgument('backend.on', 'an event name', event)
      }
      if (!isCallback(listener)) {
        throw invalidArgument('backend.on', 'a function to call', listener)
      }
      return messagesOf(
        messagesByEvent,
        event
      )((detail) => listener(copyOfPayload(event, detail)))
    },

    async getApiVersion() {
      await until(api.serverFeatureFlagsSettled).toBe(true)
      return backendV4Version(api.getServerFeature('node_api.v4'))
    }
  }
  return Object.freeze(backend)
}

function messagesOf(
  messagesByEvent: Map<string, BackendMessages>,
  event: string
): BackendMessages {
  const known = messagesByEvent.get(event)
  if (known) return known
  const messages = createHostEvent<[unknown]>('backend.on', (emit) => {
    const deliver = (message: CustomEvent<unknown>) => emit(message.detail)
    api.addCustomEventListener(event, deliver)
    return () => api.removeCustomEventListener(event, deliver)
  })
  messagesByEvent.set(event, messages)
  return messages
}

function backendV4Version(version: unknown): string | undefined {
  return typeof version === 'string' && /^\d+\.\d+\.\d+$/.test(version)
    ? version
    : undefined
}

function sameOriginRoute(member: string, route: unknown): string {
  if (typeof route !== 'string' || !/^\/(?![/\\])[^\t\n\r]*$/.test(route)) {
    throw invalidArgument(
      member,
      'a route that starts with one / and holds no tab or line break',
      route
    )
  }
  return route
}

function payloadCopier(): (event: string, detail: unknown) => unknown {
  const reported = new Set<string>()
  return (event, detail) => {
    const copy = frozenSavable(detail, isBlob)
    if (copy !== undefined) return copy
    if (!reported.has(event)) {
      reported.add(event)
      reportError(new TypeError(`A ${event} payload is not JSON or a Blob.`), {
        errorType: 'node_api_payload_not_copyable',
        surface: 'platform',
        level: 'warning',
        tags: { event }
      })
    }
    return undefined
  }
}

function isBlob(value: object): boolean {
  return value instanceof Blob
}

function headersOf(headers: HeadersInit | undefined): Headers {
  try {
    return new Headers(headers)
  } catch {
    throw invalidArgument(
      'backend.fetch',
      'headers that Headers takes',
      headers
    )
  }
}
