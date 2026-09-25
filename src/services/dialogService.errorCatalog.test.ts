import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import {
  assert,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi
} from 'vitest'

import { i18n, loadLocale } from '@/i18n'
import { LGraph } from '@/lib/litegraph/src/litegraph'
import type { PromptFailureResponse } from '@/platform/remote/comfyui/types'
import { zComfyWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'
import { api, PromptExecutionError } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useDialogStore } from '@/stores/dialogStore'
import { nodeError, validationError } from '@/utils/__tests__/nodeErrorHelpers'

import { useDialogService } from './dialogService'

vi.mock(import('@/platform/telemetry'))
vi.mock(import('@/composables/useCopyToClipboard'), () => ({
  useCopyToClipboard: () => ({ copyToClipboard: vi.fn(async () => {}) })
}))
vi.mock(import('@/composables/billing/useBillingContext'))
vi.mock(import('@/platform/workspace/composables/useBillingCapabilities'))

beforeEach(() => {
  vi.spyOn(api, 'getLogs').mockResolvedValue('server logs')
  vi.spyOn(api, 'getSystemStats').mockResolvedValue({
    system: {
      os: 'linux',
      comfyui_version: '1.0.0',
      python_version: '3.11',
      pytorch_version: '2.0',
      embedded_python: false,
      argv: ['main.py'],
      ram_total: 0,
      ram_free: 0
    },
    devices: []
  })
  vi.spyOn(app, 'rootGraph', 'get').mockReturnValue(new LGraph())
})

function renderOpenedDialog() {
  const dialog = useDialogStore().dialogStack.at(-1)
  assert.isDefined(dialog)
  return render(dialog.component, {
    props: dialog.contentProps,
    global: { plugins: [i18n] }
  })
}

function sam3ValidationResponse(): PromptFailureResponse {
  return {
    error: {
      type: 'prompt_outputs_failed_validation',
      message: 'Prompt outputs failed validation',
      details: ''
    },
    node_errors: {
      '6': nodeError(
        [
          validationError('return_type_mismatch', 'conditioning', {
            received_type: 'IMAGE',
            input_config: ['CONDITIONING', {}]
          }),
          validationError('required_input_missing', 'image')
        ],
        'SAM3_Detect'
      ),
      '9': nodeError(
        [validationError('required_input_missing', 'mask')],
        'SAM3_Detect'
      )
    }
  }
}

async function openHttpPromptError(payload: unknown) {
  vi.spyOn(api, 'fetchApi').mockResolvedValue(
    new Response(JSON.stringify(payload), { status: 400 })
  )
  const error: unknown = await api
    .queuePrompt(0, {
      output: {},
      workflow: zComfyWorkflow.parse(new LGraph().serialize())
    })
    .catch((error: unknown) => error)
  assert.instanceOf(error, PromptExecutionError)
  useDialogService().showErrorDialog(error)
}

describe('legacy error dialog catalog', () => {
  it.for([
    {
      name: 'numeric details',
      node: {
        class_type: 'SAM3_Detect',
        errors: [
          { type: 'required_input_missing', message: 'Missing', details: 42 }
        ]
      },
      expected: 'Missing: 42'
    },
    {
      name: 'numeric input name',
      node: {
        class_type: 'SAM3_Detect',
        errors: [
          {
            type: 'required_input_missing',
            message: 'Missing',
            details: '',
            extra_info: { input_name: 42 }
          }
        ]
      },
      expected: 'Required input slots have no connection feeding them.'
    },
    {
      name: 'missing details',
      node: {
        class_type: 'SAM3_Detect',
        errors: [
          {
            type: 'required_input_missing',
            message: 'Missing',
            extra_info: { input_name: 'image' }
          }
        ]
      },
      expected: 'SAM3_Detect (#6) is missing a required input: image'
    },
    {
      name: 'null errors',
      node: { class_type: 'SAM3_Detect', errors: null },
      expected: '"errors":null'
    }
  ])('shows HTTP diagnostics with $name', async ({ node, expected }) => {
    await openHttpPromptError({ node_errors: { '6': node } })
    renderOpenedDialog()

    expect(screen.getByTestId('error-dialog')).toHaveTextContent(expected)
  })

  it.for([
    { source: 'HTTP', open: openHttpPromptError },
    {
      source: 'embedded',
      open: (payload: unknown) =>
        useDialogService().showExecutionErrorDialog({
          exception_type: 'PromptValidationError',
          exception_message: `Failed: ${JSON.stringify(payload)}`
        })
    }
  ])(
    'keeps usable node errors and original diagnostics from $source',
    async ({ open }) => {
      const user = userEvent.setup()
      await open({
        error: {
          type: 'prompt_outputs_failed_validation',
          message: 'Validation failed',
          details: ''
        },
        node_errors: {
          '3': {
            class_type: 'KSampler',
            errors: [validationError('required_input_missing', 'model')]
          },
          '6': { class_type: 'SAM3_Detect', errors: null }
        }
      })
      renderOpenedDialog()

      expect(screen.getByTestId('error-dialog')).toHaveTextContent(
        'KSampler (#3) is missing a required input: model'
      )
      await user.click(screen.getByRole('button', { name: 'Show Report' }))
      expect(
        await screen.findByText(/# ComfyUI Error Report/)
      ).toHaveTextContent('"errors":null')
    }
  )

  it.for([
    {
      source: 'HTTP prompt validation',
      open: (response: PromptFailureResponse) =>
        useDialogService().showErrorDialog(new PromptExecutionError(response))
    },
    {
      source: 'cloud execution validation',
      open: (response: PromptFailureResponse) =>
        useDialogService().showExecutionErrorDialog({
          exception_type: 'PromptValidationError',
          node_type: 'CloudProxy',
          exception_message: `Failed to send prompt request: 400: ${JSON.stringify(response)}`
        })
    }
  ])('explains every node input failure from $source', ({ open }) => {
    open(sam3ValidationResponse())
    renderOpenedDialog()

    expect(
      screen.getByRole('heading', { name: 'Prompt validation failed' })
    ).toBeVisible()
    const dialog = screen.getByTestId('error-dialog')
    expect(dialog).toHaveTextContent(
      "SAM3_Detect (#6)'s conditioning input expects CONDITIONING, but the connected output is IMAGE."
    )
    expect(dialog).toHaveTextContent(
      'SAM3_Detect (#6) is missing a required input: image'
    )
    expect(dialog).toHaveTextContent(
      'SAM3_Detect (#9) is missing a required input: mask'
    )
    expect(dialog).not.toHaveTextContent('return_type_mismatch details')
  })

  it('preserves original errors in reports and issue searches', async () => {
    const user = userEvent.setup()
    const error = new PromptExecutionError(sam3ValidationResponse())
    const openWindow = vi.spyOn(window, 'open').mockReturnValue(null)
    useDialogService().showErrorDialog(error)
    renderOpenedDialog()

    await user.click(screen.getByRole('button', { name: 'Find Issues' }))
    expect(openWindow).toHaveBeenCalledWith(
      `https://github.com/comfyanonymous/ComfyUI/issues?q=${encodeURIComponent(error.toString() + ' is:issue')}`,
      '_blank'
    )
    await user.click(screen.getByRole('button', { name: 'Show Report' }))
    expect(await screen.findByText(/# ComfyUI Error Report/)).toHaveTextContent(
      /return_type_mismatch message: return_type_mismatch details/
    )
  })

  it.for([
    {
      name: 'unrecognized prompt error',
      error: new PromptExecutionError({
        error: {
          type: 'custom_error',
          message: 'Custom failure',
          details: 'Fix the custom input'
        }
      }),
      expected: 'Custom failure: Fix the custom input'
    },
    {
      name: 'string prompt error',
      error: new PromptExecutionError({ error: 'Proxy unavailable' }),
      expected: 'Proxy unavailable'
    },
    {
      name: 'ordinary JavaScript error',
      error: new Error('Extension failed'),
      expected: 'Error: Extension failed'
    }
  ])('preserves the message for $name', ({ error, expected }) => {
    useDialogService().showErrorDialog(error, { title: 'Original title' })
    renderOpenedDialog()

    expect(
      screen.getByRole('heading', { name: 'Original title' })
    ).toBeVisible()
    expect(screen.getByText(expected)).toBeVisible()
  })

  it.for([
    {
      exception_type: 'torch.OutOfMemoryError',
      exception_message: 'CUDA out of memory',
      node_type: 'KSampler',
      title: 'KSampler',
      message:
        'Not enough GPU memory. Try reducing image resolution or batch size and run again.'
    },
    {
      exception_type: 'CustomRuntimeError',
      exception_message: 'Custom runtime failure',
      title: 'Execution failed',
      message: 'Node threw an error during execution.'
    }
  ])('explains $exception_type and retains its diagnostics', (error) => {
    useDialogService().showExecutionErrorDialog(error)
    renderOpenedDialog()

    expect(screen.getByRole('heading', { name: error.title })).toBeVisible()
    expect(screen.getByTestId('error-dialog')).toHaveTextContent(error.message)
    expect(screen.getByTestId('error-dialog')).toHaveTextContent(
      error.exception_message
    )
  })

  it('updates catalog copy when the locale changes', async () => {
    const originalLocale = i18n.global.locale.value
    onTestFinished(() => {
      i18n.global.locale.value = originalLocale
    })
    await loadLocale('ko')
    useDialogService().showErrorDialog(
      new PromptExecutionError(sam3ValidationResponse())
    )
    renderOpenedDialog()

    i18n.global.locale.value = 'ko'

    expect(
      await screen.findByText(
        /SAM3_Detect \(#6\)에 필수 입력이 누락되었습니다: image/
      )
    ).toBeVisible()
  })

  it.for([
    { error: { message: 400, details: 'Bad input' } },
    { node_errors: { '6': { class_type: 'SAM3_Detect', errors: null } } },
    {
      node_errors: {
        '6': {
          class_type: 'SAM3_Detect',
          dependent_outputs: [],
          errors: [
            { type: 'required_input_missing', message: 'Missing', details: 42 }
          ]
        }
      }
    }
  ])('preserves malformed embedded diagnostics: %j', (payload) => {
    const message = `Provider failed: ${JSON.stringify(payload)}`
    useDialogService().showExecutionErrorDialog({
      exception_type: 'RuntimeError',
      exception_message: message
    })
    renderOpenedDialog()

    expect(
      screen.getByRole('heading', { name: 'Execution failed' })
    ).toBeVisible()
    expect(screen.getByTestId('error-dialog')).toHaveTextContent(message)
  })

  it('keeps a prompt message when its embedded node collection is unreadable', async () => {
    const user = userEvent.setup()
    const message = 'Provider failed: {"error":"Bad input","node_errors":null}'
    useDialogService().showExecutionErrorDialog({
      exception_type: 'RuntimeError',
      exception_message: message
    })
    renderOpenedDialog()

    expect(screen.getByTestId('error-dialog')).toHaveTextContent('Bad input')
    await user.click(screen.getByRole('button', { name: 'Show Report' }))
    expect(await screen.findByText(/# ComfyUI Error Report/)).toHaveTextContent(
      message
    )
  })

  it.for(['', 'Blocked by workspace policy'])(
    'identifies nodes when the catalog provides no detail copy: %j',
    (details) => {
      useDialogService().showErrorDialog(
        new PromptExecutionError({
          error: 'Validation failed',
          node_errors: {
            '1': nodeError(
              [
                validationError(
                  'PARTNER_NODE_DISABLED',
                  undefined,
                  {},
                  'Disabled',
                  details
                )
              ],
              'KlingImage2VideoNode'
            ),
            '2': nodeError(
              [
                validationError(
                  'PARTNER_NODE_DISABLED',
                  undefined,
                  {},
                  'Disabled',
                  details
                )
              ],
              'KlingImage2VideoNode'
            )
          }
        })
      )
      renderOpenedDialog()

      expect(screen.getByTestId('error-dialog')).toHaveTextContent(
        'KlingImage2VideoNode (#1)'
      )
      expect(screen.getByTestId('error-dialog')).toHaveTextContent(
        'KlingImage2VideoNode (#2)'
      )
    }
  )
})
