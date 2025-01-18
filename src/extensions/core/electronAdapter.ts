import { t } from '@/i18n'
import { app } from '@/scripts/app'
import { useDialogService } from '@/services/dialogService'
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
        name: 'Send anonymous usage metrics',
        type: 'boolean',
        defaultValue: true,
        onChange: onChangeRestartApp
      },
      {
        id: 'Comfy-Desktop.WindowStyle',
        category: ['Comfy-Desktop', 'General', 'Window Style'],
        name: 'Window Style',
        tooltip: 'Choose custom option to hide the system title bar',
        type: 'combo',
        experimental: true,
        defaultValue: 'default',
        options: ['default', 'custom'],
        onChange: (
          newValue: 'default' | 'custom',
          oldValue: 'default' | 'custom'
        ) => {
          electronAPI.Config.setWindowStyle(newValue)

          onChangeRestartApp(newValue, oldValue)
        }
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
        id: 'Comfy-Desktop.OpenUserGuide',
        label: 'Desktop User Guide',
        icon: 'pi pi-book',
        function() {
          window.open('https://comfyorg.notion.site/', '_blank')
        }
      },
      {
        id: 'Comfy-Desktop.Reinstall',
        label: 'Reinstall',
        icon: 'pi pi-refresh',
        async function() {
          const proceed = await useDialogService().confirm({
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
        commands: [
          'Comfy-Desktop.OpenUserGuide',
          'Comfy-Desktop.OpenFeedbackPage'
        ]
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

    keybindings: [
      {
        commandId: 'Workspace.CloseWorkflow',
        combo: {
          key: 'w',
          ctrl: true
        }
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
