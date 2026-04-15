import { createTestingPinia } from '@pinia/testing'
import type { InstallValidation } from '@comfyorg/comfyui-electron-types'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockElectron, testTasks } = vi.hoisted(() => {
  const terminalTaskExecute = vi.fn().mockResolvedValue(true)
  const basicTaskExecute = vi.fn().mockResolvedValue(true)

  return {
    mockElectron: {
      Validation: {
        validateInstallation: vi.fn()
      }
    },
    testTasks: [
      {
        id: 'basicTask',
        name: 'Basic Task',
        execute: basicTaskExecute
      },
      {
        id: 'terminalTask',
        name: 'Terminal Task',
        execute: terminalTaskExecute,
        usesTerminal: true,
        isInstallationFix: true
      }
    ]
  }
})

vi.mock('@/utils/envUtil', () => ({
  electronAPI: vi.fn(() => mockElectron)
}))

vi.mock('@/constants/desktopMaintenanceTasks', () => ({
  DESKTOP_MAINTENANCE_TASKS: testTasks
}))

import { useMaintenanceTaskStore } from '@/stores/maintenanceTaskStore'
import type { MaintenanceTask } from '@/types/desktop/maintenanceTypes'

type PartialInstallValidation = Partial<InstallValidation> &
  Record<string, unknown>

function makeUpdate(
  overrides: PartialInstallValidation = {}
): InstallValidation {
  return {
    inProgress: false,
    installState: 'installed',
    ...overrides
  } as InstallValidation
}

function createStore() {
  setActivePinia(createTestingPinia({ stubActions: false }))
  return useMaintenanceTaskStore()
}

describe('useMaintenanceTaskStore', () => {
  let store: ReturnType<typeof useMaintenanceTaskStore>
  const [basicTask, terminalTask] = testTasks as MaintenanceTask[]

  beforeEach(() => {
    vi.resetAllMocks()
    store = createStore()
  })

  describe('initial state', () => {
    it('creates runners for all tasks', () => {
      expect(store.tasks.length).toBe(testTasks.length)
    })

    it('starts with isRefreshing false', () => {
      expect(store.isRefreshing).toBe(false)
    })

    it('starts with no errors', () => {
      expect(store.anyErrors).toBe(false)
    })

    it('starts with unsafeBasePath false', () => {
      expect(store.unsafeBasePath).toBe(false)
    })

    it('starts with no running terminal commands', () => {
      expect(store.isRunningTerminalCommand).toBe(false)
    })

    it('starts with no running installation fixes', () => {
      expect(store.isRunningInstallationFix).toBe(false)
    })
  })

  describe('processUpdate', () => {
    it('sets isRefreshing to true during in-progress update', () => {
      store.processUpdate(makeUpdate({ inProgress: true }))
      expect(store.isRefreshing).toBe(true)
    })

    it('sets isRefreshing to false when update is complete', () => {
      store.processUpdate(makeUpdate({ inProgress: false, basicTask: 'OK' }))
      expect(store.isRefreshing).toBe(false)
    })

    it('updates runner state for tasks present in the final update', () => {
      store.processUpdate(makeUpdate({ basicTask: 'error' }))
      expect(store.getRunner(basicTask).state).toBe('error')
    })

    it('sets task state to warning from update', () => {
      store.processUpdate(makeUpdate({ basicTask: 'warning' }))
      expect(store.getRunner(basicTask).state).toBe('warning')
    })

    it('marks runners as refreshing when task id is absent from in-progress update', () => {
      store.processUpdate(makeUpdate({ inProgress: true }))
      expect(store.getRunner(basicTask).refreshing).toBe(true)
    })

    it('marks task as skipped when absent from final update', () => {
      store.processUpdate(makeUpdate({ inProgress: false }))
      expect(store.getRunner(basicTask).state).toBe('skipped')
    })

    it('clears refreshing flag after final update', () => {
      store.processUpdate(makeUpdate({ inProgress: true }))
      store.processUpdate(makeUpdate({ inProgress: false }))
      expect(store.getRunner(basicTask).refreshing).toBe(false)
    })

    it('stores lastUpdate and exposes unsafeBasePath', () => {
      store.processUpdate(makeUpdate({ unsafeBasePath: true }))
      expect(store.unsafeBasePath).toBe(true)
    })

    it('exposes unsafeBasePathReason from the update', () => {
      store.processUpdate(
        makeUpdate({ unsafeBasePath: true, unsafeBasePathReason: 'oneDrive' })
      )
      expect(store.unsafeBasePathReason).toBe('oneDrive')
    })
  })

  describe('anyErrors', () => {
    it('returns true when any task has error state', () => {
      store.processUpdate(makeUpdate({ basicTask: 'error' }))
      expect(store.anyErrors).toBe(true)
    })

    it('returns false when all tasks are OK', () => {
      store.processUpdate(makeUpdate({ basicTask: 'OK', terminalTask: 'OK' }))
      expect(store.anyErrors).toBe(false)
    })

    it('returns false when all tasks are warning', () => {
      store.processUpdate(
        makeUpdate({ basicTask: 'warning', terminalTask: 'warning' })
      )
      expect(store.anyErrors).toBe(false)
    })
  })

  describe('runner state transitions', () => {
    it('marks runner as resolved when transitioning from error to OK', () => {
      store.processUpdate(makeUpdate({ basicTask: 'error' }))
      store.processUpdate(makeUpdate({ basicTask: 'OK' }))
      expect(store.getRunner(basicTask).resolved).toBe(true)
    })

    it('does not mark resolved for warning to OK transition', () => {
      store.processUpdate(makeUpdate({ basicTask: 'warning' }))
      store.processUpdate(makeUpdate({ basicTask: 'OK' }))
      expect(store.getRunner(basicTask).resolved).toBeFalsy()
    })

    it('clears resolved flag when task returns to error', () => {
      store.processUpdate(makeUpdate({ basicTask: 'error' }))
      store.processUpdate(makeUpdate({ basicTask: 'OK' }))
      store.processUpdate(makeUpdate({ basicTask: 'error' }))
      expect(store.getRunner(basicTask).resolved).toBeFalsy()
    })
  })

  describe('clearResolved', () => {
    it('clears resolved flags on all runners', () => {
      store.processUpdate(makeUpdate({ basicTask: 'error' }))
      store.processUpdate(makeUpdate({ basicTask: 'OK' }))
      expect(store.getRunner(basicTask).resolved).toBe(true)

      store.clearResolved()
      expect(store.getRunner(basicTask).resolved).toBeFalsy()
    })
  })

  describe('execute', () => {
    it('returns true when task execution succeeds', async () => {
      vi.mocked(basicTask.execute).mockResolvedValue(true)
      const result = await store.execute(basicTask)
      expect(result).toBe(true)
    })

    it('returns false when task execution fails', async () => {
      vi.mocked(basicTask.execute).mockResolvedValue(false)
      const result = await store.execute(basicTask)
      expect(result).toBe(false)
    })

    it('calls refreshDesktopTasks after successful installation-fix task', async () => {
      vi.mocked(terminalTask.execute).mockResolvedValue(true)
      await store.execute(terminalTask)
      expect(
        mockElectron.Validation.validateInstallation
      ).toHaveBeenCalledOnce()
    })

    it('does not call refreshDesktopTasks when task is not an installation fix', async () => {
      vi.mocked(basicTask.execute).mockResolvedValue(true)
      await store.execute(basicTask)
      expect(
        mockElectron.Validation.validateInstallation
      ).not.toHaveBeenCalled()
    })

    it('does not call refreshDesktopTasks when installation-fix task fails', async () => {
      vi.mocked(terminalTask.execute).mockResolvedValue(false)
      await store.execute(terminalTask)
      expect(
        mockElectron.Validation.validateInstallation
      ).not.toHaveBeenCalled()
    })

    it('sets runner executing to true during task execution', async () => {
      let resolveTask!: (value: boolean) => void
      vi.mocked(basicTask.execute).mockReturnValue(
        new Promise<boolean>((resolve) => {
          resolveTask = resolve
        })
      )

      const executePromise = store.execute(basicTask)
      expect(store.getRunner(basicTask).executing).toBe(true)

      resolveTask(true)
      await executePromise
      expect(store.getRunner(basicTask).executing).toBe(false)
    })

    it('clears executing flag when task throws', async () => {
      vi.mocked(basicTask.execute).mockRejectedValue(new Error('fail'))
      await expect(store.execute(basicTask)).rejects.toThrow('fail')
      expect(store.getRunner(basicTask).executing).toBe(false)
    })

    it('sets runner error message when task throws', async () => {
      vi.mocked(basicTask.execute).mockRejectedValue(
        new Error('something broke')
      )
      await expect(store.execute(basicTask)).rejects.toThrow()
      expect(store.getRunner(basicTask).error).toBe('something broke')
    })

    it('clears runner error on successful execution', async () => {
      vi.mocked(basicTask.execute).mockRejectedValue(new Error('fail'))
      await expect(store.execute(basicTask)).rejects.toThrow()

      vi.mocked(basicTask.execute).mockResolvedValue(true)
      await store.execute(basicTask)
      expect(store.getRunner(basicTask).error).toBeUndefined()
    })
  })

  describe('isRunningTerminalCommand', () => {
    it('returns true while a terminal task is executing', async () => {
      let resolveTask!: (value: boolean) => void
      vi.mocked(terminalTask.execute).mockReturnValue(
        new Promise<boolean>((resolve) => {
          resolveTask = resolve
        })
      )

      const executePromise = store.execute(terminalTask)
      expect(store.isRunningTerminalCommand).toBe(true)

      resolveTask(true)
      await executePromise
      expect(store.isRunningTerminalCommand).toBe(false)
    })

    it('returns false when no terminal tasks are executing', () => {
      expect(store.isRunningTerminalCommand).toBe(false)
    })
  })

  describe('isRunningInstallationFix', () => {
    it('returns true while an installation-fix task is executing', async () => {
      let resolveTask!: (value: boolean) => void
      vi.mocked(terminalTask.execute).mockReturnValue(
        new Promise<boolean>((resolve) => {
          resolveTask = resolve
        })
      )

      const executePromise = store.execute(terminalTask)
      expect(store.isRunningInstallationFix).toBe(true)

      resolveTask(true)
      await executePromise
    })
  })
})
