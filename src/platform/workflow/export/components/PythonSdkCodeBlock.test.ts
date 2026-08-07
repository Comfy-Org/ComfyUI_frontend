import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import PythonSdkCodeBlock from '@/platform/workflow/export/components/PythonSdkCodeBlock.vue'

const copyToClipboard = vi.fn()

vi.mock('@/composables/useCopyToClipboard', () => ({
  useCopyToClipboard: () => ({ copyToClipboard })
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

describe('PythonSdkCodeBlock', () => {
  it('copies the install command and Python example together', async () => {
    render(PythonSdkCodeBlock, {
      props: { filename: 'image_flux2.json' }
    })

    await userEvent.click(
      screen.getByRole('button', { name: 'g.copyToClipboard' })
    )

    expect(copyToClipboard).toHaveBeenCalledWith(
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
})
