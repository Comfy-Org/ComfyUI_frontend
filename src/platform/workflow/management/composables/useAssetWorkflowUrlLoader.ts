import { useRouter } from 'vue-router'

import { signedInOnWebSession } from '@comfyorg/api-client/webSessionFetch'
import { isCloud } from '@/platform/distribution/types'
import { useAuthStore } from '@/stores/authStore'

import { assetService } from '@/platform/assets/services/assetService'
import {
  clearPreservedQuery,
  hydratePreservedQuery,
  mergePreservedQueryIntoQuery
} from '@/platform/navigation/preservedQueryManager'
import { PRESERVED_QUERY_NAMESPACES } from '@/platform/navigation/preservedQueryNamespaces'
import { importApiPrompt } from '@/platform/workflow/utils/importApiPrompt'
import { createHandoffScopeCheck } from '@/platform/workflow/utils/createHandoffScopeCheck'
import { useToast } from '@/components/ui/toast/toastStore'
import { t } from '@/i18n'
import { api } from '@/scripts/api'
import { getMovieMetadataFromRanges } from '@/scripts/metadata/isobmff'
import { getWorkflowDataFromFile } from '@/scripts/metadata/parser'
import { parseJsonWithNonFinite } from '@/utils/jsonUtil'

type OutputAsset = Awaited<ReturnType<typeof assetService.getAssetDetails>>

async function createOutputReader(assetId: string, inScope: () => boolean) {
  const media =
    '/assets/' + encodeURIComponent(assetId) + '/content?disposition=inline'
  const needsToken = isCloud && !(await signedInOnWebSession())
  const token = needsToken
    ? await useAuthStore().getWorkspaceAuthToken()
    : undefined
  if (needsToken && !token) return
  return async (range?: string) => {
    if (!inScope()) return
    const headers = new Headers(
      token ? { Authorization: 'Bearer ' + token } : undefined
    )
    if (range) headers.set('Range', range)
    const response = isCloud
      ? await fetch(api.apiURL(media), { credentials: 'same-origin', headers })
      : await api.fetchApi(media, { headers })
    if (!response.ok || !inScope()) return
    return response
  }
}

function readMovieMetadata(
  size: number,
  fetchContent: (range?: string) => Promise<Response | undefined>
) {
  let wholeFile: Blob | undefined
  return getMovieMetadataFromRanges(size, async (start, end) => {
    if (!wholeFile) {
      const response = await fetchContent(`bytes=${start}-${end - 1}`)
      if (!response) return
      if (response.status === 206) {
        const bytes = await response.arrayBuffer()
        return bytes.byteLength === end - start ? bytes : undefined
      }
      wholeFile = await response.blob()
    }
    return wholeFile.slice(start, end).arrayBuffer()
  })
}

async function outputMetadata(asset: OutputAsset, inScope: () => boolean) {
  const fetchContent = await createOutputReader(asset.id, inScope)
  if (!fetchContent) return
  if (asset.size && /\.(?:mp4|m4v|mov)$/i.test(asset.name))
    return readMovieMetadata(asset.size, fetchContent)
  const response = await fetchContent()
  if (!response) return
  const blob = await response.blob()
  return getWorkflowDataFromFile(
    new File([blob], asset.name, { type: asset.mime_type || blob.type })
  )
}

function isMatchingOutput(asset: OutputAsset, id: string): boolean {
  return asset.id === id && asset.tags.includes('output')
}

async function openAssetWorkflow(id: string, inScope: () => boolean) {
  if (!inScope()) return false
  const asset = await assetService.getAssetDetails(id)
  if (!inScope() || !isMatchingOutput(asset, id)) return false
  const metadata = await outputMetadata(asset, inScope)
  if (!inScope()) return false
  const data =
    typeof metadata?.prompt === 'string'
      ? parseJsonWithNonFinite(metadata.prompt)
      : metadata?.prompt
  const basename =
    asset.name
      .split('/')
      .pop()
      ?.replace(/\.[^.]+$/, '') || id
  return importApiPrompt(data, basename)
}

/** Open the embedded API graph of an output even when its job is no longer available. */
export function useAssetWorkflowUrlLoader() {
  const router = useRouter()
  const namespace = PRESERVED_QUERY_NAMESPACES.ASSET_WORKFLOW
  const reportFailure = () => useToast().error(t('openOnCloud.handoffFailed'))
  return async () => {
    const route = router.currentRoute.value.query
    hydratePreservedQuery(namespace)
    const link = mergePreservedQueryIntoQuery(namespace, route) ?? route
    if (link.assetWorkflow === undefined) return
    const { assetWorkflow: id, assetWorkspace } = link
    const query = { ...route }
    delete query.assetWorkflow
    delete query.assetWorkspace
    clearPreservedQuery(namespace)
    try {
      await router.replace({ query })
      if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(id))
        return void reportFailure()
      if (
        !(await openAssetWorkflow(id, createHandoffScopeCheck(assetWorkspace)))
      )
        reportFailure()
    } catch {
      reportFailure()
    }
  }
}
