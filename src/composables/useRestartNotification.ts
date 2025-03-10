import { useComfyManagerService } from '@/services/comfyManagerService'
import { useDialogService } from '@/services/dialogService'

/**
 * Composable for handling application restart notifications
 */
export const useRestartNotification = () => {
  const managerService = useComfyManagerService()
  const dialogService = useDialogService()

  /**
   * Prompts the user to refresh the browser
   * If confirmed, refreshes the page immediately
   */
  const promptBrowserRefresh = async (): Promise<boolean> => {
    const result = await dialogService.confirm({
      message: 'Browser refresh is needed. Do you want to refresh now?',
      title: 'Refresh Browser'
    })

    if (result === true) {
      window.location.reload()
    }

    return !!result
  }

  /**
   * Prompts the user to restart ComfyUI
   * If confirmed, calls the reboot service immediately
   */
  const promptAppReboot = async (): Promise<boolean> => {
    const result = await dialogService.confirm({
      message:
        'ComfyUI needs to restart to apply changes. Do you want to restart now?',
      title: 'Restart ComfyUI'
    })

    if (result === true) {
      try {
        await managerService.rebootComfyUI()
      } catch (error) {
        console.error('Error rebooting ComfyUI:', error)
      }
    }

    return !!result
  }

  return {
    promptBrowserRefresh,
    promptAppReboot
  }
}
