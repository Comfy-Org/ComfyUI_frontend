import { PrimeIcons } from '@primevue/core/api'

import { MaintenanceTask } from '@/types/desktop/maintenanceTypes'
import { electronAPI } from '@/utils/envUtil'
import { minDurationRef } from '@/utils/refUtil'

const minRefreshTime = 250
const electron = electronAPI()

const openUrl = (url: string) => {
  window.open(url, '_blank')
  return true
}

export const electronTasks: MaintenanceTask[] = [
  {
    id: 'basePath',
    state: null,
    execute: async () => await electron.setBasePath(),
    name: 'Base path',
    description: 'Change the application base path.',
    errorDescription: 'Unable to open the base path.  Please select a new one.',
    detail:
      'The base path is the default location where ComfyUI stores data. It is the location fo the python environment, and may also contain models, custom nodes, and other extensions.',
    isInstallationFix: true,
    button: {
      icon: PrimeIcons.QUESTION,
      text: 'Select'
    }
  },
  {
    id: 'git',
    state: null,
    headerImg: '/assets/images/Git-Logo-White.svg',
    execute: () => openUrl('https://git-scm.com/downloads/'),
    name: 'Download git',
    description: 'Open the git download page.',
    detail:
      'Git is required to download and manage custom nodes and other extensions. This fixer simply opens the download page in your browser. You must download and install git manually.',
    button: {
      icon: PrimeIcons.EXTERNAL_LINK,
      text: 'Download'
    }
  },
  {
    id: 'vcRedist',
    state: null,
    execute: () => openUrl('https://aka.ms/vs/17/release/vc_redist.x64.exe'),
    name: 'Download VC++ Redist',
    description: 'Download the latest VC++ Redistributable runtime.',
    detail:
      'The Visual C++ runtime libraries are required to run ComfyUI. You will need to download and install this file.',
    button: {
      icon: PrimeIcons.EXTERNAL_LINK,
      text: 'Download'
    }
  },
  {
    id: 'reinstall',
    state: null,
    severity: 'danger',
    requireConfirm: true,
    execute: async () => {
      await electron.reinstall()
      return true
    },
    name: 'Reinstall ComfyUI',
    description: 'Deletes the desktop app config and load the welcome screen.',
    detail:
      'Delete the desktop app config, restart the app, and load the installation screen.',
    confirmText: 'Delete all saved config and reinstall?',
    button: {
      icon: PrimeIcons.EXCLAMATION_TRIANGLE,
      text: 'Reinstall'
    }
  },
  {
    id: 'pythonPackages',
    state: null,
    requireConfirm: true,
    execute: async () => {
      try {
        await electron.uv.installRequirements()
        return true
      } catch (error) {
        return false
      }
    },
    name: 'Install python packages',
    description: 'Installs the base python packages required to run ComfyUI.',
    errorDescription:
      'Python packages that are required to run ComfyUI are not installed.',
    detail:
      'This will install the python packages required to run ComfyUI. This includes torch, torchvision, and other dependencies.',
    usesTerminal: true,
    isInstallationFix: true,
    button: {
      icon: PrimeIcons.DOWNLOAD,
      text: 'Install'
    }
  },
  {
    id: 'uv',
    state: null,
    execute: () =>
      openUrl('https://docs.astral.sh/uv/getting-started/installation/'),
    name: 'uv executable',
    description: 'uv installs and maintains the python environment.',
    detail:
      "This will open the download page for Astral's uv tool. uv is used to install python and manage python packages.",
    button: {
      icon: 'pi pi-asterisk',
      text: 'Download'
    }
  },
  {
    id: 'uvCache',
    state: null,
    severity: 'danger',
    requireConfirm: true,
    execute: async () => await electron.uv.clearCache(),
    name: 'uv cache',
    description: 'Remove the Astral uv cache of python packages.',
    detail:
      'This will remove the uv cache directory and its contents. All downloaded python packages will need to be downloaded again.',
    confirmText: 'Delete uv cache of python packages?',
    isInstallationFix: true,
    button: {
      icon: PrimeIcons.TRASH,
      text: 'Clear cache'
    }
  },
  {
    id: 'venvDirectory',
    state: null,
    severity: 'danger',
    requireConfirm: true,
    execute: async () => await electron.uv.resetVenv(),
    name: 'Reset virtual environment',
    description:
      'Remove and recreate the .venv directory. This removes all python packages.',
    detail:
      'The python environment is where ComfyUI installs python and python packages. It is used to run the ComfyUI server.',
    confirmText: 'Delete the .venv directory?',
    usesTerminal: true,
    isInstallationFix: true,
    button: {
      icon: PrimeIcons.FOLDER,
      text: 'Recreate'
    }
  }
]

for (const task of electronTasks) {
  task.loading = minDurationRef(true, minRefreshTime)
}
