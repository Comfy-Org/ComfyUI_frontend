import { t } from '@/i18n'
import { app } from '@/scripts/app'
import { showConfirmationDialog } from '@/services/dialogService'
import { electronAPI as getElectronAPI, isElectron } from '@/utils/envUtil'
;(async () => {
  if (!isElectron()) return

  const electronAPI = getElectronAPI()
  const desktopAppVersion = await electronAPI.getElectronVersion()

  const onChangeRestartApp = (newValue: string, oldValue: string) => {
    // Add a delay to allow changes to take effect before restarting.
    if (oldValue !== undefined && newValue !== oldValue) {
      electronAPI.restartApp('Restart ComfyUI to apply changes.', 1500)
    }
  }

  app.registerExtension({
    name: 'Comfy.ElectronAdapter',
    settings: [
      {
        id: 'Comfy-Desktop.AutoUpdate',
        category: ['Comfy-Desktop', 'General', 'AutoUpdate'],
        name: 'Automatically check for updates',
        type: 'boolean',
        defaultValue: true,
        onChange: onChangeRestartApp
      },
      {
        id: 'Comfy-Desktop.SendStatistics',
        category: ['Comfy-Desktop', 'General', 'Send Statistics'],
        name: 'Send anonymous crash reports',
        type: 'boolean',
        defaultValue: true,
        onChange: onChangeRestartApp
      }
    ],

    commands: [
      {
        id: 'Comfy-Desktop.Folders.OpenLogsFolder',
        label: 'Open Logs Folder',
        icon: 'pi pi-folder-open',
        function() {
          electronAPI.openLogsFolder()
        }
      },
      {
        id: 'Comfy-Desktop.Folders.OpenModelsFolder',
        label: 'Open Models Folder',
        icon: 'pi pi-folder-open',
        function() {
          electronAPI.openModelsFolder()
        }
      },
      {
        id: 'Comfy-Desktop.Folders.OpenOutputsFolder',
        label: 'Open Outputs Folder',
        icon: 'pi pi-folder-open',
        function() {
          electronAPI.openOutputsFolder()
        }
      },
      {
        id: 'Comfy-Desktop.Folders.OpenInputsFolder',
        label: 'Open Inputs Folder',
        icon: 'pi pi-folder-open',
        function() {
          electronAPI.openInputsFolder()
        }
      },
      {
        id: 'Comfy-Desktop.Folders.OpenCustomNodesFolder',
        label: 'Open Custom Nodes Folder',
        icon: 'pi pi-folder-open',
        function() {
          electronAPI.openCustomNodesFolder()
        }
      },
      {
        id: 'Comfy-Desktop.Folders.OpenModelConfig',
        label: 'Open extra_model_paths.yaml',
        icon: 'pi pi-file',
        function() {
          electronAPI.openModelConfig()
        }
      },
      {
        id: 'Comfy-Desktop.OpenDevTools',
        label: 'Open DevTools',
        icon: 'pi pi-code',
        function() {
          electronAPI.openDevTools()
        }
      },
      {
        id: 'Comfy-Desktop.OpenFeedbackPage',
        label: 'Feedback',
        icon: 'pi pi-envelope',
        function() {
          window.open('https://forum.comfy.org/c/v1-feedback/', '_blank')
        }
      },
      {
        id: 'Comfy-Desktop.Reinstall',
        label: 'Reinstall',
        icon: 'pi pi-refresh',
        async function() {
          const proceed = await showConfirmationDialog({
            message: t('desktopMenu.confirmReinstall'),
            title: t('desktopMenu.reinstall'),
            type: 'reinstall'
          })

          if (proceed) electronAPI.reinstall()
        }
      },
      {
        id: 'Comfy-Desktop.Restart',
        label: 'Restart',
        icon: 'pi pi-refresh',
        function() {
          electronAPI.restartApp()
        }
      }
    ],

    menuCommands: [
      {
        path: ['Help'],
        commands: ['Comfy-Desktop.OpenFeedbackPage']
      },
      {
        path: ['Help'],
        commands: ['Comfy-Desktop.OpenDevTools']
      },
      {
        path: ['Help', 'Open Folder'],
        commands: [
          'Comfy-Desktop.Folders.OpenLogsFolder',
          'Comfy-Desktop.Folders.OpenModelsFolder',
          'Comfy-Desktop.Folders.OpenOutputsFolder',
          'Comfy-Desktop.Folders.OpenInputsFolder',
          'Comfy-Desktop.Folders.OpenCustomNodesFolder',
          'Comfy-Desktop.Folders.OpenModelConfig'
        ]
      },
      {
        path: ['Help'],
        commands: ['Comfy-Desktop.Reinstall']
      }
    ],

    aboutPageBadges: [
      {
        label: 'ComfyUI_desktop v' + desktopAppVersion,
        url: 'https://github.com/Comfy-Org/electron',
        icon: 'pi pi-github'
      }
    ]
  })
})()
