/**
 * Mock dialogService for i18n collection
 * This avoids importing Vue components during Node.js execution
 */

export const useDialogService = () => {
  return {
    showLoadWorkflowWarning: () => {},
    showMissingModelsWarning: () => {},
    showSettingsDialog: () => {},
    showAboutDialog: () => {},
    showExecutionErrorDialog: () => {},
    showTemplateWorkflowsDialog: () => {},
    showManagerDialog: () => {},
    showManagerProgressDialog: () => {},
    showErrorDialog: () => {},
    showApiNodesSignInDialog: () => Promise.resolve(false),
    showSignInDialog: () => Promise.resolve(false),
    showUpdatePasswordDialog: () => Promise.resolve(false),
    showConfirmationDialog: () => Promise.resolve(false),
    showNodeConflictDialog: () => Promise.resolve(false),
    showPromptDialog: () => Promise.resolve(''),
    showDataManagementDialog: () => {},
    showTopUpCreditsDialog: () => Promise.resolve(false)
  }
}