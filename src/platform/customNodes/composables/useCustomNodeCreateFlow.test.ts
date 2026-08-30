import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  RequestError: class CustomNodeEditorRequestError extends Error {
    constructor(
      message: string,
      readonly status: number
    ) {
      super(message)
    }
  },
  addNodeOnGraph: vi.fn(),
  closeDialog: vi.fn(),
  createSession: vi.fn(),
  nodeDefsByName: {} as Record<string, { name: string; python_module: string }>,
  packs: {
    value: [] as { revisionId: string; name: string; uploadedAt: string }[]
  },
  refresh: vi.fn(),
  refreshNodeDefinitions: vi.fn(),
  showDialog: vi.fn(),
  showEditor: vi.fn(),
  toast: vi.fn()
}))

vi.mock('@/i18n', () => ({
  t: (key: string) =>
    ({
      'customNodePacks.createDialog.defaultPackName': 'New Node Pack',
      'customNodePacks.createDialog.defaultNodeName': 'New Node'
    })[key] ?? key
}))

vi.mock('@/platform/telemetry/reportError', () => ({ reportError: vi.fn() }))
vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: () => ({ add: mocks.toast })
}))
vi.mock('@/services/litegraphService', () => ({
  useLitegraphService: () => ({ addNodeOnGraph: mocks.addNodeOnGraph })
}))
vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: () => ({
    showDialog: mocks.showDialog,
    closeDialog: mocks.closeDialog
  })
}))
vi.mock('@/stores/nodeDefStore', () => ({
  useNodeDefStore: () => ({ nodeDefsByName: mocks.nodeDefsByName })
}))
vi.mock('./useCustomNodeEditorDialog', () => ({
  useCustomNodeEditorDialog: () => ({ show: mocks.showEditor })
}))
vi.mock('./useCustomNodePacks', () => ({
  useCustomNodePacks: () => ({ packs: mocks.packs, refresh: mocks.refresh })
}))

vi.mock('./useCustomNodeEditor', () => ({
  CustomNodeEditorRequestError: mocks.RequestError,
  useCustomNodeEditor: () => ({
    createSession: mocks.createSession,
    refreshNodeDefinitions: mocks.refreshNodeDefinitions
  })
}))

import { useCustomNodeCreateFlow } from './useCustomNodeCreateFlow'

interface DialogProps {
  defaultPackName?: string
  defaultNodeName?: string
  existingPackNames?: string[]
  existingNodeClassNames?: string[]
  targetPackName?: string
  onSubmit: (request: {
    packName: string
    nodeName: string
    prompt: string
  }) => void
  onCancel: () => void
}

/** Captures the props the create dialog was opened with. */
let lastDialogProps: DialogProps | undefined

function answerDialog(
  answer: { packName: string; nodeName: string; prompt: string } | null
) {
  mocks.showDialog.mockImplementation(({ props }: { props: DialogProps }) => {
    lastDialogProps = props
    if (answer) props.onSubmit(answer)
    else props.onCancel()
  })
}

describe('useCustomNodeCreateFlow', () => {
  beforeEach(() => {
    lastDialogProps = undefined
    mocks.packs.value = []
    mocks.nodeDefsByName = {}
    mocks.addNodeOnGraph.mockReset()
    mocks.closeDialog.mockReset()
    mocks.createSession.mockReset().mockResolvedValue({ id: 'session-1' })
    mocks.refresh.mockReset().mockResolvedValue(undefined)
    mocks.refreshNodeDefinitions.mockReset().mockResolvedValue(undefined)
    mocks.showDialog.mockReset()
    mocks.showEditor.mockReset()
    mocks.toast.mockReset()
  })

  it('suggests an unused pack name and creates with the chosen names', async () => {
    mocks.packs.value = [
      { revisionId: 'a-x1', name: 'New Node Pack', uploadedAt: '' },
      { revisionId: 'b-x2', name: 'New Node Pack (2)', uploadedAt: '' }
    ]
    answerDialog({ packName: 'Blur Pack', nodeName: 'Cool Blur', prompt: '' })

    await useCustomNodeCreateFlow().startCreateFlow()

    expect(lastDialogProps?.defaultPackName).toBe('New Node Pack (3)')
    expect(lastDialogProps?.defaultNodeName).toBe('New Node')
    expect(lastDialogProps?.existingPackNames).toEqual([
      'New Node Pack',
      'New Node Pack (2)'
    ])
    expect(mocks.createSession).toHaveBeenCalledWith({
      mode: 'create',
      name: 'Blur Pack',
      revisionId: undefined,
      nodeName: 'Cool Blur'
    })
    expect(mocks.showEditor).toHaveBeenCalledWith(
      { id: 'session-1' },
      expect.any(Function),
      { initialPrompt: '' }
    )
  })

  it('suggests an unused node name inside the target pack', async () => {
    const pack = {
      revisionId: 'alpha-x01234567',
      name: 'Alpha Pack',
      uploadedAt: ''
    }
    mocks.packs.value = [pack]
    mocks.nodeDefsByName = {
      NewNode: {
        name: 'NewNode',
        python_module: 'custom_nodes.pack_alpha_x01234567.nodes.new_node'
      },
      Unrelated: { name: 'Unrelated', python_module: 'nodes' }
    }
    answerDialog({ packName: 'Alpha Pack', nodeName: 'Second', prompt: '' })

    await useCustomNodeCreateFlow().startCreateFlow(pack)

    expect(lastDialogProps?.targetPackName).toBe('Alpha Pack')
    expect(lastDialogProps?.defaultNodeName).toBe('New Node (2)')
    expect(lastDialogProps?.existingNodeClassNames).toEqual(['NewNode'])
    expect(mocks.createSession).toHaveBeenCalledWith({
      mode: 'edit',
      name: 'Alpha Pack',
      revisionId: 'alpha-x01234567',
      nodeName: 'Second'
    })
  })

  it('does nothing when the dialog is cancelled', async () => {
    answerDialog(null)

    await useCustomNodeCreateFlow().startCreateFlow()

    expect(mocks.createSession).not.toHaveBeenCalled()
    expect(mocks.showEditor).not.toHaveBeenCalled()
  })

  it('passes an initial prompt through to the editor', async () => {
    answerDialog({
      packName: 'Blur Pack',
      nodeName: 'Cool Blur',
      prompt: 'blur the image'
    })

    await useCustomNodeCreateFlow().startCreateFlow()

    expect(mocks.showEditor).toHaveBeenCalledWith(
      { id: 'session-1' },
      expect.any(Function),
      { initialPrompt: 'blur the image' }
    )
  })

  it('adds the created node to the graph once the pack is submitted', async () => {
    answerDialog({ packName: 'Blur Pack', nodeName: 'Cool Blur', prompt: '' })
    await useCustomNodeCreateFlow().startCreateFlow()

    const definition = {
      name: 'CoolBlur',
      python_module: 'custom_nodes.pack_blur_pack_x1.nodes.cool_blur'
    }
    mocks.nodeDefsByName = { CoolBlur: definition }
    const onSubmitted = mocks.showEditor.mock.calls[0][1] as () => Promise<void>
    await onSubmitted()

    expect(mocks.addNodeOnGraph).toHaveBeenCalledWith(definition)
  })

  it('keeps refreshing until the submitted node is registered', async () => {
    vi.useFakeTimers()
    try {
      answerDialog({ packName: 'Blur Pack', nodeName: 'Cool Blur', prompt: '' })
      await useCustomNodeCreateFlow().startCreateFlow()

      const definition = {
        name: 'CoolBlur',
        python_module: 'custom_nodes.pack_blur_pack_x1.nodes.cool_blur'
      }
      // The runtime installs the pack a few seconds after submit returns.
      mocks.refreshNodeDefinitions.mockImplementation(async () => {
        if (mocks.refreshNodeDefinitions.mock.calls.length >= 3) {
          Object.assign(mocks.nodeDefsByName, { CoolBlur: definition })
        }
      })
      const onSubmitted = mocks.showEditor.mock
        .calls[0][1] as () => Promise<void>
      const pending = onSubmitted()
      await vi.advanceTimersByTimeAsync(10_000)
      await pending

      expect(mocks.refreshNodeDefinitions).toHaveBeenCalledWith('session-1')
      expect(mocks.addNodeOnGraph).toHaveBeenCalledWith(definition)
    } finally {
      vi.useRealTimers()
    }
  })

  it('ignores a stale frontend-only node type from an earlier session', async () => {
    vi.useFakeTimers()
    try {
      answerDialog({ packName: 'Blur Pack', nodeName: 'Cool Blur', prompt: '' })
      await useCustomNodeCreateFlow().startCreateFlow()

      // Left over in LiteGraph by a previous pack: the backend cannot run it.
      const stale = {
        name: 'CoolBlur',
        python_module: 'custom_nodes.frontend_only'
      }
      const real = {
        name: 'CoolBlur',
        python_module: 'custom_nodes.pack_blur_pack_x1.nodes.cool_blur'
      }
      Object.assign(mocks.nodeDefsByName, { CoolBlur: stale })
      mocks.refreshNodeDefinitions.mockImplementation(async () => {
        if (mocks.refreshNodeDefinitions.mock.calls.length >= 2) {
          Object.assign(mocks.nodeDefsByName, { CoolBlur: real })
        }
      })

      const onSubmitted = mocks.showEditor.mock
        .calls[0][1] as () => Promise<void>
      const pending = onSubmitted()
      await vi.advanceTimersByTimeAsync(10_000)
      await pending

      expect(mocks.addNodeOnGraph).toHaveBeenCalledTimes(1)
      expect(mocks.addNodeOnGraph).toHaveBeenCalledWith(real)
    } finally {
      vi.useRealTimers()
    }
  })

  it('waits for the node from the revision just submitted', async () => {
    vi.useFakeTimers()
    try {
      mocks.packs.value = [
        { revisionId: 'blur-pack-xaaaa0001', name: 'Blur Pack', uploadedAt: '' }
      ]
      answerDialog({ packName: 'Blur Pack', nodeName: 'Cool Blur', prompt: '' })
      await useCustomNodeCreateFlow().startCreateFlow()

      // Same class name, but served by an older pack revision.
      const older = {
        name: 'CoolBlur',
        python_module: 'custom_nodes.pack_blur_pack_xbbbb0002.nodes.cool_blur'
      }
      const current = {
        name: 'CoolBlur',
        python_module: 'custom_nodes.pack_blur_pack_xaaaa0001.nodes.cool_blur'
      }
      Object.assign(mocks.nodeDefsByName, { CoolBlur: older })
      mocks.refreshNodeDefinitions.mockImplementation(async () => {
        if (mocks.refreshNodeDefinitions.mock.calls.length >= 2) {
          Object.assign(mocks.nodeDefsByName, { CoolBlur: current })
        }
      })

      const onSubmitted = mocks.showEditor.mock
        .calls[0][1] as () => Promise<void>
      const pending = onSubmitted()
      await vi.advanceTimersByTimeAsync(10_000)
      await pending

      expect(mocks.addNodeOnGraph).toHaveBeenCalledWith(current)
    } finally {
      vi.useRealTimers()
    }
  })

  it('warns instead of failing silently when the node never registers', async () => {
    vi.useFakeTimers()
    try {
      answerDialog({ packName: 'Blur Pack', nodeName: 'Cool Blur', prompt: '' })
      await useCustomNodeCreateFlow().startCreateFlow()

      const onSubmitted = mocks.showEditor.mock
        .calls[0][1] as () => Promise<void>
      const pending = onSubmitted()
      await vi.advanceTimersByTimeAsync(120_000)
      await pending

      expect(mocks.addNodeOnGraph).not.toHaveBeenCalled()
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'warn' })
      )
    } finally {
      vi.useRealTimers()
    }
  })

  it('reopens the dialog when the manager rejects the name', async () => {
    let attempts = 0
    mocks.showDialog.mockImplementation(({ props }: { props: DialogProps }) => {
      lastDialogProps = props
      attempts += 1
      if (attempts === 1) {
        props.onSubmit({ packName: 'P', nodeName: 'Taken', prompt: '' })
      } else {
        props.onCancel()
      }
    })
    mocks.createSession.mockRejectedValue(
      new mocks.RequestError('a node named Taken already exists', 409)
    )

    await useCustomNodeCreateFlow().startCreateFlow()

    expect(attempts).toBe(2)
    // The rejected values come back so the user can adjust them.
    expect(lastDialogProps?.defaultNodeName).toBe('Taken')
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'warn' })
    )
    expect(mocks.showEditor).not.toHaveBeenCalled()
  })
})
