import { within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'

import type { JobListItem } from '@comfyorg/api-client/jobs/jobTypes'
import type { ComfyWorkflowJSON } from '@comfyorg/graph-model/workflowSchema'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'

import { ComfyList } from './ComfyList'
import type { LegacyQueueHost } from './types'

vi.mock(import('@/scripts/app'))

function createList(type = 'queue') {
  const host: LegacyQueueHost = {
    restoreOutputs: vi.fn()
  }
  const list = new ComfyList(app, host, type, type)
  document.body.append(list.element)
  onTestFinished(() => list.element.remove())
  return { list, host }
}

const job: JobListItem = {
  id: 'job-1',
  status: 'completed',
  create_time: 1,
  priority: 1
}

describe('legacy queue and history lists', () => {
  beforeEach(() => {
    vi.spyOn(api, 'getHistory').mockResolvedValue([])
    vi.spyOn(api, 'getQueue').mockResolvedValue({ Running: [], Pending: [] })
    vi.spyOn(api, 'getJobDetail').mockResolvedValue(undefined)
    vi.spyOn(api, 'interrupt').mockResolvedValue(undefined)
    vi.spyOn(api, 'deleteItem').mockResolvedValue(true)
  })

  it('loads with legacy view flags and restores outputs after the workflow finishes loading', async () => {
    const workflow: ComfyWorkflowJSON = {
      last_node_id: 0,
      last_link_id: 0,
      nodes: [],
      links: [],
      groups: [],
      config: {},
      extra: {},
      version: 0.4
    }
    const outputs = { '1': { images: [{ filename: 'image.png' }] } }
    vi.mocked(api.getHistory).mockResolvedValue([job])
    vi.mocked(api.getJobDetail).mockResolvedValue({
      ...job,
      workflow: { extra_data: { extra_pnginfo: { workflow } } },
      outputs
    })
    let finishLoading!: () => void
    vi.mocked(app.loadGraphData).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishLoading = () => resolve(undefined)
        })
    )
    const { list, host } = createList('history')
    await list.show()

    await userEvent.click(
      within(list.element).getByRole('button', { name: 'Load' })
    )
    await vi.waitFor(() =>
      expect(app.loadGraphData).toHaveBeenCalledWith(
        workflow,
        true,
        false,
        null,
        {
          initiator: 'user'
        }
      )
    )
    expect(host.restoreOutputs).not.toHaveBeenCalled()
    finishLoading()

    await vi.waitFor(() =>
      expect(host.restoreOutputs).toHaveBeenCalledExactlyOnceWith(outputs)
    )
    expect(api.getJobDetail).toHaveBeenCalledExactlyOnceWith('job-1')
  })

  it('does not restore outputs when loading the workflow is refused', async () => {
    vi.mocked(api.getHistory).mockResolvedValue([job])
    vi.mocked(api.getJobDetail).mockResolvedValue({
      ...job,
      outputs: { '1': { images: [{ filename: 'image.png' }] } }
    })
    vi.mocked(app.loadGraphData).mockResolvedValueOnce(false)
    const { list, host } = createList('history')
    await list.show()

    await userEvent.click(
      within(list.element).getByRole('button', { name: 'Load' })
    )

    expect(host.restoreOutputs).not.toHaveBeenCalled()
  })

  it('retains the legacy load call when job details have no embedded workflow', async () => {
    vi.mocked(api.getHistory).mockResolvedValue([job])
    vi.mocked(api.getJobDetail).mockResolvedValue(job)
    const { list, host } = createList('history')
    await list.show()

    await userEvent.click(
      within(list.element).getByRole('button', { name: 'Load' })
    )

    await vi.waitFor(() =>
      expect(app.loadGraphData).toHaveBeenCalledWith(
        undefined,
        true,
        false,
        null,
        {
          initiator: 'user'
        }
      )
    )
    expect(host.restoreOutputs).not.toHaveBeenCalled()
  })

  it.for([
    {
      type: 'queue',
      section: 'Running',
      button: 'Cancel',
      interrupts: 1,
      deletes: []
    },
    {
      type: 'queue',
      section: 'Pending',
      button: 'Delete',
      interrupts: 0,
      deletes: [['queue', 'job-1']]
    },
    {
      type: 'history',
      section: 'history',
      button: 'Delete',
      interrupts: 0,
      deletes: [['history', 'job-1']]
    }
  ])(
    '$button removes a $section job with the legacy $type action',
    async ({ type, section, button, interrupts, deletes }) => {
      vi.mocked(api.getHistory).mockResolvedValue([job])
      vi.mocked(api.getQueue).mockResolvedValue({
        Running: [],
        Pending: [],
        [section]: [job]
      })
      const { list } = createList(type)
      await list.show()

      await userEvent.click(
        within(list.element).getByRole('button', { name: button })
      )

      expect(api.interrupt).toHaveBeenCalledTimes(interrupts)
      expect(vi.mocked(api.deleteItem).mock.calls).toEqual(deletes)
    }
  )
})
