import { computed, ref, shallowRef } from 'vue'
import type { Ref } from 'vue'

/**
 * Bridge between the cloud PostHog provider (which produces per-user/per-cohort
 * flag payloads) and {@link useRemoteUserData} consumers (which run in any
 * build). The provider registers a source; consumers read it and fall back to
 * defaults when none was registered.
 *
 * Must never import posthog-js — it stays in OSS/desktop bundles.
 */
export interface PayloadSource {
  payloads: Ref<Record<string, unknown>>
}

// shallowRef so reactive-mode consumers track source registration without
// unwrapping the nested `payloads` ref.
const _payloadSource = shallowRef<PayloadSource | null>(null)

/**
 * Ready by default: without a PostHog token no source ever registers, so
 * defaults are final and consumers must not wait. The cloud provider marks it
 * pending, then ready after the first flag response or a timeout.
 */
const _ready = ref(true)

export const remoteUserDataReady = computed(() => _ready.value)

export function setPayloadSource(source: PayloadSource | null): void {
  _payloadSource.value = source
}

export function getPayloadSource(): PayloadSource | null {
  return _payloadSource.value
}

export function markRemoteUserDataPending(): void {
  _ready.value = false
}

export function markRemoteUserDataReady(): void {
  _ready.value = true
}
