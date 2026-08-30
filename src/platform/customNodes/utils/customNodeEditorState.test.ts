import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  customNodeEditorStateKey,
  migrateCustomNodeEditorState,
  readCustomNodeEditorState,
  updateCustomNodeEditorState
} from './customNodeEditorState'

describe('customNodeEditorState', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('stores only bounded navigation and layout state per workspace and pack', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1234)
    const key = customNodeEditorStateKey('workspace-1', 'My Pack')

    updateCustomNodeEditorState(key, {
      activePath: 'v2/nodes/node.py',
      openedPaths: ['v2/nodes/node.py', 'v2/nodes/node.py', '../outside.py'],
      explorerOpen: false,
      explorerWidth: 900,
      agentOpen: true
    })

    expect(key).toBe('Comfy.CustomNodeEditorState.v1:workspace-1:My%20Pack')
    expect(readCustomNodeEditorState(key)).toEqual({
      version: 1,
      updatedAt: 1234,
      activePath: 'v2/nodes/node.py',
      openedPaths: ['v2/nodes/node.py'],
      explorerOpen: false,
      explorerWidth: 640,
      agentOpen: true
    })
    expect(localStorage.getItem(key)).not.toContain('content')
  })

  it('migrates state when a pack is renamed', () => {
    const previousKey = customNodeEditorStateKey('workspace-1', 'Old Name')
    const nextKey = customNodeEditorStateKey('workspace-1', 'New Name')
    updateCustomNodeEditorState(previousKey, {
      activePath: 'README.md',
      agentOpen: false
    })

    migrateCustomNodeEditorState(previousKey, nextKey)

    expect(readCustomNodeEditorState(previousKey)).toBeNull()
    expect(readCustomNodeEditorState(nextKey)).toMatchObject({
      activePath: 'README.md',
      agentOpen: false
    })
  })

  it('ignores malformed or unavailable local storage', () => {
    const key = customNodeEditorStateKey(null, 'Pack')
    localStorage.setItem(key, '{not json')
    expect(readCustomNodeEditorState(key)).toBeNull()

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage blocked', 'SecurityError')
    })
    expect(() =>
      updateCustomNodeEditorState(key, { agentOpen: true })
    ).not.toThrow()
  })
})
