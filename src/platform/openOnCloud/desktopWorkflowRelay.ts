import { z } from 'zod'

import { t } from '@/i18n'
import { isCloud } from '@/platform/distribution/types'
import {
  DESKTOP_HANDOFF_HASH,
  DESKTOP_HANDOFF_LIFETIME_MS,
  DESKTOP_RELAY_PARAM,
  captureDesktopWorkflowHandoff,
  desktopWorkflowUrl
} from '@/platform/openOnCloud/desktopWorkflowHandoff'
import {
  cloudOrigin,
  isLocalOrigin
} from '@/platform/openOnCloud/localHandoffProtocol'
import { api } from '@/scripts/api'
import type { ComfyWorkflowJSON } from '@comfyorg/graph-model/workflowSchema'

const zRelayRecord = z.object({
  destination: z.url().refine((value) => {
    const url = new URL(value)
    return (
      url.origin === cloudOrigin() && url.hash.startsWith(DESKTOP_HANDOFF_HASH)
    )
  }),
  expiresAt: z.number()
})

export async function handleDesktopWorkflowHandoff(): Promise<boolean> {
  if (!isCloud) return redirectDesktopWorkflowRelay()
  await captureDesktopWorkflowHandoff()
  return false
}

function transferFile(nonce: string) {
  return `open-on-cloud/${nonce}.json`
}

export async function stageDesktopWorkflowHandoff(
  filename: string,
  workflow: ComfyWorkflowJSON
): Promise<string | undefined> {
  const nonce = crypto.randomUUID()
  const expiresAt = Date.now() + DESKTOP_HANDOFF_LIFETIME_MS
  const destination = await desktopWorkflowUrl(nonce, {
    filename,
    workflow,
    expiresAt
  })
  if (!destination) return undefined
  const file = transferFile(nonce)
  const stored = await api.storeUserData(
    file,
    { destination, expiresAt },
    {
      stringify: true,
      overwrite: false,
      throwOnError: false
    }
  )
  if (!stored.ok) return undefined
  setTimeout(() => {
    void api.deleteUserData(file).catch(() => undefined)
  }, DESKTOP_HANDOFF_LIFETIME_MS)
  const relay = new URL(window.location.href)
  relay.search = ''
  relay.hash = ''
  relay.searchParams.set(DESKTOP_RELAY_PARAM, nonce)
  relay.searchParams.set('user', api.user)
  return relay.href
}

function relayNonce(url: URL): string | undefined {
  if (!isLocalOrigin(url.origin)) return undefined
  return z.uuid().safeParse(url.searchParams.get(DESKTOP_RELAY_PARAM)).data
}

async function takeRelayDestination(
  nonce: string
): Promise<string | undefined> {
  const file = transferFile(nonce)
  const response = await api.getUserData(file)
  if (!response.ok) return undefined
  const record = zRelayRecord.safeParse(await response.json().catch(() => null))
  const removed = await api.deleteUserData(file)
  if (!removed.ok || !record.success || record.data.expiresAt <= Date.now())
    return undefined
  return record.data.destination
}

async function relayWorkflow(url: URL): Promise<boolean> {
  const nonce = relayNonce(url)
  if (!nonce) return false
  const { refreshRemoteConfig } =
    await import('@/platform/remoteConfig/refreshRemoteConfig')
  await refreshRemoteConfig({ useAuth: false })
  api.user = url.searchParams.get('user') ?? ''
  const destination = await takeRelayDestination(nonce)
  if (!destination) return false
  window.location.replace(destination)
  return true
}

async function redirectDesktopWorkflowRelay(): Promise<boolean> {
  const url = new URL(window.location.href)
  if (!url.searchParams.has(DESKTOP_RELAY_PARAM)) return false
  const relayed = await relayWorkflow(url).catch(() => false)
  if (!relayed) {
    const splash = document.getElementById('splash-loader')
    if (splash) splash.textContent = t('openOnCloud.desktopTransferFailed')
  }
  return true
}
