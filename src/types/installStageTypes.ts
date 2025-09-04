/**
 * Installation stage tracking types
 * Re-exports types from the electron package and adds frontend-specific metadata
 */
import type { InstallStageType } from '@comfyorg/comfyui-electron-types'

// Re-export the types from electron package
export type {
  InstallStageInfo,
  InstallStageType
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
export const STAGE_METADATA: Record<InstallStageType, StageMetadata> = {
  idle: {
    label: 'Idle',
    progress: 0,
    category: 'initialization'
  },
  app_initializing: {
    label: 'Initializing App',
    description: 'Starting the application...',
    progress: 2,
    category: 'initialization'
  },
  checking_existing_install: {
    label: 'Checking Installation',
    description: 'Verifying existing ComfyUI installation...',
    progress: 5,
    category: 'initialization'
  },
  hardware_validation: {
    label: 'Hardware Validation',
    description: 'Checking GPU and system requirements...',
    progress: 10,
    category: 'validation'
  },
  git_check: {
    label: 'Git Check',
    description: 'Verifying Git installation...',
    progress: 15,
    category: 'validation'
  },
  welcome_screen: {
    label: 'Welcome',
    description: 'Displaying welcome screen...',
    progress: 20,
    category: 'initialization'
  },
  install_options_selection: {
    label: 'Installation Options',
    description: 'Selecting installation preferences...',
    progress: 25,
    category: 'installation'
  },
  creating_directories: {
    label: 'Creating Directories',
    description: 'Setting up folder structure...',
    progress: 30,
    category: 'installation'
  },
  initializing_config: {
    label: 'Initializing Configuration',
    description: 'Creating configuration files...',
    progress: 35,
    category: 'installation'
  },
  python_environment_setup: {
    label: 'Python Environment',
    description: 'Setting up Python virtual environment...',
    progress: 40,
    category: 'installation'
  },
  installing_requirements: {
    label: 'Installing Requirements',
    description: 'Installing Python packages (this may take a while)...',
    progress: 50,
    category: 'installation'
  },
  migrating_custom_nodes: {
    label: 'Migrating Custom Nodes',
    description: 'Migrating custom nodes from previous installation...',
    progress: 70,
    category: 'installation'
  },
  validation_in_progress: {
    label: 'Validation',
    description: 'Starting validation process...',
    progress: 75,
    category: 'validation'
  },
  validation_basepath: {
    label: 'Validating Base Path',
    description: 'Verifying installation path...',
    progress: 77,
    category: 'validation'
  },
  validation_venv: {
    label: 'Validating Environment',
    description: 'Checking virtual environment...',
    progress: 79,
    category: 'validation'
  },
  validation_python: {
    label: 'Validating Python',
    description: 'Verifying Python interpreter...',
    progress: 81,
    category: 'validation'
  },
  validation_uv: {
    label: 'Validating UV',
    description: 'Checking UV package manager...',
    progress: 83,
    category: 'validation'
  },
  validation_packages: {
    label: 'Validating Packages',
    description: 'Verifying required packages...',
    progress: 85,
    category: 'validation'
  },
  validation_git: {
    label: 'Validating Git',
    description: 'Confirming Git availability...',
    progress: 87,
    category: 'validation'
  },
  validation_vcredist: {
    label: 'Validating Visual C++',
    description: 'Checking Visual C++ Redistributable...',
    progress: 89,
    category: 'validation'
  },
  maintenance_mode: {
    label: 'Maintenance Mode',
    description: 'Resolving installation issues...',
    progress: 90,
    category: 'error'
  },
  starting_server: {
    label: 'Starting Server',
    description: 'Launching ComfyUI server...',
    progress: 95,
    category: 'completion'
  },
  ready: {
    label: 'Ready',
    description: 'ComfyUI is ready to use!',
    progress: 100,
    category: 'completion'
  },
  error: {
    label: 'Error',
    description: 'An error occurred during installation',
    progress: 0,
    category: 'error'
  }
}
