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
      :file-menu="fileMenu"
      :font-size="13"
      language="en-US"
      :sider-min-width="explorerWidth"
      :theme="editorTheme"
      @reload="handleReload"
      @save-file="handleSaveFile"
      @new-file="handleNewFile"
      @new-folder="handleNewFolder"
      @rename-file="handleMoveFile"
      @rename-folder="rejectRename"
      @delete-file="handleDeleteFile"
      @delete-folder="rejectDelete"
      @contextmenu-select="handleContextMenuSelect"
    />

    <div
      v-if="moveSource"
      class="absolute inset-0 z-40 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="`${monacoId}-move-title`"
      @keydown.esc="cancelMove"
    >
      <form
        class="flex w-full max-w-md flex-col gap-4 rounded-lg border border-border-default bg-base-background p-4 shadow-lg"
        @submit.prevent="confirmMove"
      >
        <div>
          <h3
            :id="`${monacoId}-move-title`"
            class="text-foreground m-0 text-sm font-medium"
          >
            {{ $t('customNodePacks.editor.workbench.moveFile') }}
          </h3>
          <p class="mt-1 mb-0 truncate text-xs text-muted-foreground">
            {{ moveSource }}
          </p>
        </div>
        <label class="flex flex-col gap-1.5 text-xs text-muted-foreground">
          {{ $t('customNodePacks.editor.workbench.destinationPath') }}
          <Input
            v-model="moveDestination"
            autofocus
            :disabled="isMoving"
            :placeholder="
              $t('customNodePacks.editor.workbench.destinationPlaceholder')
            "
          />
        </label>
        <p
          v-if="moveError"
          class="m-0 text-xs text-destructive-background"
          role="alert"
        >
          {{ moveError }}
        </p>
        <div class="flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            :disabled="isMoving"
            @click="cancelMove"
          >
            {{ $t('g.cancel') }}
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            :loading="isMoving"
            :disabled="
              !moveDestination.trim() ||
              moveDestination.trim() === moveSource ||
              isMoving
            "
          >
            {{ $t('customNodePacks.editor.workbench.move') }}
          </Button>
        </div>
      </form>
    </div>

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
import Input from '@/components/ui/input/Input.vue'
import { reportError } from '@/platform/telemetry/reportError'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'

import { useCustomNodeEditor } from '../composables/useCustomNodeEditor'
import type {
  CustomNodeEditorFile,
  CustomNodeEditorFiles,
  CustomNodeEditorOperation
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
const { applyOperations, getFiles, saveFiles } = useCustomNodeEditor()
const colorPaletteStore = useColorPaletteStore()
const globalSettings = useGlobalSettings()
const monacoId = `custom-node-${sessionId}`
const projectRoot = computed(() => `/${packName}`)
const monacoEditor = useMonaco(monaco, monacoId)
const rootElement = useTemplateRef<HTMLDivElement>('rootElement')
const editorElement =
  useTemplateRef<InstanceType<typeof Editor>>('editorElement')

const files = ref<CustomNodeEditorFile[]>([])
const directories = ref<string[]>([])
const digest = ref('')
const initialPath = ref('')
const isLoading = ref(true)
const loadError = ref<string | null>(null)
const saveError = ref<string | null>(null)
const moveSource = ref('')
const moveDestination = ref('')
const moveError = ref<string | null>(null)
const isMoving = ref(false)
const restoredState = readCustomNodeEditorState(stateKey)
const explorerWidth = ref(restoredState?.explorerWidth ?? 180)
explorerOpen.value = restoredState?.explorerOpen ?? explorerOpen.value
const editorStateRestored = ref(false)
let saveQueue: Promise<void> = Promise.resolve()
let editorChangeListener: monaco.IDisposable | undefined
const modelCreationListener = monaco.editor.onDidCreateModel(
  synchronizeModelLanguage
)

const editorTheme = computed(() =>
  colorPaletteStore.completedActivePalette.light_theme ? 'light' : 'dark'
)
const fileMenu = computed(() => [
  {
    label: t('customNodePacks.editor.workbench.moveFile'),
    value: 'moveFile'
  }
])

const treeFiles = computed<Files>(() => {
  const result: Files = {
    [projectRoot.value]: {
      isFile: false,
      isFolder: true,
      readonly: true
    }
  }
  for (const directory of directories.value) {
    result[`${projectRoot.value}/${directory}`] = {
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
      readonly: !file.editable
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
  const components: string[] = []
  for (const component of normalized.slice(prefix.length).split('/')) {
    if (!component || component === '.') continue
    if (component === '..') {
      if (components.length === 0) return null
      components.pop()
      continue
    }
    components.push(component)
  }
  return components.length > 0 ? components.join('/') : null
}

function messageFor(error: unknown, fallbackKey: string): string {
  return error instanceof Error ? error.message : t(fallbackKey)
}

async function replaceFiles(result: CustomNodeEditorFiles) {
  files.value = result.files
  directories.value = result.directories
  digest.value = result.digest
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

function queueOperations(
  operations: CustomNodeEditorOperation[]
): Promise<void> {
  const pending = saveQueue
    .catch(() => undefined)
    .then(async () => {
      if (!digest.value) {
        throw new Error(t('customNodePacks.editor.workbench.reloadRequired'))
      }
      await replaceFiles(
        await applyOperations(sessionId, operations, digest.value)
      )
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

function reportOperationFailure(error: unknown): string {
  reportError(error, { errorType: 'custom_node_workbench_operation_failed' })
  const message = messageFor(
    error,
    'customNodePacks.editor.workbench.operationFailed'
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
  const path = projectFilePath(editorPath)
  if (!path) {
    reject(t('customNodePacks.editor.workbench.invalidPath'))
    return
  }
  void runOperations([{ kind: 'create_file', path, content: '' }])
    .then(resolve)
    .catch((error: unknown) => reject(reportOperationFailure(error)))
}

function handleNewFolder(
  editorPath: string,
  resolve: () => void,
  reject: (message?: string) => void
) {
  const path = projectFilePath(editorPath)
  if (!path) {
    reject(t('customNodePacks.editor.workbench.invalidPath'))
    return
  }
  void runOperations([{ kind: 'create_directory', path }])
    .then(resolve)
    .catch((error: unknown) => reject(reportOperationFailure(error)))
}

function handleMoveFile(
  editorPath: string,
  newEditorPath: string,
  resolve: () => void,
  reject: (message?: string) => void
) {
  const path = projectFilePath(editorPath)
  const destination = projectFilePath(newEditorPath)
  if (!path || !destination) {
    reject(t('customNodePacks.editor.workbench.invalidPath'))
    return
  }
  void runOperations([{ kind: 'move_file', path, destination }])
    .then(resolve)
    .catch((error: unknown) => reject(reportOperationFailure(error)))
}

function handleDeleteFile(
  editorPath: string,
  resolve: () => void,
  reject: (message?: string) => void
) {
  const path = projectFilePath(editorPath)
  if (!path) {
    reject(t('customNodePacks.editor.workbench.invalidPath'))
    return
  }
  void runOperations([{ kind: 'delete_file', path }])
    .then(resolve)
    .catch((error: unknown) => reject(reportOperationFailure(error)))
}

function handleContextMenuSelect(editorPath: string, item: { value: unknown }) {
  if (item.value !== 'moveFile') return
  const path = projectFilePath(editorPath)
  if (!path) {
    saveError.value = t('customNodePacks.editor.workbench.invalidPath')
    return
  }
  moveSource.value = path
  moveDestination.value = path
  moveError.value = null
}

function cancelMove() {
  if (isMoving.value) return
  moveSource.value = ''
  moveDestination.value = ''
  moveError.value = null
}

async function confirmMove() {
  if (!moveSource.value || isMoving.value) return
  const destination = projectFilePath(
    `${projectRoot.value}/${moveDestination.value.trim()}`
  )
  if (!destination || destination === moveSource.value) {
    moveError.value = t('customNodePacks.editor.workbench.invalidPath')
    return
  }
  isMoving.value = true
  moveError.value = null
  try {
    await runOperations([
      { kind: 'move_file', path: moveSource.value, destination }
    ])
    moveSource.value = ''
    moveDestination.value = ''
  } catch (error) {
    moveError.value = reportOperationFailure(error)
  } finally {
    isMoving.value = false
  }
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

async function runOperations(operations: CustomNodeEditorOperation[]) {
  await saveAll()
  await queueOperations(operations)
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

function synchronizeModelLanguage(model: monaco.editor.ITextModel) {
  const file = files.value.find(
    (candidate) => relativeEditorPath(candidate.path) === model.uri.path
  )
  if (!file) return
  const language = languageForCustomNodePath(file.path)
  if (model.getLanguageId() !== language) {
    monaco.editor.setModelLanguage(model, language)
  }
}

function synchronizeModelLanguages() {
  monaco.editor.getModels().forEach(synchronizeModelLanguage)
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
  modelCreationListener.dispose()
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
:global(.monaco-tree-editor-modal) {
  /* The dependency teleports confirmations outside the modal editor dialog. */
  position: fixed !important;
  z-index: 1800 !important;
  pointer-events: auto !important;
}

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

.custom-node-tree-editor :deep(.monaco-tree-editor-area-empty) {
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
