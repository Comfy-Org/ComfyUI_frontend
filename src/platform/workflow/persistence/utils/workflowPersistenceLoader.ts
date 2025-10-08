import { api } from '@/scripts/api'
import { app as comfyApp } from '@/scripts/app'

import {
  clearDraft,
  readDraft,
  readMostRecentDraftPath
} from './workflowDraftStore'

interface PersistedWorkflowLoadOptions {
  workflowName: string | null
  preferredPath?: string | null
  fallbackToLatestDraft?: boolean
}

const tryLoadGraph = async (
  payload: string | null,
  workflowName: string | null,
  onFailure?: () => void
) => {
  if (!payload) return false
  try {
    const workflow = JSON.parse(payload)
    await comfyApp.loadGraphData(workflow, true, true, workflowName)
    return true
  } catch (err) {
    console.error('Failed to load persisted workflow', err)
    onFailure?.()
    return false
  }
}

const loadDraftByPath = async (path: string) => {
  const draft = readDraft(path)
  if (!draft) return false
  return await tryLoadGraph(draft.data, draft.name, () => clearDraft(path))
}

export const loadPersistedWorkflow = async (
  options: PersistedWorkflowLoadOptions
) => {
  const { workflowName, preferredPath, fallbackToLatestDraft = false } = options

  if (preferredPath && (await loadDraftByPath(preferredPath))) {
    return true
  }

  if (!preferredPath && fallbackToLatestDraft) {
    const fallbackPath = readMostRecentDraftPath()
    if (fallbackPath && (await loadDraftByPath(fallbackPath))) {
      return true
    }
  }

  const clientId = api.initialClientId ?? api.clientId
  if (clientId) {
    const sessionPayload = sessionStorage.getItem(`workflow:${clientId}`)
    if (await tryLoadGraph(sessionPayload, workflowName)) {
      return true
    }
  }

  const localPayload = localStorage.getItem('workflow')
  return await tryLoadGraph(localPayload, workflowName)
}
