// @ts-strict-ignore
module.exports = async function () {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  const { nop } = require('../utils/nopProxy')
  global.enableWebGLCanvas = nop

  global.window.HTMLElement.prototype.hasPointerCapture = jest.fn(() => true)
  global.window.HTMLElement.prototype.setPointerCapture = jest.fn()

  HTMLCanvasElement.prototype.getContext = nop

  localStorage['Comfy.Settings.Comfy.Logging.Enabled'] = 'false'

  jest.mock('@/services/dialogService', () => {
    return {
      showLoadWorkflowWarning: jest.fn(),
      showMissingModelsWarning: jest.fn(),
      showSettingsDialog: jest.fn(),
      showExecutionErrorDialog: jest.fn(),
      showTemplateWorkflowsDialog: jest.fn(),
      showPromptDialog: jest
        .fn()
        .mockImplementation((message, defaultValue) => {
          return Promise.resolve(defaultValue)
        })
    }
  })

  jest.mock('@/stores/toastStore', () => {
    return {
      useToastStore: () => ({
        addAlert: jest.fn()
      })
    }
  })

  jest.mock('@/stores/extensionStore', () => {
    return {
      useExtensionStore: () => ({
        registerExtension: jest.fn(),
        loadDisabledExtensionNames: jest.fn()
      })
    }
  })

  jest.mock('@/stores/workspaceStore', () => {
    return {
      useWorkspaceStore: () => ({
        shiftDown: false,
        spinner: false,
        focusMode: false,
        toggleFocusMode: jest.fn(),
        workflow: {
          activeWorkflow: null,
          syncWorkflows: jest.fn(),
          getWorkflowByPath: jest.fn(),
          createTemporary: jest.fn(),
          openWorkflow: jest.fn()
        }
      })
    }
  })

  jest.mock('@/stores/workspace/bottomPanelStore', () => {
    return {
      toggleBottomPanel: jest.fn()
    }
  })

  jest.mock('@/stores/widgetStore', () => {
    const widgets = {}
    return {
      useWidgetStore: () => ({
        widgets,
        registerCustomWidgets: jest.fn()
      })
    }
  })

  jest.mock('vue-i18n', () => {
    return {
      useI18n: jest.fn()
    }
  })

  jest.mock('jsondiffpatch', () => {
    return {
      diff: jest.fn()
    }
  })
}
