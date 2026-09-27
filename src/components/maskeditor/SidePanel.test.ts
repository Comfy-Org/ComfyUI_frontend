import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

import type { useToolManager } from '@/composables/maskeditor/useToolManager'

import SidePanel from '@/components/maskeditor/SidePanel.vue'

type ToolManager = ReturnType<typeof useToolManager>

vi.mock('@/components/maskeditor/SettingsPanelContainer.vue', () => ({
  default: {
    name: 'SettingsPanelContainerStub',
    template: '<div data-testid="settings-panel-stub">settings</div>'
  }
}))

vi.mock('@/components/maskeditor/ImageLayerSettingsPanel.vue', () => ({
  default: {
    name: 'ImageLayerSettingsPanelStub',
    props: ['toolManager'],
    template:
      '<div data-testid="image-layer-stub">image-layer:{{ toolManager?.tag ?? "none" }}</div>'
  }
}))

describe('SidePanel', () => {
  it('should render both child panels', () => {
    render(SidePanel)

    expect(screen.getByTestId('settings-panel-stub')).toBeInTheDocument()
    expect(screen.getByTestId('image-layer-stub')).toBeInTheDocument()
  })

  it('should forward toolManager prop to ImageLayerSettingsPanel', () => {
    const toolManager = { tag: 'my-tool-manager' } as unknown as ToolManager

    render(SidePanel, { props: { toolManager } })

    expect(screen.getByTestId('image-layer-stub').textContent).toContain(
      'my-tool-manager'
    )
  })

  it('should render with no toolManager passed through', () => {
    render(SidePanel)

    expect(screen.getByTestId('image-layer-stub').textContent).toContain('none')
  })
})
