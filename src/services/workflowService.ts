import { downloadBlob } from '@/scripts/utils'
import { useSettingStore } from '@/stores/settingStore'
import { useWorkflowStore } from '@/stores/workflowStore'
import { showPromptDialog } from './dialogService'
import { app } from '@/scripts/app'

async function getFilename(defaultName: string): Promise<string | null> {
  if (useSettingStore().get('Comfy.PromptFilename')) {
    let filename = await showPromptDialog({
      title: 'Export Workflow',
      message: 'Enter the filename:',
      defaultValue: defaultName
    })
    if (!filename) return null
    if (!filename.toLowerCase().endsWith('.json')) {
      filename += '.json'
    }
    return filename
  }
  return defaultName
}

export const workflowService = {
  async exportWorkflow(
    filename: string,
    promptProperty: 'workflow' | 'output'
  ): Promise<void> {
    const workflow = useWorkflowStore().activeWorkflow
    if (workflow?.path) {
      filename = workflow.name
    }
    const p = await app.graphToPrompt()
    const json = JSON.stringify(p[promptProperty], null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const file = await getFilename(filename)
    if (!file) return
    downloadBlob(file, blob)
  }
}
