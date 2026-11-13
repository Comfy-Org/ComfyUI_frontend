import { reportError } from '@comfyorg/telemetry/reportError'

import { createHostEvent } from '@/platform/nodeApi/shared/hostEvent'
import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import type { BackendHandle, Unsubscribe } from '@/platform/nodeApi/v4/types'
import { api } from '@/scripts/api'

import { frozenJsonCopy, isJsonValue } from './jsonValues'
import { isCallback, isName, isObject } from './packArguments'

type BackendMessages = (listener: (detail: unknown) => void) => Unsubscribe

export function createBackendHandle(): BackendHandle {
  const copyOfPayload = payloadCopier()
  const messagesByEvent = new Map<string, BackendMessages>()

  function messagesOf(event: string): BackendMessages {
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

  const backend: BackendHandle = {
    url: (route) => api.apiURL(sameOriginRoute('backend.url', route)),

    assetUrl: (route) =>
      api.fileURL(sameOriginRoute('backend.assetUrl', route)),

    fetch(route, init) {
      const path = sameOriginRoute('backend.fetch', route)
      if (init !== undefined && !isObject(init)) {
        throw invalidArgument('backend.fetch', 'request options', init)
      }
      return api.fetchApi(path, {
        ...init,
        headers: new Headers(init?.headers)
      })
    },

    on(event, listener) {
      if (!isName(event)) {
        throw invalidArgument('backend.on', 'an event name', event)
      }
      if (!isCallback(listener)) {
        throw invalidArgument('backend.on', 'a function to call', listener)
      }
      return messagesOf(event)((detail) =>
        listener(copyOfPayload(event, detail))
      )
    }
  }
  return Object.freeze(backend)
}

function sameOriginRoute(member: string, route: unknown): string {
  if (typeof route !== 'string' || !/^\/(?![/\\])/.test(route)) {
    throw invalidArgument(member, 'a route that starts with one /', route)
  }
  return route
}

function payloadCopier(): (event: string, detail: unknown) => unknown {
  const reported = new Set<string>()
  return (event, detail) => {
    if (isJsonValue(detail, isBlob)) return frozenJsonCopy(detail)
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
