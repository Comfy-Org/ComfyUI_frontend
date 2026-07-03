import { createTestingPinia } from '@pinia/testing'
import { render } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createI18n } from 'vue-i18n'

import enMain from '@/locales/en/main.json'
import { useSettingStore } from '@/platform/settings/settingStore'
import { api } from '@/scripts/api'

import WorkflowTemplateSelectorDialog from './WorkflowTemplateSelectorDialog.vue'

const SETTING_DEFAULTS: Record<string, unknown> = {
  'Comfy.Templates.SelectedModels': [],
  'Comfy.Templates.SelectedUseCases': [],
  'Comfy.Templates.SelectedRunsOn': [],
  'Comfy.Templates.SortBy': 'newest'
}

type SelectOption = { name: string; value: string }

const { capturedOptionsByLabel } = vi.hoisted(() => ({
  capturedOptionsByLabel: new Map<string, SelectOption[]>()
}))

vi.mock(
  '@/platform/workflow/templates/composables/useTemplateWorkflows',
  () => ({
    useTemplateWorkflows: () => ({
      loadTemplates: vi.fn(),
      loadWorkflowTemplate: vi.fn(),
      getTemplateThumbnailUrl: () => '',
      getTemplateTitle: () => '',
      getTemplateDescription: () => ''
    })
  })
)

vi.mock('@/components/ui/multi-select/MultiSelect.vue', () => ({
  default: defineComponent({
    name: 'MultiSelect',
    props: {
      label: { type: String, default: '' },
      options: { type: Array as () => SelectOption[], default: () => [] }
    },
    setup(props) {
      return () => {
        capturedOptionsByLabel.set(props.label, props.options)
        return h('div')
      }
    }
  })
}))

function renderDialog() {
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: { en: enMain }
  })

  const pinia = createTestingPinia({ createSpy: vi.fn })
  const settingStore = useSettingStore(pinia)
  vi.mocked(settingStore.get).mockImplementation(
    (key: string) => SETTING_DEFAULTS[key]
  )

  return render(WorkflowTemplateSelectorDialog, {
    props: { onClose: vi.fn() },
    global: {
      plugins: [pinia, i18n],
      stubs: {
        SingleSelect: true,
        BaseModalLayout: {
          template: '<div><slot name="contentFilter" /></div>'
        },
        LeftSidePanel: true,
        AsyncSearchInput: true,
        ProgressSpinner: true
      }
    }
  })
}

describe('WorkflowTemplateSelectorDialog runs-on filter', () => {
  beforeEach(() => {
    capturedOptionsByLabel.clear()
    vi.spyOn(Date, 'now').mockReturnValue(0)
    vi.spyOn(api, 'getFuseOptions').mockResolvedValue(null)
  })

  it('labels the partner-nodes runs-on option as "Partner Nodes"', () => {
    renderDialog()

    const runsOnOptions = capturedOptionsByLabel.get(
      enMain.templateWorkflows.runsOnFilter
    )
    const optionNames = runsOnOptions?.map((o) => o.name)

    expect(optionNames).toContain('Partner Nodes')
    expect(optionNames).toContain('ComfyUI')
  })
})
