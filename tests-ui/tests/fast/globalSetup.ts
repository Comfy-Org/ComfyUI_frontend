module.exports = async function () {
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

  jest.mock('vue-i18n', () => {
    return {
      useI18n: jest.fn()
    }
  })
}
