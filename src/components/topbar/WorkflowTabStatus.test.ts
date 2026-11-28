import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'

import type { ResolvedTabPrimaryStatus } from './workflowTabStatus'
import {
  resolvePrimaryTabStatus,
  resolveTabPopoverStatuses
} from './workflowTabStatus'
import WorkflowTabStatus from './WorkflowTabStatus.vue'

const {
  agentNeedsApproval,
  agentWorking,
  agentWorkingAndWorkflowRunning,
  agentFinishedUnseen,
  running,
  completed,
  failed
} = enMessages.g

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: {
        agentNeedsApproval,
        agentWorking,
        agentWorkingAndWorkflowRunning,
        agentFinishedUnseen,
        running,
        completed,
        failed
      }
    }
  }
})

function renderStatus(
  status?: ResolvedTabPrimaryStatus,
  reserveSpace?: boolean
) {
  return render(WorkflowTabStatus, {
    props: { status, reserveSpace },
    global: { plugins: [i18n] }
  })
}

describe('resolvePrimaryTabStatus', () => {
  it('follows the DES-1356 priority: waiting > failed > busy > unseen > completed', () => {
    expect(
      resolvePrimaryTabStatus({
        awaitingApproval: true,
        agentWorking: true,
        agentReplied: true,
        workflowStatus: 'failed'
      })
    ).toEqual({ kind: 'waiting', labelKey: 'g.agentNeedsApproval' })

    expect(
      resolvePrimaryTabStatus({
        awaitingApproval: false,
        agentWorking: true,
        agentReplied: true,
        workflowStatus: 'failed'
      })
    ).toEqual({ kind: 'failed', labelKey: 'g.failed' })

    expect(
      resolvePrimaryTabStatus({
        awaitingApproval: false,
        agentWorking: true,
        agentReplied: true,
        workflowStatus: 'running'
      })
    ).toEqual({ kind: 'busy', labelKey: 'g.agentWorkingAndWorkflowRunning' })

    expect(
      resolvePrimaryTabStatus({
        awaitingApproval: false,
        agentWorking: true,
        agentReplied: true,
        workflowStatus: 'completed'
      })
    ).toEqual({ kind: 'busy', labelKey: 'g.agentWorking' })

    expect(
      resolvePrimaryTabStatus({
        awaitingApproval: false,
        agentWorking: false,
        agentReplied: true,
        workflowStatus: 'running'
      })
    ).toEqual({ kind: 'busy', labelKey: 'g.running' })

    expect(
      resolvePrimaryTabStatus({
        awaitingApproval: false,
        agentWorking: false,
        agentReplied: true,
        workflowStatus: 'completed'
      })
    ).toEqual({ kind: 'unseen', labelKey: 'g.agentFinishedUnseen' })

    expect(
      resolvePrimaryTabStatus({
        awaitingApproval: false,
        agentWorking: false,
        agentReplied: false,
        workflowStatus: 'completed'
      })
    ).toEqual({ kind: 'completed', labelKey: 'g.completed' })

    expect(
      resolvePrimaryTabStatus({
        awaitingApproval: false,
        agentWorking: false,
        agentReplied: false
      })
    ).toBeUndefined()
  })
})

describe('resolveTabPopoverStatuses', () => {
  it('lists every applicable status in priority order without duplicating working while waiting', () => {
    expect(
      resolveTabPopoverStatuses({
        awaitingApproval: true,
        agentWorking: true,
        agentReplied: true,
        workflowStatus: 'failed',
        unsaved: true
      })
    ).toEqual(['waiting', 'failed', 'agent-replied', 'unsaved'])

    expect(
      resolveTabPopoverStatuses({
        awaitingApproval: false,
        agentWorking: true,
        agentReplied: false,
        workflowStatus: 'running',
        unsaved: false
      })
    ).toEqual(['agent-working', 'workflow-running'])

    expect(
      resolveTabPopoverStatuses({
        awaitingApproval: false,
        agentWorking: false,
        agentReplied: true,
        workflowStatus: 'completed',
        unsaved: true
      })
    ).toEqual(['agent-replied', 'run-finished', 'unsaved'])
  })
})

describe('WorkflowTabStatus', () => {
  it('reserves the slot width when empty by default and omits it when reserveSpace is false', () => {
    const reserved = renderStatus(undefined)
    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.getByTestId('workflow-tab-status-slot')).toHaveAttribute(
      'aria-hidden',
      'true'
    )
    reserved.unmount()

    renderStatus(undefined, false)
    expect(screen.queryByTestId('workflow-tab-status-slot')).toBeNull()
  })

  it.for([
    {
      status: {
        kind: 'waiting' as const,
        labelKey: 'g.agentNeedsApproval'
      },
      label: agentNeedsApproval,
      expectedClass: 'bg-warning'
    },
    {
      status: { kind: 'failed' as const, labelKey: 'g.failed' },
      label: failed,
      expectedClass: 'text-destructive'
    },
    {
      status: {
        kind: 'busy' as const,
        labelKey: 'g.agentWorkingAndWorkflowRunning'
      },
      label: agentWorkingAndWorkflowRunning,
      expectedClass: 'motion-safe:animate-spin'
    },
    {
      status: { kind: 'unseen' as const, labelKey: 'g.agentFinishedUnseen' },
      label: agentFinishedUnseen,
      expectedClass: 'bg-primary'
    },
    {
      status: { kind: 'completed' as const, labelKey: 'g.completed' },
      label: completed,
      expectedClass: 'text-success'
    }
  ])(
    'renders $status.kind with its accessible label and no tooltip',
    ({ status, label, expectedClass }) => {
      renderStatus(status)

      const indicator = screen.getByRole('img', { name: label })
      expect(indicator).toBeVisible()
      expect(indicator).toHaveAttribute('data-status', status.kind)
      expect(indicator).toHaveClass(expectedClass)
      expect(indicator).not.toHaveAttribute('title')
    }
  )
})
