import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import ExportWorkflowApiDialogContent from '@/platform/workflow/export/components/ExportWorkflowApiDialogContent.vue'

const mockWorkflowService = vi.hoisted(() => ({
  exportWorkflow: vi.fn()
}))

const mockToastErrorHandler = vi.hoisted(() => vi.fn())
const mockCopyToClipboard = vi.hoisted(() => vi.fn())

vi.mock('@/platform/workflow/core/services/workflowService', () => ({
  useWorkflowService: () => mockWorkflowService
}))

vi.mock('@/composables/useExternalLink', () => ({
  useExternalLink: () => ({
    buildDocsUrl: () => 'https://docs.comfy.org/'
  })
}))

vi.mock('@/composables/useErrorHandling', () => ({
  useErrorHandling: () => ({ toastErrorHandler: mockToastErrorHandler })
}))

vi.mock('@/composables/useCopyToClipboard', () => ({
  useCopyToClipboard: () => ({ copyToClipboard: mockCopyToClipboard })
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

function renderDialog(
  initialWorkflowBaseName = 'image_flux2',
  onClose = vi.fn()
) {
  return render(ExportWorkflowApiDialogContent, {
    props: { initialWorkflowBaseName, onClose }
  })
}

describe('ExportWorkflowApiDialogContent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockWorkflowService.exportWorkflow.mockResolvedValue(undefined)
  })

  it('shows and copies one SDK snippet for the current workflow', async () => {
    renderDialog()

    expect(
      screen.getByRole('textbox', { name: 'apiExport.workflowFile' })
    ).toHaveValue('image_flux2')
    expect(screen.getByText('apiExport.fileExtension')).toBeInTheDocument()
    expect(screen.getByText('# pip install comfy-sdk')).toBeInTheDocument()
    expect(screen.getAllByTestId('python-sdk-code')).toHaveLength(1)
    expect(screen.getByTestId('python-sdk-code')).toHaveTextContent(
      'from comfy_sdk import Comfy'
    )
    expect(screen.getByTestId('python-sdk-code')).toHaveTextContent(
      'workflow = client.workflows.from_file("image_flux2.json")'
    )

    expect(
      screen.getByRole('link', { name: 'apiExport.openQuickstart' })
    ).toHaveAttribute('href', 'https://docs.comfy.org/')

    await userEvent.click(
      screen.getByRole('button', { name: 'g.copyToClipboard' })
    )
    expect(mockCopyToClipboard).toHaveBeenCalledWith(
      [
        '# pip install comfy-sdk',
        '',
        'from comfy_sdk import Comfy',
        '',
        'client = Comfy("http://127.0.0.1:8189")',
        'workflow = client.workflows.from_file("image_flux2.json")',
        'job = client.run(workflow)'
      ].join('\n')
    )
  })

  it('updates the export filename and SDK snippet from the filename input', async () => {
    renderDialog()

    const input = screen.getByRole('textbox', {
      name: 'apiExport.workflowFile'
    })
    await userEvent.clear(input)
    await userEvent.type(input, 'renamed-workflow.json')
    await userEvent.tab()

    expect(input).toHaveValue('renamed-workflow')
    expect(screen.getByTestId('python-sdk-code')).toHaveTextContent(
      'workflow = client.workflows.from_file("renamed-workflow.json")'
    )
  })

  it('uses the provided fallback name', () => {
    renderDialog('workflow_api')

    expect(
      screen.getByRole('textbox', { name: 'apiExport.workflowFile' })
    ).toHaveValue('workflow_api')
    expect(screen.getByTestId('python-sdk-code')).toHaveTextContent(
      'workflow = client.workflows.from_file("workflow_api.json")'
    )
  })

  it('downloads with the existing command and closes the dialog', async () => {
    const onClose = vi.fn()
    renderDialog('image_flux2', onClose)

    await userEvent.click(
      screen.getByRole('button', { name: 'apiExport.downloadWorkflow' })
    )

    expect(mockWorkflowService.exportWorkflow).toHaveBeenCalledWith(
      'image_flux2.json',
      'output',
      { useWorkflowFilename: false, promptFilename: false }
    )
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('reports export failures and keeps the dialog open', async () => {
    const error = new Error('Export failed')
    const onClose = vi.fn()
    mockWorkflowService.exportWorkflow.mockRejectedValueOnce(error)
    renderDialog('image_flux2', onClose)

    await userEvent.click(
      screen.getByRole('button', { name: 'apiExport.downloadWorkflow' })
    )

    expect(mockToastErrorHandler).toHaveBeenCalledWith(error)
    expect(onClose).not.toHaveBeenCalled()
  })
})
