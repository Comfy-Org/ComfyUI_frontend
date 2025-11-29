import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useWorkspaceStore = defineStore('workspace', () => {
  const currentWorkspaceId = ref<string | null>(null)
  const currentProjectId = ref<string | null>(null)
  const currentCanvasId = ref<string | null>(null)
  const openCanvases = ref<string[]>([])

  function setCurrentIds(workspaceId: string, projectId: string, canvasId: string): void {
    currentWorkspaceId.value = workspaceId
    currentProjectId.value = projectId
    currentCanvasId.value = canvasId
  }

  function openCanvas(canvasId: string, _name: string, _projectId: string): void {
    if (!openCanvases.value.includes(canvasId)) {
      openCanvases.value.push(canvasId)
    }
  }

  function closeCanvas(canvasId: string): void {
    const index = openCanvases.value.indexOf(canvasId)
    if (index > -1) {
      openCanvases.value.splice(index, 1)
    }
  }

  return {
    currentWorkspaceId,
    currentProjectId,
    currentCanvasId,
    openCanvases,
    setCurrentIds,
    openCanvas,
    closeCanvas,
  }
})
