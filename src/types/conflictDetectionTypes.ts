/**
 * Type definitions for the conflict detection system.
 * These types are used to detect compatibility issues between Node Packs and the system environment.
 */

/**
 * Conflict types that can be detected in the system
 * @enum {string}
 */
export type ConflictType =
  | 'comfyui_version' // ComfyUI version mismatch
  | 'frontend_version' // Frontend version mismatch
  | 'python_version' // Python version mismatch
  | 'os' // Operating system incompatibility
  | 'accelerator' // GPU/accelerator incompatibility
  | 'banned' // Banned package
  | 'security_pending' // Security verification pending
  | 'python_dependency' // Python module dependency missing

/**
 * Security scan status for packages
 * @enum {string}
 */
export type SecurityScanStatus = 'pending' | 'passed' | 'failed' | 'unknown'

/**
 * Supported operating systems (as per Registry Admin guide)
 * @enum {string}
 */
export type SupportedOS = 'Windows' | 'macOS' | 'Linux' | 'any'

/**
 * Supported accelerators for GPU computation (as per Registry Admin guide)
 * @enum {string}
 */
export type SupportedAccelerator = 'CUDA' | 'ROCm' | 'Metal' | 'CPU' | 'any'

/**
 * Version comparison operators
 * @enum {string}
 */
export type VersionOperator = '>=' | '>' | '<=' | '<' | '==' | '!='

/**
 * Version requirement specification
 */
export interface VersionRequirement {
  /** @description Comparison operator for version checking */
  operator: VersionOperator
  /** @description Target version string */
  version: string
}

/**
 * Node Pack requirements from Registry API
 */
export interface NodePackRequirements {
  /** @description Unique package identifier */
  package_id: string
  /** @description Human-readable package name */
  package_name: string
  /** @description Currently installed version */
  installed_version: string
  /** @description Whether the package is enabled locally */
  is_enabled: boolean

  /** @description Supported ComfyUI version from Registry */
  supported_comfyui_version?: string
  /** @description Supported frontend version from Registry */
  supported_comfyui_frontend_version?: string
  /** @description List of supported operating systems from Registry */
  supported_os?: SupportedOS[]
  /** @description List of supported accelerators from Registry */
  supported_accelerators?: SupportedAccelerator[]
  /** @description Package dependencies from Registry */
  dependencies?: string[]

  /** @description Node status from Registry (Active/Banned/Deleted) */
  registry_status?:
    | 'NodeStatusActive'
    | 'NodeStatusBanned'
    | 'NodeStatusDeleted'
  /** @description Node version status from Registry */
  version_status?:
    | 'NodeVersionStatusActive'
    | 'NodeVersionStatusBanned'
    | 'NodeVersionStatusDeleted'
    | 'NodeVersionStatusPending'
    | 'NodeVersionStatusFlagged'
  /** @description Whether package is banned (derived from status) */
  is_banned: boolean
  /** @description Reason for ban if applicable */
  ban_reason?: string

  // Metadata
  /** @description Registry data fetch timestamp */
  registry_fetch_time: string
  /** @description Whether Registry data was successfully fetched */
  has_registry_data: boolean
}

/**
 * Current system environment information
 */
export interface SystemEnvironment {
  // Version information
  /** @description Current ComfyUI version */
  comfyui_version: string
  /** @description Current frontend version */
  frontend_version: string
  /** @description Current Python version */
  python_version: string

  // Platform information
  /** @description Operating system type */
  os: SupportedOS
  /** @description Detailed platform information (e.g., 'Darwin 24.5.0', 'Windows 10') */
  platform_details: string
  /** @description System architecture (e.g., 'x64', 'arm64') */
  architecture: string

  // GPU/accelerator information
  /** @description List of available accelerators */
  available_accelerators: SupportedAccelerator[]
  /** @description Primary accelerator in use */
  primary_accelerator: SupportedAccelerator
  /** @description GPU memory in megabytes, if available */
  gpu_memory_mb?: number

  // Runtime information
  /** @description Node.js environment mode */
  node_env: 'development' | 'production'
  /** @description Browser user agent string */
  user_agent: string
}

/**
 * Individual conflict detection result for a package
 */
export interface ConflictDetectionResult {
  /** @description Package identifier */
  package_id: string
  /** @description Package name */
  package_name: string
  /** @description Whether any conflicts were detected */
  has_conflict: boolean
  /** @description List of detected conflicts */
  conflicts: ConflictDetail[]
  /** @description Overall compatibility status */
  is_compatible: boolean
}

/**
 * Detailed information about a specific conflict
 */
export interface ConflictDetail {
  /** @description Type of conflict detected */
  type: ConflictType
  /** @description Human-readable description of the conflict */
  current_value: string
  /** @description Required value for compatibility */
  required_value: string
}

/**
 * Overall conflict detection summary
 */
export interface ConflictDetectionSummary {
  /** @description Total number of packages checked */
  total_packages: number
  /** @description Number of compatible packages */
  compatible_packages: number
  /** @description Number of packages with conflicts */
  conflicted_packages: number
  /** @description Number of banned packages */
  banned_packages: number
  /** @description Number of packages pending security verification */
  security_pending_packages: number
  /** @description Node IDs grouped by conflict type */
  conflicts_by_type_details: Record<ConflictType, string[]>
  /** @description Timestamp of the last conflict check */
  last_check_timestamp: string
  /** @description Duration of the conflict check in milliseconds */
  check_duration_ms: number
}

/**
 * Response payload from conflict detection API
 */
export interface ConflictDetectionResponse {
  /** @description Whether the API request was successful */
  success: boolean
  /** @description Error message if the request failed */
  error_message?: string

  /** @description Summary of the conflict detection results */
  summary: ConflictDetectionSummary
  /** @description Detailed results for each package */
  results: ConflictDetectionResult[]

  /** @description System environment information detected by the server (for comparison) */
  detected_system_environment?: Partial<SystemEnvironment>
}
