/**
 * Installation stage tracking types
 * Re-exports types from the electron package and adds frontend-specific metadata
 */
import type { InstallStageName } from '@comfyorg/comfyui-electron-types'

// Re-export the types from electron package
export type {
  InstallStageInfo,
  InstallStageName,
  InstallStageName as InstallStageType
} from '@comfyorg/comfyui-electron-types'

// Stage metadata for progress calculation and display
export interface StageMetadata {
  label: string
  description?: string
  category:
    | 'initialization'
    | 'validation'
    | 'installation'
    | 'completion'
    | 'error'
}

// Map of stages to their metadata
export const STAGE_METADATA: Record<InstallStageName, StageMetadata> = {
  idle: {
    label: 'Idle',
    category: 'initialization'
  },
  app_initializing: {
    label: 'Initializing App',
    description: 'Starting the application...',
    category: 'initialization'
  },
  checking_existing_install: {
    label: 'Checking Installation',
    description: 'Verifying existing ComfyUI installation...',
    category: 'initialization'
  },
  hardware_validation: {
    label: 'Hardware Validation',
    description: 'Checking GPU and system requirements...',
    category: 'validation'
  },
  git_check: {
    label: 'Git Check',
    description: 'Verifying Git installation...',
    category: 'validation'
  },
  welcome_screen: {
    label: 'Welcome',
    description: 'Displaying welcome screen...',
    category: 'initialization'
  },
  install_options_selection: {
    label: 'Installation Options',
    description: 'Selecting installation preferences...',
    category: 'installation'
  },
  creating_directories: {
    label: 'Creating Directories',
    description: 'Setting up folder structure...',
    category: 'installation'
  },
  initializing_config: {
    label: 'Initializing Configuration',
    description: 'Creating configuration files...',
    category: 'installation'
  },
  python_environment_setup: {
    label: 'Python Environment',
    description: 'Setting up Python virtual environment...',
    category: 'installation'
  },
  installing_pytorch: {
    label: 'Installing PyTorch',
    description: 'Installing PyTorch packages...',
    category: 'installation'
  },
  installing_comfyui_requirements: {
    label: 'Installing ComfyUI Requirements',
    description: 'Installing ComfyUI dependencies (this may take a while)...',
    category: 'installation'
  },
  installing_manager_requirements: {
    label: 'Installing Manager Requirements',
    description: 'Installing ComfyUI Manager dependencies...',
    category: 'installation'
  },
  migrating_custom_nodes: {
    label: 'Migrating Custom Nodes',
    description: 'Migrating custom nodes from previous installation...',
    category: 'installation'
  },
  maintenance_mode: {
    label: 'Maintenance Mode',
    description: 'Resolving installation issues...',
    category: 'error'
  },
  starting_server: {
    label: 'Starting Server',
    description: 'Launching ComfyUI server...',
    category: 'completion'
  },
  ready: {
    label: 'Ready',
    description: 'ComfyUI is ready to use!',
    category: 'completion'
  },
  error: {
    label: 'Error',
    description: 'An error occurred during installation',
    category: 'error'
  }
}
