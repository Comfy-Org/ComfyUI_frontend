import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import type * as VueUse from '@vueuse/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import {
  readCustomNodeEditorState,
  updateCustomNodeEditorState
} from '../utils/customNodeEditorState'
import CustomNodeTreeEditor from './CustomNodeTreeEditor.vue'

interface ResizeEntry {
  contentRect: { width: number }
}

const mocks = vi.hoisted(() => ({
  applyOperations: vi.fn(),
  changeListener: vi.fn(),
  currentPath: undefined as undefined | { value: string | undefined },
  destroy: vi.fn(),
  explorerPanel: undefined as
    | undefined
    | { value: 'Explorer' | 'Setting' | undefined },
  fileTreeLoaded: undefined as undefined | (() => void),
  getFiles: vi.fn(),
  getValue: vi.fn(),
  hasChanged: vi.fn(),
  lightTheme: false,
  modelCreated: undefined as
    | undefined
    | ((model: {
        dispose: () => void
        getLanguageId: () => string
        uri: { path: string }
      }) => void),
  models: [] as Array<{
    dispose: () => void
    getLanguageId: () => string
    uri: { path: string }
  }>,
  openOrFocusPath: vi.fn(),
  openedFiles: undefined as undefined | { value: Array<{ path: string }> },
  reportError: vi.fn(),
  resize: vi.fn(),
  resizeCallback: undefined as undefined | ((entries: ResizeEntry[]) => void),
  restoreModel: vi.fn(),
  saveFiles: vi.fn(),
  setModelLanguage: vi.fn(),
  setOpenedFiles: vi.fn(),
  stopFileTreeListener: vi.fn(),
  stopModelCreationListener: vi.fn(),
  switchCurrentLeftSiderBar: vi.fn()
}))

vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal<typeof VueUse>()
  return {
    ...actual,
    useResizeObserver: (
      _target: unknown,
      callback: (entries: ResizeEntry[]) => void
    ) => {
      mocks.resizeCallback = callback
      return { stop: vi.fn() }
    }
  }
})

vi.mock('monaco-tree-editor', async () => {
  const { defineComponent, onMounted, ref } = await import('vue')
  mocks.currentPath = ref<string>()
  mocks.explorerPanel = ref<'Explorer' | 'Setting' | undefined>('Explorer')
  mocks.openedFiles = ref<Array<{ path: string }>>([])
  return {
    Editor: defineComponent({
      name: 'Editor',
      props: {
        files: { type: Object, required: true },
        fileMenu: { type: Array, required: true },
        monacoId: { type: String, required: true },
        siderMinWidth: { type: Number, required: true },
        theme: { type: String, required: true }
      },
      emits: [
        'reload',
        'saveFile',
        'newFile',
        'newFolder',
        'renameFile',
        'renameFolder',
        'deleteFile',
        'deleteFolder',
        'contextmenuSelect'
      ],
      setup(_props, { emit, expose }) {
        expose({ resize: mocks.resize })
        onMounted(() => {
          emit(
            'reload',
            () => mocks.fileTreeLoaded?.(),
            () => undefined
          )
        })
      },
      template: `
      <div
        data-testid="library-editor"
        :data-theme="theme"
        :data-explorer-width="siderMinWidth"
      >
        {{ Object.keys(files).join('|') }}
        <button
          type="button"
          @click="$emit(
            'saveFile',
            Object.keys(files)[0] + '/v2/nodes/checkerboard.py',
            '# changed\\n',
            () => undefined,
            () => undefined
          )"
        >
          Save checkerboard
        </button>
        <button
          type="button"
          @click="$emit(
            'newFolder',
            Object.keys(files)[0] + '/v2/nodes/helpers',
            () => undefined,
            () => undefined
          )"
        >
          New helpers folder
        </button>
        <button
          type="button"
          @click="$emit(
            'newFile',
            Object.keys(files)[0] + '/v2/nodes/new_node.py',
            () => undefined,
            () => undefined
          )"
        >
          New node file
        </button>
        <button
          type="button"
          @click="$emit(
            'renameFile',
            Object.keys(files)[0] + '/README.md',
            Object.keys(files)[0] + '/GUIDE.md',
            () => undefined,
            () => undefined
          )"
        >
          Rename readme
        </button>
        <button
          type="button"
          @click="$emit(
            'contextmenuSelect',
            Object.keys(files)[0] + '/README.md',
            { label: 'Move File…', value: 'moveFile' }
          )"
        >
          Move readme to folder
        </button>
        <button
          type="button"
          @click="$emit(
            'deleteFile',
            Object.keys(files)[0] + '/v2/web/js/checkerboard.js',
            () => undefined,
            () => undefined
          )"
        >
          Delete browser extension
        </button>
      </div>
    `
    }),
    useGlobalSettings: () => ({
      states: {
        opendLeftSiderBar: mocks.explorerPanel
      },
      commands: {
        switchCurrentLeftSiderBar: mocks.switchCurrentLeftSiderBar
      }
    }),
    useMonaco: () => ({
      states: {
        currentPath: mocks.currentPath,
        openedFiles: mocks.openedFiles
      },
      commands: {
        _getValue: mocks.getValue,
        _hasChanged: mocks.hasChanged,
        _openOrFocusPath: mocks.openOrFocusPath,
        _restoreModel: mocks.restoreModel,
        getEditor: () => ({
          onDidChangeModelContent: mocks.changeListener
        }),
        setOpenedFiles: mocks.setOpenedFiles
      },
      destroy: mocks.destroy,
      events: {
        onFileTreeLoaded: {
          listen: (callback: () => void) => {
            mocks.fileTreeLoaded = callback
            return mocks.stopFileTreeListener
          }
        }
      }
    })
  }
})

vi.mock('monaco-tree-editor/index.css', () => ({}))

vi.mock('./customNodeMonaco', () => ({
  languageForCustomNodePath: (path: string) => {
    if (path.endsWith('.py')) return 'python'
    if (path.endsWith('.md')) return 'markdown'
    return 'plaintext'
  },
  monaco: {
    editor: {
      getModels: () => mocks.models,
      onDidCreateModel: (callback: NonNullable<typeof mocks.modelCreated>) => {
        mocks.modelCreated = callback
        return { dispose: mocks.stopModelCreationListener }
      },
      setModelLanguage: mocks.setModelLanguage
    }
  }
}))

vi.mock('../composables/useCustomNodeEditor', () => ({
  useCustomNodeEditor: () => ({
    applyOperations: mocks.applyOperations,
    getFiles: mocks.getFiles,
    saveFiles: mocks.saveFiles
  })
}))

vi.mock('@/platform/telemetry/reportError', () => ({
  reportError: mocks.reportError
}))

vi.mock('@/stores/workspace/colorPaletteStore', () => ({
  useColorPaletteStore: () => ({
    completedActivePalette: { light_theme: mocks.lightTheme }
  })
}))

vi.mock('@/components/ui/button/Button.vue', () => ({
  default: {
    name: 'Button',
    template: '<button><slot /></button>'
  }
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      customNodePacks: {
        editor: {
          workbench: {
            explorer: 'Explorer',
            loading: 'Opening checkerboard template…',
            retry: 'Try again',
            loadFailed: 'Could not open files',
            saveFailed: 'Save failed',
            operationFailed: 'Operation failed',
            reloadRequired: 'Reload required',
            invalidPath: 'Invalid path',
            moveFile: 'Move File…',
            destinationPath: 'Project-relative destination',
            destinationPlaceholder: 'v2/nodes/helpers/example.py',
            move: 'Move',
            fileOperationUnsupported: 'Operation unsupported'
          }
        }
      },
      g: { cancel: 'Cancel' }
    }
  }
})

const initialFiles = {
  files: [
    { path: 'README.md', content: '# New Custom Node\n', editable: true },
    {
      path: 'v2/nodes/checkerboard.py',
      content: '# checkerboard starter\n',
      editable: true
    }
  ],
  directories: ['v2', 'v2/nodes', 'v2/web', 'v2/web/js'],
  initialPath: 'v2/nodes/checkerboard.py',
  digest: 'digest-1'
}

describe('CustomNodeTreeEditor', () => {
  beforeEach(() => {
    localStorage.clear()
    mocks.applyOperations.mockReset().mockResolvedValue({
      ...structuredClone(initialFiles),
      digest: 'digest-2'
    })
    mocks.changeListener.mockReset().mockReturnValue({ dispose: vi.fn() })
    mocks.currentPath!.value = undefined
    mocks.destroy.mockReset()
    mocks.explorerPanel!.value = 'Explorer'
    mocks.fileTreeLoaded = undefined
    mocks.getFiles.mockReset().mockResolvedValue(structuredClone(initialFiles))
    mocks.getValue.mockReset()
    mocks.hasChanged.mockReset().mockReturnValue(false)
    mocks.lightTheme = false
    mocks.modelCreated = undefined
    mocks.models = [
      {
        dispose: vi.fn(),
        getLanguageId: () => 'md',
        uri: { path: '/README.md' }
      },
      {
        dispose: vi.fn(),
        getLanguageId: () => 'py',
        uri: { path: '/v2/nodes/checkerboard.py' }
      }
    ]
    mocks.openOrFocusPath.mockReset()
    mocks.openedFiles!.value = []
    mocks.reportError.mockReset()
    mocks.resize.mockReset()
    mocks.resizeCallback = undefined
    mocks.restoreModel.mockReset().mockReturnValue({})
    mocks.saveFiles.mockReset().mockResolvedValue(structuredClone(initialFiles))
    mocks.setModelLanguage.mockReset()
    mocks.setOpenedFiles.mockReset()
    mocks.stopFileTreeListener.mockReset()
    mocks.stopModelCreationListener.mockReset()
    mocks.switchCurrentLeftSiderBar
      .mockReset()
      .mockImplementation(
        (panel: 'Explorer' | 'Setting' | undefined) =>
          (mocks.explorerPanel!.value = panel)
      )
  })

  it('loads the tree, follows the app theme, and opens checkerboard.py', async () => {
    render(CustomNodeTreeEditor, {
      props: {
        sessionId: 'session-1',
        stateKey: 'editor-state-key',
        packName: 'New Custom Node'
      },
      global: { plugins: [i18n] }
    })

    const editor = await screen.findByTestId('library-editor')
    await waitFor(() => {
      expect(editor).toHaveTextContent(
        '/New Custom Node/v2/nodes/checkerboard.py'
      )
      expect(mocks.restoreModel).toHaveBeenCalledWith(
        '/v2/nodes/checkerboard.py'
      )
      expect(mocks.openOrFocusPath).toHaveBeenCalledWith(
        '/v2/nodes/checkerboard.py'
      )
    })
    expect(editor).toHaveAttribute('data-theme', 'dark')
    expect(mocks.setModelLanguage).toHaveBeenCalledWith(
      mocks.models[0],
      'markdown'
    )
    expect(mocks.setModelLanguage).toHaveBeenCalledWith(
      mocks.models[1],
      'python'
    )
    const newlyCreatedPythonModel = {
      dispose: vi.fn(),
      getLanguageId: () => 'plaintext',
      uri: { path: '/v2/nodes/checkerboard.py' }
    }
    mocks.modelCreated?.(newlyCreatedPythonModel)
    expect(mocks.setModelLanguage).toHaveBeenCalledWith(
      newlyCreatedPythonModel,
      'python'
    )
    expect(screen.queryByText(/Getting Started/i)).not.toBeInTheDocument()
  })

  it('translates package paths and toggles Explorer while resizing', async () => {
    const user = userEvent.setup()
    const view = render(CustomNodeTreeEditor, {
      props: {
        explorerOpen: true,
        sessionId: 'session-1',
        stateKey: 'editor-state-key',
        packName: 'New Custom Node'
      },
      global: { plugins: [i18n] }
    })

    await screen.findByTestId('library-editor')
    await user.click(screen.getByRole('button', { name: 'Save checkerboard' }))

    await waitFor(() =>
      expect(mocks.saveFiles).toHaveBeenCalledWith('session-1', [
        {
          path: 'v2/nodes/checkerboard.py',
          content: '# changed\n',
          editable: true
        }
      ])
    )

    mocks.resizeCallback?.([{ contentRect: { width: 640 } }])
    expect(mocks.resize).toHaveBeenCalled()

    await view.rerender({ explorerOpen: false })
    expect(mocks.switchCurrentLeftSiderBar).toHaveBeenLastCalledWith(
      undefined,
      false
    )

    await view.rerender({ explorerOpen: true })
    expect(mocks.switchCurrentLeftSiderBar).toHaveBeenLastCalledWith(
      'Explorer',
      false
    )
  })

  it('creates folders and files, moves files, and deletes files with structured operations', async () => {
    const user = userEvent.setup()
    let revision = 1
    mocks.applyOperations.mockImplementation(async () => ({
      ...structuredClone(initialFiles),
      directories: [
        ...initialFiles.directories,
        ...(revision > 0 ? ['v2/nodes/helpers'] : [])
      ],
      digest: `digest-${++revision}`
    }))
    render(CustomNodeTreeEditor, {
      props: {
        sessionId: 'session-1',
        stateKey: 'editor-state-key',
        packName: 'New Custom Node'
      },
      global: { plugins: [i18n] }
    })

    await screen.findByTestId('library-editor')
    await user.click(screen.getByRole('button', { name: 'New helpers folder' }))
    await waitFor(() => expect(mocks.applyOperations).toHaveBeenCalledTimes(1))
    expect(mocks.applyOperations).toHaveBeenNthCalledWith(
      1,
      'session-1',
      [{ kind: 'create_directory', path: 'v2/nodes/helpers' }],
      'digest-1'
    )

    await user.click(screen.getByRole('button', { name: 'New node file' }))
    await waitFor(() => expect(mocks.applyOperations).toHaveBeenCalledTimes(2))
    expect(mocks.applyOperations).toHaveBeenNthCalledWith(
      2,
      'session-1',
      [{ kind: 'create_file', path: 'v2/nodes/new_node.py', content: '' }],
      'digest-2'
    )

    await user.click(screen.getByRole('button', { name: 'Rename readme' }))
    await waitFor(() => expect(mocks.applyOperations).toHaveBeenCalledTimes(3))
    expect(mocks.applyOperations).toHaveBeenNthCalledWith(
      3,
      'session-1',
      [
        {
          kind: 'move_file',
          path: 'README.md',
          destination: 'GUIDE.md'
        }
      ],
      'digest-3'
    )

    await user.click(
      screen.getByRole('button', { name: 'Move readme to folder' })
    )
    const destination = screen.getByRole('textbox', {
      name: 'Project-relative destination'
    })
    await user.clear(destination)
    await user.type(destination, 'v2/GUIDE.md')
    await user.click(screen.getByRole('button', { name: 'Move' }))
    await waitFor(() => expect(mocks.applyOperations).toHaveBeenCalledTimes(4))
    expect(mocks.applyOperations).toHaveBeenNthCalledWith(
      4,
      'session-1',
      [
        {
          kind: 'move_file',
          path: 'README.md',
          destination: 'v2/GUIDE.md'
        }
      ],
      'digest-4'
    )

    await user.click(
      screen.getByRole('button', { name: 'Delete browser extension' })
    )
    await waitFor(() => expect(mocks.applyOperations).toHaveBeenCalledTimes(5))
    expect(mocks.applyOperations).toHaveBeenNthCalledWith(
      5,
      'session-1',
      [{ kind: 'delete_file', path: 'v2/web/js/checkerboard.js' }],
      'digest-5'
    )
  })

  it('uses Monaco light mode when the active Comfy palette is light', async () => {
    mocks.lightTheme = true
    render(CustomNodeTreeEditor, {
      props: {
        sessionId: 'session-1',
        stateKey: 'editor-state-key',
        packName: 'New Custom Node'
      },
      global: { plugins: [i18n] }
    })

    expect(await screen.findByTestId('library-editor')).toHaveAttribute(
      'data-theme',
      'light'
    )
  })

  it('restores open files, the active file, and Explorer width for the pack', async () => {
    updateCustomNodeEditorState('editor-state-key', {
      activePath: 'README.md',
      openedPaths: ['README.md', 'v2/nodes/checkerboard.py'],
      explorerOpen: false,
      explorerWidth: 260
    })

    render(CustomNodeTreeEditor, {
      props: {
        sessionId: 'session-1',
        stateKey: 'editor-state-key',
        packName: 'New Custom Node'
      },
      global: { plugins: [i18n] }
    })

    expect(await screen.findByTestId('library-editor')).toHaveAttribute(
      'data-explorer-width',
      '260'
    )
    await waitFor(() => {
      expect(mocks.setOpenedFiles).toHaveBeenCalledWith([
        { path: '/README.md' },
        { path: '/v2/nodes/checkerboard.py' }
      ])
      expect(mocks.restoreModel).toHaveBeenCalledWith('/README.md')
      expect(mocks.openOrFocusPath).toHaveBeenCalledWith('/README.md')
    })
    expect(mocks.switchCurrentLeftSiderBar).toHaveBeenCalledWith(
      undefined,
      false
    )
  })

  it('persists tab navigation without storing source content', async () => {
    render(CustomNodeTreeEditor, {
      props: {
        sessionId: 'session-1',
        stateKey: 'editor-state-key',
        packName: 'New Custom Node'
      },
      global: { plugins: [i18n] }
    })

    await waitFor(() =>
      expect(mocks.openOrFocusPath).toHaveBeenCalledWith(
        '/v2/nodes/checkerboard.py'
      )
    )
    mocks.openedFiles!.value = [
      { path: '/README.md' },
      { path: '/v2/nodes/checkerboard.py' }
    ]
    mocks.currentPath!.value = '/README.md'

    await waitFor(() => {
      expect(readCustomNodeEditorState('editor-state-key')).toMatchObject({
        activePath: 'README.md',
        openedPaths: ['README.md', 'v2/nodes/checkerboard.py']
      })
    })
    expect(localStorage.getItem('editor-state-key')).not.toContain(
      '# checkerboard starter'
    )
  })
})
