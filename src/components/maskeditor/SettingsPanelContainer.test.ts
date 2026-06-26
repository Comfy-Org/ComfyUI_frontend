import { render } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import SettingsPanelContainer from '@/components/maskeditor/SettingsPanelContainer.vue'
import { Tools } from '@/extensions/core/maskeditor/types'

const mockStore = vi.hoisted(() => ({
  currentTool: 'pen' as Tools
}))

vi.mock('@/stores/maskEditorStore', () => ({
  useMaskEditorStore: () => mockStore
}))

vi.mock('@/components/maskeditor/BrushSettingsPanel.vue', () => ({
  default: {
    name: 'BrushSettingsPanelStub',
    template: '<div>brush-panel</div>'
  }
}))

vi.mock('@/components/maskeditor/ColorSelectSettingsPanel.vue', () => ({
  default: {
    name: 'ColorSelectSettingsPanelStub',
    template: '<div>color-panel</div>'
  }
}))

vi.mock('@/components/maskeditor/PaintBucketSettingsPanel.vue', () => ({
  default: {
    name: 'PaintBucketSettingsPanelStub',
    template: '<div>bucket-panel</div>'
  }
}))

describe('SettingsPanelContainer', () => {
  beforeEach(() => {
    mockStore.currentTool = Tools.MaskPen
  })

  it('should render PaintBucketSettingsPanel when current tool is MaskBucket', () => {
    mockStore.currentTool = Tools.MaskBucket
    const { container } = render(SettingsPanelContainer)
    expect(container.textContent).toContain('bucket-panel')
  })

  it('should render ColorSelectSettingsPanel when current tool is MaskColorFill', () => {
    mockStore.currentTool = Tools.MaskColorFill
    const { container } = render(SettingsPanelContainer)
    expect(container.textContent).toContain('color-panel')
  })

  it('should render BrushSettingsPanel for any other tool', () => {
    mockStore.currentTool = Tools.MaskPen
    const { container } = render(SettingsPanelContainer)
    expect(container.textContent).toContain('brush-panel')
  })

  it('should render BrushSettingsPanel for Eraser', () => {
    mockStore.currentTool = Tools.Eraser
    const { container } = render(SettingsPanelContainer)
    expect(container.textContent).toContain('brush-panel')
  })

  it('should render BrushSettingsPanel for PaintPen', () => {
    mockStore.currentTool = Tools.PaintPen
    const { container } = render(SettingsPanelContainer)
    expect(container.textContent).toContain('brush-panel')
  })
})
