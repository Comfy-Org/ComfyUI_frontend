<template>
  <div
    ref="rootElement"
    class="custom-node-tree-editor relative size-full min-h-0 min-w-0 overflow-hidden bg-base-background"
    data-testid="custom-node-tree-editor"
    @pointerup.capture="persistEditorState"
  >
    <Editor
      ref="editorElement"
      :monaco-id="monacoId"
      :files="treeFiles"
      :filelist-title="$t('customNodePacks.editor.workbench.explorer')"
      :font-size="13"
      language="en-US"
      :sider-min-width="explorerWidth"
      :theme="editorTheme"
      @reload="handleReload"
      @save-file="handleSaveFile"
      @new-file="handleNewFile"
      @new-folder="rejectNewFolder"
      @rename-file="rejectRename"
      @rename-folder="rejectRename"
      @delete-file="rejectDelete"
      @delete-folder="rejectDelete"
    />

    <div
      v-if="isLoading"
      class="absolute inset-0 z-30 flex items-center justify-center bg-base-background"
    >
      <div
        class="flex items-center gap-2 text-sm text-muted-foreground"
        role="status"
      >
        <i class="icon-[lucide--loader-circle] size-4 animate-spin" />
        {{ $t('customNodePacks.editor.workbench.loading') }}
      </div>
    </div>

    <div
      v-else-if="loadError"
      class="absolute inset-0 z-30 flex items-center justify-center bg-base-background p-6"
    >
      <div class="flex max-w-md flex-col items-center gap-3 text-center">
        <i
          class="icon-[lucide--circle-alert] size-6 text-destructive-background"
        />
        <p class="m-0 text-sm text-destructive-background" role="alert">
          {{ loadError }}
        </p>
        <Button variant="secondary" size="sm" @click="loadFiles">
          {{ $t('customNodePacks.editor.workbench.retry') }}
        </Button>
      </div>
    </div>

    <p
      v-if="saveError"
      class="text-destructive-foreground absolute right-3 bottom-3 z-30 m-0 max-w-md rounded-sm bg-destructive-background px-3 py-2 text-xs"
      role="alert"
    >
      {{ saveError }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { useDebounceFn, useResizeObserver } from '@vueuse/core'
import { Editor, useGlobalSettings, useMonaco } from 'monaco-tree-editor'
import type { Files } from 'monaco-tree-editor'
import {
  computed,
  nextTick,
  onUnmounted,
  ref,
  useTemplateRef,
  watch
} from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { reportError } from '@/platform/telemetry/reportError'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'

import { useCustomNodeEditor } from '../composables/useCustomNodeEditor'
import type {
  CustomNodeEditorFile,
  CustomNodeEditorFiles
} from '../composables/useCustomNodeEditor'
import {
  readCustomNodeEditorState,
  updateCustomNodeEditorState
} from '../utils/customNodeEditorState'
import { languageForCustomNodePath, monaco } from './customNodeMonaco'

import 'monaco-tree-editor/index.css'

const { sessionId, stateKey, packName } = defineProps<{
  sessionId: string
  stateKey: string
  packName: string
}>()
const explorerOpen = defineModel<boolean>('explorerOpen', { default: true })

const { t } = useI18n()
const { getFiles, saveFiles } = useCustomNodeEditor()
const colorPaletteStore = useColorPaletteStore()
const globalSettings = useGlobalSettings()
const monacoId = `custom-node-${sessionId}`
const projectRoot = computed(() => `/${packName}`)
const monacoEditor = useMonaco(monaco, monacoId)
const rootElement = useTemplateRef<HTMLDivElement>('rootElement')
const editorElement =
  useTemplateRef<InstanceType<typeof Editor>>('editorElement')

const files = ref<CustomNodeEditorFile[]>([])
const initialPath = ref('')
const isLoading = ref(true)
const loadError = ref<string | null>(null)
const saveError = ref<string | null>(null)
const restoredState = readCustomNodeEditorState(stateKey)
const explorerWidth = ref(restoredState?.explorerWidth ?? 180)
explorerOpen.value = restoredState?.explorerOpen ?? explorerOpen.value
const editorStateRestored = ref(false)
let saveQueue: Promise<void> = Promise.resolve()
let editorChangeListener: monaco.IDisposable | undefined

const editorTheme = computed(() =>
  colorPaletteStore.completedActivePalette.light_theme ? 'light' : 'dark'
)

const treeFiles = computed<Files>(() => {
  const result: Files = {
    [projectRoot.value]: {
      isFile: false,
      isFolder: true,
      readonly: true
    }
  }
  for (const file of files.value) {
    result[`${projectRoot.value}/${file.path}`] = {
      content: file.content,
      isFile: true,
      isFolder: false,
      readonly: true
    }
  }
  return result
})

function relativeEditorPath(path: string): string {
  return `/${path}`
}

function projectFilePath(path: string): string | null {
  const normalized = path.replaceAll('\\', '/')
  const prefix = `${projectRoot.value}/`
  if (!normalized.startsWith(prefix)) return null
  return normalized.slice(prefix.length)
}

function messageFor(error: unknown, fallbackKey: string): string {
  return error instanceof Error ? error.message : t(fallbackKey)
}

async function replaceFiles(result: CustomNodeEditorFiles) {
  files.value = result.files
  initialPath.value = result.initialPath ?? result.files[0]?.path ?? ''
  loadError.value = null
  await nextTick()
}

async function loadFiles() {
  if (files.value.length === 0) isLoading.value = true
  try {
    await replaceFiles(await getFiles(sessionId))
  } catch (error) {
    reportError(error, { errorType: 'custom_node_workbench_load_failed' })
    loadError.value = messageFor(
      error,
      'customNodePacks.editor.workbench.loadFailed'
    )
    throw error
  } finally {
    isLoading.value = false
  }
}

function handleReload(resolve: () => void, reject: (message?: string) => void) {
  void loadFiles()
    .then(resolve)
    .catch((error: unknown) => {
      reject(messageFor(error, 'customNodePacks.editor.workbench.loadFailed'))
    })
}

function queueSave(updates: CustomNodeEditorFile[]): Promise<void> {
  const pending = saveQueue
    .catch(() => undefined)
    .then(async () => {
      await replaceFiles(await saveFiles(sessionId, updates))
      saveError.value = null
    })
  saveQueue = pending
  return pending
}

function reportSaveFailure(error: unknown): string {
  reportError(error, { errorType: 'custom_node_workbench_save_failed' })
  const message = messageFor(
    error,
    'customNodePacks.editor.workbench.saveFailed'
  )
  saveError.value = message
  return message
}

function handleSaveFile(
  editorPath: string,
  content: string,
  resolve: () => void,
  reject: (message?: string) => void
) {
  const path = projectFilePath(editorPath)
  if (!path) {
    reject(t('customNodePacks.editor.workbench.invalidPath'))
    return
  }
  void queueSave([{ path, content, editable: true }])
    .then(resolve)
    .catch((error: unknown) => reject(reportSaveFailure(error)))
}

function handleNewFile(
  editorPath: string,
  resolve: () => void,
  reject: (message?: string) => void
) {
  handleSaveFile(editorPath, '', resolve, reject)
}

function rejectNewFolder(
  _path: string,
  _resolve: () => void,
  reject: (message?: string) => void
) {
  reject(t('customNodePacks.editor.workbench.folderUnsupported'))
}

function rejectRename(
  _path: string,
  _newPath: string,
  _resolve: () => void,
  reject: (message?: string) => void
) {
  reject(t('customNodePacks.editor.workbench.fileOperationUnsupported'))
}

function rejectDelete(
  _path: string,
  _resolve: () => void,
  reject: (message?: string) => void
) {
  reject(t('customNodePacks.editor.workbench.fileOperationUnsupported'))
}

async function saveAll() {
  await saveQueue.catch(() => undefined)
  const updates = files.value.flatMap((file) => {
    const path = relativeEditorPath(file.path)
    if (!monacoEditor.commands._hasChanged(path)) return []
    const content = monacoEditor.commands._getValue(path)
    return content === undefined ? [] : [{ ...file, content }]
  })
  if (updates.length === 0) return
  try {
    await queueSave(updates)
  } catch (error) {
    reportSaveFailure(error)
    throw error
  }
}

const scheduleSave = useDebounceFn(() => {
  void saveAll().catch(() => undefined)
}, 900)

function storedFilePath(editorPath: string | undefined): string | undefined {
  if (!editorPath) return undefined
  const normalized = editorPath.startsWith('/')
    ? editorPath.slice(1)
    : editorPath
  return files.value.some((file) => file.path === normalized)
    ? normalized
    : undefined
}

function currentExplorerWidth(): number {
  const width = rootElement.value
    ?.querySelector<HTMLElement>('.monaco-tree-editor-list-wrapper')
    ?.getBoundingClientRect().width
  return width && width >= 180 ? Math.round(width) : explorerWidth.value
}

function persistEditorState() {
  if (!editorStateRestored.value) return
  const openedPaths = monacoEditor.states.openedFiles.value.flatMap(
    (file: { path: string }) => {
      const path = storedFilePath(file.path)
      return path ? [path] : []
    }
  )
  const activePath = storedFilePath(monacoEditor.states.currentPath.value)
  explorerWidth.value = currentExplorerWidth()
  updateCustomNodeEditorState(stateKey, {
    activePath,
    openedPaths,
    explorerOpen: explorerOpen.value,
    explorerWidth: explorerWidth.value
  })
}

function restoreEditorState() {
  if (editorStateRestored.value || !initialPath.value) return
  const state = readCustomNodeEditorState(stateKey)
  globalSettings.commands.switchCurrentLeftSiderBar(
    explorerOpen.value ? 'Explorer' : undefined,
    false
  )

  const openedPaths = (state?.openedPaths ?? []).flatMap((storedPath) => {
    const path = storedFilePath(storedPath)
    return path ? [relativeEditorPath(path)] : []
  })
  if (openedPaths.length > 0) {
    monacoEditor.commands.setOpenedFiles(openedPaths.map((path) => ({ path })))
  }
  const activePath =
    storedFilePath(state?.activePath) ??
    initialPath.value ??
    files.value[0]?.path
  if (!activePath) return
  const path = relativeEditorPath(activePath)
  const model = monacoEditor.commands._restoreModel(path)
  if (!model) return
  monacoEditor.commands._openOrFocusPath(path)
  editorStateRestored.value = true
  editorChangeListener ??= monacoEditor.commands
    .getEditor()
    .onDidChangeModelContent(scheduleSave)
}

function synchronizeModelLanguages() {
  for (const file of files.value) {
    const model = monaco.editor
      .getModels()
      .find((candidate) => candidate.uri.path === relativeEditorPath(file.path))
    if (!model) continue
    const language = languageForCustomNodePath(file.path)
    if (model.getLanguageId() !== language) {
      monaco.editor.setModelLanguage(model, language)
    }
  }
}

function handleFileTreeLoaded() {
  synchronizeModelLanguages()
  restoreEditorState()
}

const stopFileTreeListener =
  monacoEditor.events.onFileTreeLoaded.listen(handleFileTreeLoaded)

const stopOpenedFilesWatcher = watch(
  monacoEditor.states.openedFiles,
  persistEditorState,
  { deep: true }
)
const stopCurrentPathWatcher = watch(
  monacoEditor.states.currentPath,
  persistEditorState
)
const stopExplorerModelWatcher = watch(
  explorerOpen,
  (isOpen) => {
    globalSettings.commands.switchCurrentLeftSiderBar(
      isOpen ? 'Explorer' : undefined,
      false
    )
    persistEditorState()
  },
  { flush: 'sync' }
)
const stopExplorerPanelWatcher = watch(
  globalSettings.states.opendLeftSiderBar,
  (openPanel) => {
    explorerOpen.value = openPanel === 'Explorer'
  },
  { flush: 'sync' }
)

useResizeObserver(rootElement, () => {
  editorElement.value?.resize()
})

onUnmounted(() => {
  persistEditorState()
  scheduleSave.cancel()
  stopFileTreeListener()
  stopOpenedFilesWatcher()
  stopCurrentPathWatcher()
  stopExplorerModelWatcher()
  stopExplorerPanelWatcher()
  editorChangeListener?.dispose()
  for (const file of files.value) {
    monaco.editor
      .getModels()
      .find((model) => model.uri.path === relativeEditorPath(file.path))
      ?.dispose()
  }
  monacoEditor.destroy()
})

defineExpose({ replaceFiles, saveAll })
</script>

<style scoped>
.custom-node-tree-editor {
  container-type: inline-size;
}

/* The dependency renders its workbench outside our template class surface. */
.custom-node-tree-editor :deep(.monaco-tree-editor.dark) {
  color-scheme: dark;
  --monaco-bg-base-1: var(--monaco-c-black-3);
  --monaco-bg-base-2: var(--monaco-c-black-2);
  --monaco-bg-base-3: var(--monaco-c-black-5);
  --monaco-text-base-1: var(--monaco-c-white-2);
  --monaco-text-base-2: var(--monaco-c-white-1);
  --monaco-bg-sysbar: var(--monaco-c-black-4);
  --monaco-text-sysbar-button: var(--monaco-c-gray-2);
  --monaco-text-sysbar-button-hover: var(--monaco-c-white-1);
  --monaco-bg-folders: var(--monaco-c-black-2);
  --monaco-bg-folders-item-active: var(--monaco-c-blue-2);
  --monaco-bg-folders-item-hover: var(--monaco-c-black-5);
  --monaco-bg-openedtab-item: var(--monaco-c-black-4);
  --monaco-bg-openedtab-item-active: var(--monaco-c-black-3);
  --monaco-bg-messagepopup-box: var(--monaco-c-black-2);
  --monaco-bg-messagepopup-box-hover: var(--monaco-c-black-4);
}

.custom-node-tree-editor :deep(.monaco-tree-editor-area-empty),
.custom-node-tree-editor :deep(label[title='New Folder..']),
.custom-node-tree-editor :deep(label[title='Rename']),
.custom-node-tree-editor :deep(label[title='Delete']) {
  display: none;
}

.custom-node-tree-editor :deep(.left-sider-bar) {
  display: none;
}

.custom-node-tree-editor :deep(.monaco-tree-editor-list-file-item-row),
.custom-node-tree-editor :deep(.monaco-tree-editor-list-file-item-row span) {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.custom-node-tree-editor
  :deep(
    .monaco-tree-editor-list-title + .monaco-tree-editor-list-split > span
  ) {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
