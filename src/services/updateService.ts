import log from 'loglevel'

import { t } from '@/i18n'
import { useDialogService } from '@/services/dialogService'
import { useToastStore } from '@/stores/toastStore'
import { electronAPI as getElectronAPI } from '@/utils/envUtil'

export function useUpdateService() {
  const toastStore = useToastStore()
  const dialogService = useDialogService()
  const electronAPI = getElectronAPI()

  async function installUpdate(): Promise<void> {
    try {
      log.info('Trying to restart and install')
      await electronAPI.restartAndInstall()
    } catch (error) {
      log.error('Error restarting and installing update:', error)
      toastStore.add({
        severity: 'error',
        summary: t('g.error'),
        detail: t('desktopUpdate.errorInstallingUpdate')
      })
    }
  }

  async function checkForUpdates(): Promise<void> {
    try {
      const {
        isUpdateAvailable,
        version
      }: { isUpdateAvailable: boolean; version?: string } =
        await electronAPI.checkForUpdates({ disableUpdateReadyAction: true })

      if (!isUpdateAvailable) {
        log.info('No update found')
        toastStore.add({
          severity: 'info',
          summary: t('desktopUpdate.noUpdateFound')
        })
        return
      }

      const proceed = await dialogService.confirm({
        title: t('desktopUpdate.updateFoundTitle', { version }),
        message: t('desktopUpdate.updateAvailableMessage'),
        type: 'default'
      })
      if (!proceed) {
        log.info('User declined to update')
        return
      }
      log.info('User agreed to update')

      await installUpdate()
    } catch (error) {
      log.error('Error during update process:', error)
      toastStore.add({
        severity: 'error',
        summary: t('g.error'),
        detail: t('desktopUpdate.errorCheckingUpdate')
      })
    }
  }

  return {
    checkForUpdates
  }
}
