import { beforeEach, describe, expect, it, vi } from 'vitest'

import { reportError } from '@comfyorg/telemetry/reportError'

import type { DraftIndexV2, DraftPayloadV2 } from './draftTypes'
import {
  clearActivePath,
  clearAllWorkspaceStorage,
  clearAllWorkflowStorage,
  clearUnscopedDraftStorage,
  clearWorkflowRestoreState,
  deleteOrphanPayloads,
  deletePayload,
  deletePayloads,
  getPayloadKeys,
  markStorageUnavailable,
  measureLocalStorage,
  readActivePath,
  readIndex,
  readOpenPaths,
  readPayload,
  writeActivePath,
  writeIndex,
  writeOpenPaths,
  writePayload
} from './storageIO'

vi.mock(import('@comfyorg/telemetry/reportError'), { spy: true })

describe('storageIO', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  describe('index operations', () => {
    const workspaceId = 'test-workspace'

    it('reads and writes index', () => {
      const index: DraftIndexV2 = {
        v: 2,
        updatedAt: Date.now(),
        order: ['abc123'],
        entries: {
          abc123: {
            path: 'workflows/test.json',
            name: 'test',
            isTemporary: true,
            updatedAt: Date.now()
          }
        }
      }

      expect(writeIndex(workspaceId, index)).toBe(true)

      const read = readIndex(workspaceId)
      expect(read).not.toBeNull()
      expect(read!.v).toBe(2)
      expect(read!.order).toEqual(['abc123'])
    })

    it('returns null for missing index', () => {
      expect(readIndex(workspaceId)).toBeNull()
    })

    it('returns null for invalid JSON', () => {
      localStorage.setItem(
        'Comfy.Workflow.DraftIndex.v2:test-workspace',
        'invalid'
      )
      expect(readIndex(workspaceId)).toBeNull()
    })

    it('returns null for wrong version', () => {
      localStorage.setItem(
        'Comfy.Workflow.DraftIndex.v2:test-workspace',
        JSON.stringify({ v: 1 })
      )
      expect(readIndex(workspaceId)).toBeNull()
    })
  })

  describe('payload operations', () => {
    const workspaceId = 'test-workspace'
    const draftKey = 'abc12345'

    it('reads and writes payload', () => {
      const payload: DraftPayloadV2 = {
        data: '{"nodes":[]}',
        updatedAt: Date.now()
      }

      expect(writePayload(workspaceId, draftKey, payload)).toBe(true)

      const read = readPayload(workspaceId, draftKey)
      expect(read).not.toBeNull()
      expect(read!.data).toBe('{"nodes":[]}')
    })

    it('returns null for missing payload', () => {
      expect(readPayload(workspaceId, 'missing')).toBeNull()
    })

    it('deletes payload', () => {
      const payload: DraftPayloadV2 = {
        data: '{}',
        updatedAt: Date.now()
      }
      writePayload(workspaceId, draftKey, payload)
      expect(readPayload(workspaceId, draftKey)).not.toBeNull()

      deletePayload(workspaceId, draftKey)
      expect(readPayload(workspaceId, draftKey)).toBeNull()
    })

    it('deletes multiple payloads', () => {
      writePayload(workspaceId, 'key1', { data: '{}', updatedAt: 1 })
      writePayload(workspaceId, 'key2', { data: '{}', updatedAt: 2 })
      writePayload(workspaceId, 'key3', { data: '{}', updatedAt: 3 })

      deletePayloads(workspaceId, ['key1', 'key3'])

      expect(readPayload(workspaceId, 'key1')).toBeNull()
      expect(readPayload(workspaceId, 'key2')).not.toBeNull()
      expect(readPayload(workspaceId, 'key3')).toBeNull()
    })
  })

  describe('getPayloadKeys', () => {
    it('returns all payload keys for workspace', () => {
      localStorage.setItem('Comfy.Workflow.Draft.v2:ws-1:abc', '{"data":""}')
      localStorage.setItem('Comfy.Workflow.Draft.v2:ws-1:def', '{"data":""}')
      localStorage.setItem('Comfy.Workflow.Draft.v2:ws-2:ghi', '{"data":""}')
      localStorage.setItem('unrelated-key', 'value')

      const keys = getPayloadKeys('ws-1')
      expect(keys).toHaveLength(2)
      expect(keys).toContain('abc')
      expect(keys).toContain('def')
    })
  })

  describe('deleteOrphanPayloads', () => {
    it('deletes payloads not in index', () => {
      localStorage.setItem('Comfy.Workflow.Draft.v2:ws-1:keep', '{"data":""}')
      localStorage.setItem(
        'Comfy.Workflow.Draft.v2:ws-1:orphan1',
        '{"data":""}'
      )
      localStorage.setItem(
        'Comfy.Workflow.Draft.v2:ws-1:orphan2',
        '{"data":""}'
      )

      const indexKeys = new Set(['keep'])
      const deleted = deleteOrphanPayloads('ws-1', indexKeys)

      expect(deleted).toBe(2)
      expect(getPayloadKeys('ws-1')).toEqual(['keep'])
    })
  })

  describe('session storage pointers', () => {
    const clientId = 'client-abc'

    it('reads and writes active path pointer', () => {
      const pointer = { workspaceId: 'ws-1', path: 'workflows/test.json' }
      writeActivePath(clientId, pointer)

      const read = readActivePath(clientId)
      expect(read).toEqual(pointer)
    })

    it('returns null for missing active path', () => {
      expect(readActivePath('missing')).toBeNull()
    })

    it('reads and writes open paths pointer', () => {
      const pointer = {
        workspaceId: 'ws-1',
        paths: ['workflows/a.json', 'workflows/b.json'],
        activeIndex: 1
      }
      writeOpenPaths(clientId, pointer)

      const read = readOpenPaths(clientId)
      expect(read).toEqual(pointer)
    })

    it('returns null for missing open paths', () => {
      expect(readOpenPaths('missing')).toBeNull()
    })

    it('falls back to workspace search when clientId does not match and migrates', () => {
      const oldClientId = 'old-client'
      const newClientId = 'new-client'
      const workspaceId = 'ws-123'

      // Store pointer with old clientId
      const pointer = {
        workspaceId,
        paths: ['workflows/a.json', 'workflows/b.json'],
        activeIndex: 0
      }
      writeOpenPaths(oldClientId, pointer)

      // Read with new clientId but same workspace - should find via fallback
      const read = readOpenPaths(newClientId, workspaceId)
      expect(read).toEqual(pointer)

      // Should have migrated to new key and removed old key
      const oldKey = `Comfy.Workflow.OpenPaths:${oldClientId}`
      const newKey = `Comfy.Workflow.OpenPaths:${newClientId}`
      expect(sessionStorage.getItem(oldKey)).toBeNull()
      expect(sessionStorage.getItem(newKey)).not.toBeNull()
    })

    it('does not fall back to different workspace pointer', () => {
      const oldClientId = 'old-client'
      const newClientId = 'new-client'

      // Store pointer for workspace-A
      writeOpenPaths(oldClientId, {
        workspaceId: 'workspace-A',
        paths: ['workflows/a.json'],
        activeIndex: 0
      })

      // Read with new clientId looking for workspace-B - should not find
      const read = readOpenPaths(newClientId, 'workspace-B')
      expect(read).toBeNull()
    })

    it('prefers exact clientId match over fallback search', () => {
      const clientId = 'my-client'
      const workspaceId = 'ws-123'

      // Store pointer with different clientId for same workspace
      writeOpenPaths('other-client', {
        workspaceId,
        paths: ['workflows/old.json'],
        activeIndex: 0
      })

      // Store pointer with exact clientId match
      const exactPointer = {
        workspaceId,
        paths: ['workflows/exact.json'],
        activeIndex: 0
      }
      writeOpenPaths(clientId, exactPointer)

      // Should return exact match, not fallback
      const read = readOpenPaths(clientId, workspaceId)
      expect(read).toEqual(exactPointer)
    })

    it('removes stale exact match from wrong workspace and falls back', () => {
      const clientId = 'my-client'

      // Store pointer for workspace-A under this clientId
      writeActivePath(clientId, {
        workspaceId: 'ws-A',
        path: 'workflows/stale.json'
      })

      // Store pointer for workspace-B under a different clientId
      writeActivePath('old-client', {
        workspaceId: 'ws-B',
        path: 'workflows/correct.json'
      })

      // Reading with workspace-B should skip the stale ws-A pointer and find the fallback
      const result = readActivePath(clientId, 'ws-B')
      expect(result).toEqual({
        workspaceId: 'ws-B',
        path: 'workflows/correct.json'
      })

      // Stale pointer should have been removed
      const raw = sessionStorage.getItem(
        `Comfy.Workflow.ActivePath:${clientId}`
      )
      expect(JSON.parse(raw!).workspaceId).toBe('ws-B')
    })

    describe('when the client id changes on every page load', () => {
      const workspaceId = 'ws-reload'

      it('restores the open tabs written last, not an older list', () => {
        writeOpenPaths('load-1', {
          workspaceId,
          paths: ['workflows/a.json', 'workflows/b.json', 'workflows/c.json'],
          activeIndex: 0
        })

        const latest = {
          workspaceId,
          paths: ['workflows/c.json', 'workflows/a.json'],
          activeIndex: 0
        }
        writeOpenPaths('load-2', latest)

        expect(readOpenPaths('load-3', workspaceId)).toEqual(latest)
      })

      it('restores the active tab written last, not an older one', () => {
        writeActivePath('load-1', { workspaceId, path: 'workflows/a.json' })
        writeActivePath('load-2', { workspaceId, path: 'workflows/c.json' })

        expect(readActivePath('load-3', workspaceId)).toEqual({
          workspaceId,
          path: 'workflows/c.json'
        })
      })

      it('prefers the previous page load’s tabs over older leftovers', () => {
        const older = {
          workspaceId,
          paths: ['workflows/a.json', 'workflows/b.json'],
          activeIndex: 0
        }
        const latest = {
          workspaceId,
          paths: ['workflows/b.json'],
          activeIndex: 0
        }
        sessionStorage.setItem(
          'Comfy.Workflow.OpenPaths:load-1',
          JSON.stringify(older)
        )
        sessionStorage.setItem(
          'Comfy.Workflow.OpenPaths:load-2',
          JSON.stringify(latest)
        )

        expect(readOpenPaths('load-3', workspaceId, 'load-2')).toEqual(latest)
      })

      it('prefers the previous page load’s active tab over older leftovers', () => {
        sessionStorage.setItem(
          'Comfy.Workflow.ActivePath:load-1',
          JSON.stringify({ workspaceId, path: 'workflows/a.json' })
        )
        sessionStorage.setItem(
          'Comfy.Workflow.ActivePath:load-2',
          JSON.stringify({ workspaceId, path: 'workflows/b.json' })
        )

        expect(readActivePath('load-3', workspaceId, 'load-2')).toEqual({
          workspaceId,
          path: 'workflows/b.json'
        })
      })

      it('drops every older tab list for the workspace when writing', () => {
        sessionStorage.setItem(
          'Comfy.Workflow.OpenPaths:load-1',
          JSON.stringify({
            workspaceId,
            paths: ['workflows/load-1.json'],
            activeIndex: 0
          })
        )
        sessionStorage.setItem(
          'Comfy.Workflow.OpenPaths:load-2',
          JSON.stringify({
            workspaceId,
            paths: ['workflows/load-2.json'],
            activeIndex: 0
          })
        )
        sessionStorage.setItem(
          'Comfy.Workflow.OpenPaths:load-3',
          JSON.stringify({
            workspaceId,
            paths: ['workflows/load-3.json'],
            activeIndex: 0
          })
        )
        const latest = {
          workspaceId,
          paths: ['workflows/latest.json'],
          activeIndex: 0
        }
        writeOpenPaths('load-4', latest)

        expect(
          sessionStorage.getItem('Comfy.Workflow.OpenPaths:load-1')
        ).toBeNull()
        expect(
          sessionStorage.getItem('Comfy.Workflow.OpenPaths:load-2')
        ).toBeNull()
        expect(
          sessionStorage.getItem('Comfy.Workflow.OpenPaths:load-3')
        ).toBeNull()
        expect(readOpenPaths('load-5', workspaceId)).toEqual(latest)
      })

      it('restores the latest saved tabs when the session copy cannot be written', () => {
        writeOpenPaths('load-1', {
          workspaceId,
          paths: ['workflows/old.json'],
          activeIndex: 0
        })
        const latest = {
          workspaceId,
          paths: ['workflows/latest.json'],
          activeIndex: 0
        }
        const setItem = vi
          .spyOn(sessionStorage, 'setItem')
          .mockImplementation(() => {
            throw new DOMException('full', 'QuotaExceededError')
          })
        writeOpenPaths('load-2', latest)
        setItem.mockRestore()

        expect(readOpenPaths('load-3', workspaceId)).toEqual(latest)
      })

      it('forgets the active tab saved under the previous page load’s id', () => {
        writeActivePath('load-1', { workspaceId, path: 'workflows/a.json' })
        clearActivePath('load-2', workspaceId)

        expect(readActivePath('load-3', workspaceId)).toBeNull()
      })

      it('keeps another workspace’s tabs when writing this one', () => {
        const other = {
          workspaceId: 'ws-other',
          paths: ['workflows/other.json'],
          activeIndex: 0
        }
        writeOpenPaths('load-1', other)
        writeOpenPaths('load-2', {
          workspaceId,
          paths: ['workflows/a.json'],
          activeIndex: 0
        })

        expect(readOpenPaths('load-3', 'ws-other')).toEqual(other)
      })
    })
  })

  describe('clearUnscopedDraftStorage', () => {
    it('removes draft keys without an account scope and V1 drafts', () => {
      localStorage.setItem('Comfy.Workflow.DraftIndex.v2:personal', '{}')
      localStorage.setItem('Comfy.Workflow.Draft.v2:personal:abc', '{}')
      localStorage.setItem('Comfy.Workflow.Draft.v2:ws-2:def', '{}')
      localStorage.setItem('Comfy.Workflow.Drafts:personal', '{}')
      localStorage.setItem('Comfy.Workflow.DraftOrder:personal', '[]')
      localStorage.setItem('Comfy.Workflow.Drafts', '{}')
      localStorage.setItem('Comfy.Workflow.DraftOrder', '[]')
      localStorage.setItem('Comfy.Workflow.DraftIndex.v2:user-a:personal', '{}')
      localStorage.setItem('Comfy.Workflow.Draft.v2:user-a:personal:abc', '{}')
      localStorage.setItem('Comfy.Workflow.Draft.v2:user-b:ws-2:def', '{}')
      localStorage.setItem(
        'Comfy.Workflow.Draft.v2:unauthenticated:personal:abc',
        '{}'
      )
      localStorage.setItem('unrelated', 'keep')

      clearUnscopedDraftStorage()

      const remaining = [...Array(localStorage.length)].map((_, index) =>
        localStorage.key(index)
      )
      expect(remaining).toHaveLength(5)
      expect(remaining).toEqual(
        expect.arrayContaining([
          'Comfy.Workflow.Draft.v2:unauthenticated:personal:abc',
          'Comfy.Workflow.Draft.v2:user-a:personal:abc',
          'Comfy.Workflow.Draft.v2:user-b:ws-2:def',
          'Comfy.Workflow.DraftIndex.v2:user-a:personal',
          'unrelated'
        ])
      )
    })
  })

  describe('clearAllWorkflowStorage', () => {
    it('clears all restorable workflow keys from localStorage', () => {
      localStorage.setItem('Comfy.Workflow.DraftIndex.v2:ws-1', '{}')
      localStorage.setItem('Comfy.Workflow.Draft.v2:ws-1:abc', '{}')
      localStorage.setItem('Comfy.Workflow.Draft.v2:ws-2:def', '{}')
      localStorage.setItem('Comfy.Workflow.LastActivePath:ws-1', '{}')
      localStorage.setItem('Comfy.Workflow.LastOpenPaths:ws-1', '{}')
      localStorage.setItem('Comfy.Workflow.Drafts:ws-1', '{}')
      localStorage.setItem('Comfy.Workflow.DraftOrder:ws-1', '[]')
      localStorage.setItem('Comfy.Workflow.Drafts', '{}')
      localStorage.setItem('Comfy.Workflow.DraftOrder', '[]')
      localStorage.setItem('Comfy.OpenWorkflowsPaths', '[]')
      localStorage.setItem('Comfy.ActiveWorkflowIndex', '0')
      localStorage.setItem('Comfy.PreviousWorkflow', 'workflows/old.json')
      localStorage.setItem('workflow', '{}')
      localStorage.setItem('unrelated', 'keep')

      clearAllWorkflowStorage()

      expect(
        [...Array(localStorage.length)].map((_, index) =>
          localStorage.key(index)
        )
      ).toEqual(['unrelated'])
      expect(localStorage.getItem('unrelated')).toBe('keep')
    })

    it('clears all restorable workflow keys from sessionStorage', () => {
      sessionStorage.setItem('Comfy.Workflow.ActivePath:client-1', '{}')
      sessionStorage.setItem('Comfy.Workflow.OpenPaths:client-2', '{}')
      sessionStorage.setItem('Comfy.PreviousWorkflow', 'workflows/old.json')
      sessionStorage.setItem(
        'Comfy.PreviousWorkflow:client-1',
        'workflows/old.json'
      )
      sessionStorage.setItem('Comfy.OpenWorkflowsPaths:client-1', '[]')
      sessionStorage.setItem('Comfy.ActiveWorkflowIndex:client-1', '0')
      sessionStorage.setItem('workflow:client-1', '{}')
      sessionStorage.setItem('unrelated', 'keep')

      clearAllWorkflowStorage()

      expect(
        sessionStorage.getItem('Comfy.Workflow.ActivePath:client-1')
      ).toBeNull()
      expect(
        sessionStorage.getItem('Comfy.Workflow.OpenPaths:client-2')
      ).toBeNull()
      expect(
        sessionStorage.getItem('Comfy.PreviousWorkflow:client-1')
      ).toBeNull()
      expect(
        sessionStorage.getItem('Comfy.OpenWorkflowsPaths:client-1')
      ).toBeNull()
      expect(
        sessionStorage.getItem('Comfy.ActiveWorkflowIndex:client-1')
      ).toBeNull()
      expect(sessionStorage.getItem('workflow:client-1')).toBeNull()
      expect(sessionStorage.getItem('unrelated')).toBe('keep')
    })

    it('blocks workflow writes during logout cleanup', async () => {
      const isolatedStorageIO = await import('./storageIO')

      isolatedStorageIO.prepareWorkflowLogoutTransition()
      isolatedStorageIO.clearAllWorkflowStorage()

      expect(isolatedStorageIO.isStorageAvailable()).toBe(false)
      expect(
        isolatedStorageIO.writeIndex('ws-1', {
          v: 2,
          updatedAt: 1,
          order: [],
          entries: {}
        })
      ).toBe(false)
      expect(
        isolatedStorageIO.writePayload('ws-1', 'draft-1', {
          data: '{}',
          updatedAt: 1
        })
      ).toBe(false)
      isolatedStorageIO.writeActivePath('client-1', {
        workspaceId: 'ws-1',
        path: 'workflows/a.json'
      })
      isolatedStorageIO.writeOpenPaths('client-1', {
        workspaceId: 'ws-1',
        paths: ['workflows/a.json'],
        activeIndex: 0
      })

      expect(localStorage).toHaveLength(0)
      expect(sessionStorage).toHaveLength(0)
    })

    it('clears persisted workflows after storage writes are disabled', () => {
      localStorage.setItem('Comfy.Workflow.LastActivePath:personal', '{}')
      sessionStorage.setItem('Comfy.Workflow.ActivePath:client-1', '{}')
      markStorageUnavailable()

      clearAllWorkflowStorage()

      expect(
        localStorage.getItem('Comfy.Workflow.LastActivePath:personal')
      ).toBeNull()
      expect(
        sessionStorage.getItem('Comfy.Workflow.ActivePath:client-1')
      ).toBeNull()
    })
  })

  describe('clearAllWorkspaceStorage', () => {
    it('forgets the build the account was following on logout', () => {
      sessionStorage.setItem('Comfy.Deployment.FollowedBuild', '{}')
      sessionStorage.setItem('unrelated', 'keep')

      clearAllWorkspaceStorage()

      expect(
        sessionStorage.getItem('Comfy.Deployment.FollowedBuild')
      ).toBeNull()
      expect(sessionStorage.getItem('unrelated')).toBe('keep')
    })

    it('clears scoped and legacy Agent persistence on account logout', () => {
      localStorage.setItem('Comfy.Agent.ThreadId:personal', 'thread-a')
      localStorage.setItem('Comfy.Agent.WorkflowTabBindings:ws-1', '{}')
      localStorage.setItem('Comfy.Agent.ChatTitles:ws-1', '{}')
      localStorage.setItem('Comfy.Agent.DeletedThreads:ws-1', '[]')
      localStorage.setItem('Comfy.Agent.PendingSendDraft:ws-1', '[]')
      localStorage.setItem('Comfy.Agent.ThreadId', 'legacy-thread')
      localStorage.setItem('Comfy.Agent.WorkflowTabBindings', '{}')
      localStorage.setItem('Comfy.Agent.WorkflowTabBindings.v2', '{}')
      localStorage.setItem('Comfy.Agent.ChatTitles', '{}')
      localStorage.setItem('Comfy.Agent.DeletedThreads', '[]')
      localStorage.setItem('unrelated', 'keep')

      clearAllWorkspaceStorage()

      expect(
        [...Array(localStorage.length)].map((_, index) =>
          localStorage.key(index)
        )
      ).toEqual(['unrelated'])
    })

    it('clears saved skill drafts on account logout', () => {
      localStorage.setItem('Comfy.Agent.SkillDrafts:["scope"]', '{}')
      localStorage.setItem('unrelated', 'keep')

      clearAllWorkspaceStorage()

      expect(
        [...Array(localStorage.length)].map((_, index) =>
          localStorage.key(index)
        )
      ).toEqual(['unrelated'])
    })
  })

  describe('workflow storage transitions', () => {
    it('blocks writes and clears restore state when a persistence flush fails', async () => {
      const isolatedStorageIO = await import('./storageIO')
      localStorage.setItem('workflow', '{}')
      const successfulFlush = vi.fn()
      const flushError = new DOMException(
        'Storage unavailable',
        'SecurityError'
      )
      isolatedStorageIO.registerWorkflowPersistence({
        flush: () => {
          throw flushError
        },
        cancel: () => {},
        resumeAfterAbort: () => {}
      })
      isolatedStorageIO.registerWorkflowPersistence({
        flush: successfulFlush,
        cancel: () => {},
        resumeAfterAbort: () => {}
      })

      expect(() =>
        isolatedStorageIO.prepareWorkflowWorkspaceTransition()
      ).not.toThrow()

      expect(successfulFlush).toHaveBeenCalledOnce()
      expect(localStorage.getItem('workflow')).toBeNull()
      expect(reportError).toHaveBeenCalledExactlyOnceWith(flushError, {
        surface: 'workspace',
        errorType: 'failure_flushing_workflow_persistence',
        level: 'error'
      })
    })

    it('resumes writes when a workspace transition is cancelled', async () => {
      const isolatedStorageIO = await import('./storageIO')

      const cancelTransition =
        isolatedStorageIO.prepareWorkflowWorkspaceTransition()
      expect(
        isolatedStorageIO.writePayload('ws-1', 'blocked', {
          data: '{}',
          updatedAt: 1
        })
      ).toBe(false)

      cancelTransition.release()

      expect(
        isolatedStorageIO.writePayload('ws-1', 'resumed', {
          data: '{}',
          updatedAt: 2
        })
      ).toBe(true)
    })

    it('preserves unavailable storage when a workspace transition is cancelled', async () => {
      const isolatedStorageIO = await import('./storageIO')

      isolatedStorageIO.markStorageUnavailable()
      const cancelTransition =
        isolatedStorageIO.prepareWorkflowWorkspaceTransition()
      cancelTransition.release()

      expect(isolatedStorageIO.isStorageAvailable()).toBe(false)
      expect(
        isolatedStorageIO.writePayload('ws-1', 'draft', {
          data: '{}',
          updatedAt: 1
        })
      ).toBe(false)
    })

    it('keeps a workspace transition fenced when logout completes', async () => {
      const isolatedStorageIO = await import('./storageIO')

      const cancelWorkspaceTransition =
        isolatedStorageIO.prepareWorkflowWorkspaceTransition()
      expect(isolatedStorageIO.isStorageAvailable()).toBe(false)

      const transition = isolatedStorageIO.prepareWorkflowLogoutTransition()
      expect(transition.release()).toBe(false)

      expect(isolatedStorageIO.isStorageAvailable()).toBe(false)
      cancelWorkspaceTransition.release()

      expect(isolatedStorageIO.isStorageAvailable()).toBe(true)
    })

    it('preserves unavailable storage after logout recovery', async () => {
      const isolatedStorageIO = await import('./storageIO')

      isolatedStorageIO.markStorageUnavailable()
      const transition = isolatedStorageIO.prepareWorkflowLogoutTransition()
      expect(transition.release()).toBe(true)

      expect(isolatedStorageIO.isStorageAvailable()).toBe(false)
    })

    it('fences logout writes before cancelling pending persistence', async () => {
      const isolatedStorageIO = await import('./storageIO')
      const writesDuringCancel: boolean[] = []
      isolatedStorageIO.registerWorkflowPersistence({
        flush: () => {},
        cancel: () =>
          writesDuringCancel.push(
            isolatedStorageIO.writePayload('ws-1', 'stale', {
              data: '{}',
              updatedAt: 1
            })
          ),
        resumeAfterAbort: () => {}
      })

      isolatedStorageIO.prepareWorkflowLogoutTransition()

      expect(writesDuringCancel).toEqual([false])
    })

    it('reports cancellation failure once and keeps logout writes fenced', async () => {
      const isolatedStorageIO = await import('./storageIO')
      const error = new DOMException('Cancellation failed', 'AbortError')
      const successfulCancel = vi.fn()
      isolatedStorageIO.registerWorkflowPersistence({
        flush: () => {},
        cancel: () => {
          throw error
        },
        resumeAfterAbort: () => {}
      })
      isolatedStorageIO.registerWorkflowPersistence({
        flush: () => {},
        cancel: successfulCancel,
        resumeAfterAbort: () => {}
      })

      expect(() =>
        isolatedStorageIO.prepareWorkflowLogoutTransition()
      ).not.toThrow()

      expect(reportError).toHaveBeenCalledExactlyOnceWith(error, {
        surface: 'workspace',
        errorType: 'failure_cancelling_workflow_persistence',
        level: 'error'
      })
      expect(isolatedStorageIO.isStorageAvailable()).toBe(false)
      expect(successfulCancel).toHaveBeenCalledOnce()
    })

    it('resumes only after every live logout transition settles', async () => {
      const isolatedStorageIO = await import('./storageIO')
      const resumeAfterAbort = vi.fn()
      isolatedStorageIO.registerWorkflowPersistence({
        flush: () => {},
        cancel: () => {},
        resumeAfterAbort
      })

      const accountSwitch = isolatedStorageIO.prepareWorkflowLogoutTransition()
      const failedLogout = isolatedStorageIO.prepareWorkflowLogoutTransition()
      expect(accountSwitch.release()).toBe(false)
      expect(failedLogout.abort()).toBe(true)
      expect(isolatedStorageIO.isStorageAvailable()).toBe(true)
      expect(resumeAfterAbort).toHaveBeenCalledOnce()
    })

    it('keeps overlapping failed logouts fenced until the last abort', async () => {
      const isolatedStorageIO = await import('./storageIO')
      const resumeAfterAbort = vi.fn()
      isolatedStorageIO.registerWorkflowPersistence({
        flush: () => {},
        cancel: () => {},
        resumeAfterAbort
      })

      const firstLogout = isolatedStorageIO.prepareWorkflowLogoutTransition()
      const secondLogout = isolatedStorageIO.prepareWorkflowLogoutTransition()

      expect(firstLogout.abort()).toBe(false)
      expect(isolatedStorageIO.isStorageAvailable()).toBe(false)
      expect(resumeAfterAbort).not.toHaveBeenCalled()

      expect(secondLogout.abort()).toBe(true)
      expect(isolatedStorageIO.isStorageAvailable()).toBe(true)
      expect(resumeAfterAbort).toHaveBeenCalledOnce()
    })

    it('keeps a workspace fence when an overlapping logout aborts', async () => {
      const isolatedStorageIO = await import('./storageIO')
      const cancelWorkspaceTransition =
        isolatedStorageIO.prepareWorkflowWorkspaceTransition()
      const logoutTransition =
        isolatedStorageIO.prepareWorkflowLogoutTransition()

      expect(logoutTransition.abort()).toBe(false)
      expect(isolatedStorageIO.isStorageAvailable()).toBe(false)

      cancelWorkspaceTransition.release()
      expect(isolatedStorageIO.isStorageAvailable()).toBe(true)
    })

    it('reports resume failure and continues remaining abort recovery', async () => {
      const isolatedStorageIO = await import('./storageIO')
      const error = new DOMException('Resume failed', 'QuotaExceededError')
      const successfulResume = vi.fn()
      isolatedStorageIO.registerWorkflowPersistence({
        flush: () => {},
        cancel: () => {},
        resumeAfterAbort: () => {
          throw error
        }
      })
      isolatedStorageIO.registerWorkflowPersistence({
        flush: () => {},
        cancel: () => {},
        resumeAfterAbort: successfulResume
      })
      const transition = isolatedStorageIO.prepareWorkflowLogoutTransition()

      expect(transition.abort()).toBe(true)

      expect(reportError).toHaveBeenCalledExactlyOnceWith(error, {
        surface: 'workspace',
        errorType: 'failure_resuming_workflow_persistence',
        level: 'error'
      })
      expect(successfulResume).toHaveBeenCalledOnce()
    })

    it('releases an auth-state fence without releasing an owned logout', async () => {
      const isolatedStorageIO = await import('./storageIO')
      const logoutTransition =
        isolatedStorageIO.prepareWorkflowLogoutTransition()
      isolatedStorageIO.fenceWorkflowStorageForAuthState()

      expect(isolatedStorageIO.releaseWorkflowStorageAuthFence()).toBe(false)
      expect(isolatedStorageIO.isStorageAvailable()).toBe(false)

      expect(logoutTransition.release()).toBe(true)
      expect(isolatedStorageIO.isStorageAvailable()).toBe(true)
    })

    it('holds a repeated auth-state fence as one owner', async () => {
      const isolatedStorageIO = await import('./storageIO')

      const firstOwner = isolatedStorageIO.fenceWorkflowStorageForAuthState()
      const repeatedOwner = isolatedStorageIO.fenceWorkflowStorageForAuthState()

      expect(repeatedOwner).toBe(firstOwner)
      expect(isolatedStorageIO.releaseWorkflowStorageAuthFence()).toBe(true)
      expect(isolatedStorageIO.isStorageAvailable()).toBe(true)
    })

    it('does not let a stale auth owner abort a newer fence', async () => {
      const isolatedStorageIO = await import('./storageIO')
      const staleOwner = isolatedStorageIO.fenceWorkflowStorageForAuthState()
      isolatedStorageIO.releaseWorkflowStorageAuthFence(staleOwner)
      isolatedStorageIO.fenceWorkflowStorageForAuthState()

      expect(isolatedStorageIO.abortWorkflowStorageAuthFence(staleOwner)).toBe(
        false
      )
      expect(isolatedStorageIO.isStorageAvailable()).toBe(false)
    })

    it('fences again after an auth-state fence is released', async () => {
      const isolatedStorageIO = await import('./storageIO')
      isolatedStorageIO.fenceWorkflowStorageForAuthState()
      isolatedStorageIO.releaseWorkflowStorageAuthFence()

      isolatedStorageIO.fenceWorkflowStorageForAuthState()

      expect(isolatedStorageIO.isStorageAvailable()).toBe(false)
    })

    it('blocks reads while a logout transition is in flight', async () => {
      const isolatedStorageIO = await import('./storageIO')

      isolatedStorageIO.writePayload('ws-1', 'draft', {
        data: '{}',
        updatedAt: 1
      })
      isolatedStorageIO.prepareWorkflowLogoutTransition()

      expect(isolatedStorageIO.readPayload('ws-1', 'draft')).toBeNull()
      expect(isolatedStorageIO.getPayloadKeys('ws-1')).toEqual([])
    })

    it('blocks reads when a logout overlaps a workspace transition', async () => {
      const isolatedStorageIO = await import('./storageIO')
      isolatedStorageIO.writePayload('ws-1', 'draft', {
        data: '{}',
        updatedAt: 1
      })
      isolatedStorageIO.prepareWorkflowWorkspaceTransition()

      isolatedStorageIO.prepareWorkflowLogoutTransition()

      expect(isolatedStorageIO.readPayload('ws-1', 'draft')).toBeNull()
    })

    it('does not let a duplicate transition cancel the owner transition', async () => {
      const isolatedStorageIO = await import('./storageIO')

      const cancelOwner = isolatedStorageIO.prepareWorkflowWorkspaceTransition()
      const cancelDuplicate =
        isolatedStorageIO.prepareWorkflowWorkspaceTransition()
      cancelDuplicate.release()
      expect(isolatedStorageIO.isStorageAvailable()).toBe(false)

      cancelOwner.release()
      expect(isolatedStorageIO.isStorageAvailable()).toBe(true)
    })

    it('keeps reads available while a workspace transition blocks writes', async () => {
      const isolatedStorageIO = await import('./storageIO')

      isolatedStorageIO.writePayload('ws-1', 'draft', {
        data: '{}',
        updatedAt: 1
      })
      const cancelTransition =
        isolatedStorageIO.prepareWorkflowWorkspaceTransition()

      expect(isolatedStorageIO.readPayload('ws-1', 'draft')).not.toBeNull()
      expect(isolatedStorageIO.getPayloadKeys('ws-1')).toContain('draft')
      cancelTransition.release()
    })
  })

  describe('clearWorkflowRestoreState', () => {
    it('clears cross-workspace restore state without deleting scoped drafts', () => {
      localStorage.setItem('Comfy.Workflow.DraftIndex.v2:ws-1', '{}')
      localStorage.setItem('Comfy.Workflow.Draft.v2:ws-1:abc', '{}')
      localStorage.setItem('Comfy.Workflow.LastOpenPaths:ws-1', '{}')
      localStorage.setItem('Comfy.Workflow.Drafts:ws-1', '{}')
      localStorage.setItem('Comfy.OpenWorkflowsPaths', '["a.json"]')
      localStorage.setItem('Comfy.ActiveWorkflowIndex', '0')
      localStorage.setItem('workflow', '{}')
      sessionStorage.setItem('Comfy.Workflow.ActivePath:client-1', '{}')
      sessionStorage.setItem('Comfy.Workflow.OpenPaths:client-1', '{}')
      sessionStorage.setItem('workflow:client-1', '{}')
      sessionStorage.setItem('unrelated', 'keep')

      clearWorkflowRestoreState()

      expect(localStorage.getItem('Comfy.OpenWorkflowsPaths')).toBeNull()
      expect(localStorage.getItem('Comfy.ActiveWorkflowIndex')).toBeNull()
      expect(localStorage.getItem('workflow')).toBeNull()
      expect(
        sessionStorage.getItem('Comfy.Workflow.ActivePath:client-1')
      ).toBeNull()
      expect(
        sessionStorage.getItem('Comfy.Workflow.OpenPaths:client-1')
      ).toBeNull()
      expect(sessionStorage.getItem('workflow:client-1')).toBeNull()
      expect(sessionStorage).toHaveLength(1)
      expect(sessionStorage.getItem('unrelated')).toBe('keep')
      expect(localStorage.getItem('Comfy.Workflow.DraftIndex.v2:ws-1')).toBe(
        '{}'
      )
      expect(localStorage.getItem('Comfy.Workflow.Draft.v2:ws-1:abc')).toBe(
        '{}'
      )
      expect(localStorage.getItem('Comfy.Workflow.LastOpenPaths:ws-1')).toBe(
        '{}'
      )
      expect(localStorage.getItem('Comfy.Workflow.Drafts:ws-1')).toBe('{}')
    })
  })

  describe('measureLocalStorage', () => {
    it('reports an unavailable measurement when enumeration fails', () => {
      localStorage.setItem('Comfy.Workflow.Draft.v2:ws-1:abc', '{"data":""}')
      vi.spyOn(localStorage, 'key').mockImplementation(() => {
        throw new DOMException('blocked', 'SecurityError')
      })

      expect(measureLocalStorage()).toBeNull()
    })

    it('does not report a partial measurement when a key disappears mid-scan', () => {
      localStorage.setItem('Comfy.Workflow.Draft.v2:ws-1:abc', '{"data":""}')
      vi.spyOn(localStorage, 'key').mockReturnValue(null)

      expect(measureLocalStorage()).toBeNull()
    })

    it('measures a genuinely empty store as zero', () => {
      expect(measureLocalStorage()).toEqual({
        storageTotalBytes: 0,
        storageDraftBytes: 0,
        storageKeyCount: 0,
        largestOtherStorageKey: null,
        largestOtherStorageKeyBytes: 0
      })
    })
  })
})
