import { app } from '@/scripts/app'
import { api } from '@/scripts/api'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useAssetsStore } from '@/stores/assetsStore'
import { useMissingMediaStore } from '@/platform/missingMedia/missingMediaStore'
import type {
  MissingMediaCandidate,
  MediaType
} from '@/platform/missingMedia/types'
import { getNodeByExecutionId } from '@/utils/graphTraversalUtil'
import { isCloud } from '@/platform/distribution/types'
import { addToComboValues } from '@/utils/litegraphUtil'
import { resolveNodeDisplayName } from '@/utils/nodeTitleUtil'
import { st } from '@/i18n'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IComboWidget } from '@/lib/litegraph/src/types/widgets'
import {
  ACCEPTED_IMAGE_TYPES,
  ACCEPTED_VIDEO_TYPES
} from '@/utils/mediaUploadUtil'

const MEDIA_ACCEPT_MAP: Record<MediaType, string> = {
  image: ACCEPTED_IMAGE_TYPES,
  video: ACCEPTED_VIDEO_TYPES,
  audio: 'audio/*'
}

function getMediaComboWidget(
  candidate: MissingMediaCandidate
): { node: LGraphNode; widget: IComboWidget } | null {
  const graph = app.rootGraph
  if (!graph || candidate.nodeId == null) return null

  const node = getNodeByExecutionId(graph, String(candidate.nodeId))
  if (!node) return null

  const widget = node.widgets?.find(
    (w) => w.name === candidate.widgetName && w.type === 'combo'
  ) as IComboWidget | undefined
  if (!widget) return null

  return { node, widget }
}

function resolveComboOptions(
  candidate: MissingMediaCandidate
): { name: string; value: string }[] {
  const result = getMediaComboWidget(candidate)
  if (!result) return []

  const values = result.widget.options.values
  if (!values) return []

  const list: string[] =
    typeof values === 'function'
      ? values(result.widget)
      : Array.isArray(values)
        ? values
        : Object.keys(values)

  return list
    .filter((v) => v !== candidate.name)
    .map((v) => ({ name: getMediaDisplayName(v), value: v }))
}

function applyValueToNodes(
  candidates: MissingMediaCandidate[],
  name: string,
  newValue: string
) {
  const matching = candidates.filter((c) => c.name === name)
  for (const c of matching) {
    const result = getMediaComboWidget(c)
    if (!result) continue

    addToComboValues(result.widget, newValue)
    result.widget.value = newValue
    result.widget.callback?.(newValue)
    result.node.graph?.setDirtyCanvas(true, true)
  }
}

export function getNodeDisplayLabel(
  nodeId: string | number,
  fallback: string
): string {
  const graph = app.rootGraph
  if (!graph) return fallback
  const node = getNodeByExecutionId(graph, String(nodeId))
  return resolveNodeDisplayName(node, {
    emptyLabel: fallback,
    untitledLabel: fallback,
    st
  })
}

/**
 * Resolve display name for a media file.
 * Cloud widgets store asset hashes as values; this resolves them to
 * human-readable names via assetsStore.getInputName().
 */
export function getMediaDisplayName(name: string): string {
  if (!isCloud) return name
  return useAssetsStore().getInputName(name)
}

export function useMissingMediaInteractions() {
  const store = useMissingMediaStore()

  function isExpanded(key: string): boolean {
    return store.expandState[key] ?? false
  }

  function toggleExpand(key: string) {
    store.expandState[key] = !isExpanded(key)
  }

  function getAcceptType(mediaType: MediaType): string {
    return MEDIA_ACCEPT_MAP[mediaType]
  }

  function getExtensionHint(mediaType: MediaType): string {
    if (mediaType === 'audio') return 'audio'
    const exts = MEDIA_ACCEPT_MAP[mediaType]
      .split(',')
      .map((mime) => mime.split('/')[1])
      .join(', ')
    return `${exts}, ...`
  }

  function getLibraryOptions(
    candidate: MissingMediaCandidate
  ): { name: string; value: string }[] {
    return resolveComboOptions(candidate)
  }

  /** Step 1: Store selection from library (does not apply yet). */
  function handleLibrarySelect(name: string, value: string) {
    store.pendingSelection[name] = value
  }

  /** Step 1: Upload file and store result as pending (does not apply yet). */
  async function handleUpload(file: File, name: string, mediaType: MediaType) {
    const expectedPrefix =
      mediaType === 'audio'
        ? 'audio/'
        : mediaType === 'video'
          ? 'video/'
          : 'image/'
    if (file.type && !file.type.startsWith(expectedPrefix)) return

    store.uploadState[name] = { fileName: file.name, status: 'uploading' }

    try {
      const body = new FormData()
      body.append('image', file)

      const resp = await api.fetchApi('/upload/image', {
        method: 'POST',
        body
      })

      if (resp.status !== 200) {
        useToastStore().addAlert(`${resp.status} - ${resp.statusText}`)
        delete store.uploadState[name]
        return
      }

      const data = await resp.json()
      const uploadedPath: string = data.subfolder
        ? `${data.subfolder}/${data.name}`
        : data.name

      const assetsStore = useAssetsStore()
      await assetsStore.updateInputs()

      store.uploadState[name] = { fileName: file.name, status: 'uploaded' }
      store.pendingSelection[name] = uploadedPath
    } catch (err) {
      useToastStore().addAlert(String(err))
      delete store.uploadState[name]
    }
  }

  /** Step 2: Apply pending selection to widgets and remove from missing list. */
  function confirmSelection(name: string) {
    const value = store.pendingSelection[name]
    if (!value || !store.missingMediaCandidates) return

    applyValueToNodes(store.missingMediaCandidates, name, value)
    store.removeMissingMediaByName(name)
    delete store.pendingSelection[name]
    delete store.uploadState[name]
  }

  function cancelSelection(name: string) {
    delete store.pendingSelection[name]
    delete store.uploadState[name]
  }

  function hasPendingSelection(name: string): boolean {
    return name in store.pendingSelection
  }

  return {
    isExpanded,
    toggleExpand,
    getAcceptType,
    getExtensionHint,
    getLibraryOptions,
    handleLibrarySelect,
    handleUpload,
    confirmSelection,
    cancelSelection,
    hasPendingSelection
  }
}
