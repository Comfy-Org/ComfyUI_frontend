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

/**
 * Security scan status for packages
 * @enum {string}
 */
export type SecurityScanStatus = 'pending' | 'passed' | 'failed' | 'unknown'

/**
 * Supported operating systems
 * @enum {string}
 */
export type SupportedOS = 'windows' | 'macos' | 'linux' | 'any'

/**
 * Supported accelerators for GPU computation
 * @enum {string}
 */
export type SupportedAccelerator = 'cuda' | 'rocm' | 'mps' | 'cpu' | 'any'

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
 * Registry API에서 가져온 노드 팩 요구사항 정보
 */
export interface NodePackRequirements {
  // Package basic information / 패키지 기본 정보
  /** @description Unique package identifier / 고유 패키지 식별자 */
  package_id: string
  /** @description Human-readable package name / 사람이 읽을 수 있는 패키지 이름 */
  package_name: string
  /** @description Currently installed version / 현재 설치된 버전 */
  installed_version: string
  /** @description Whether the package is enabled locally / 로컬에서 패키지가 활성화되어 있는지 */
  is_enabled: boolean

  // Registry compatibility data / Registry 호환성 데이터
  /** @description Supported ComfyUI version from Registry / Registry에서 가져온 지원 ComfyUI 버전 */
  supported_comfyui_version?: string
  /** @description Supported frontend version from Registry / Registry에서 가져온 지원 프론트엔드 버전 */
  supported_comfyui_frontend_version?: string
  /** @description List of supported operating systems from Registry / Registry에서 가져온 지원 OS 목록 */
  supported_os?: SupportedOS[]
  /** @description List of supported accelerators from Registry / Registry에서 가져온 지원 가속기 목록 */
  supported_accelerators?: SupportedAccelerator[]
  /** @description Package dependencies from Registry / Registry에서 가져온 패키지 의존성 */
  dependencies?: string[]

  // Status information / 상태 정보
  /** @description Node status from Registry (Active/Banned/Deleted) / Registry의 노드 상태 */
  registry_status?:
    | 'NodeStatusActive'
    | 'NodeStatusBanned'
    | 'NodeStatusDeleted'
  /** @description Node version status from Registry / Registry의 노드 버전 상태 */
  version_status?:
    | 'NodeVersionStatusActive'
    | 'NodeVersionStatusBanned'
    | 'NodeVersionStatusDeleted'
    | 'NodeVersionStatusPending'
    | 'NodeVersionStatusFlagged'
  /** @description Whether package is banned (derived from status) / 패키지 금지 여부 (상태에서 파생) */
  is_banned: boolean
  /** @description Reason for ban if applicable / 금지 이유 (해당하는 경우) */
  ban_reason?: string

  // Metadata / 메타데이터
  /** @description Registry data fetch timestamp / Registry 데이터 가져온 시각 */
  registry_fetch_time: string
  /** @description Whether Registry data was successfully fetched / Registry 데이터 성공적으로 가져왔는지 */
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
  /** @description Whether conflicts can be automatically resolved */
  can_auto_resolve: boolean
  /** @description Recommended action to resolve conflicts */
  recommended_action: RecommendedAction
}

/**
 * Detailed information about a specific conflict
 */
export interface ConflictDetail {
  /** @description Type of conflict detected */
  type: ConflictType
  /** @description Severity level of the conflict */
  severity: 'error' | 'warning' | 'info'
  /** @description Human-readable description of the conflict */
  description: string
  /** @description Current system value */
  current_value: string
  /** @description Required value for compatibility */
  required_value: string
  /** @description Optional steps to resolve the conflict */
  resolution_steps?: string[]
}

/**
 * Recommended action to resolve conflicts
 */
export interface RecommendedAction {
  /** @description Type of action to take */
  action_type: 'disable' | 'update' | 'ignore' | 'manual_review'
  /** @description Reason for the recommended action */
  reason: string
  /** @description Step-by-step instructions */
  steps: string[]
  /** @description Estimated difficulty of implementing the action */
  estimated_difficulty: 'easy' | 'medium' | 'hard'
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

  /** @description Breakdown of conflicts by type */
  conflicts_by_type: Record<ConflictType, number>

  /** @description Timestamp of the last conflict check */
  last_check_timestamp: string
  /** @description Duration of the conflict check in milliseconds */
  check_duration_ms: number
}

/**
 * API request/response interfaces
 */

/**
 * Request payload for conflict detection API
 */
export interface ConflictDetectionRequest {
  /** @description Current system environment information */
  system_environment: SystemEnvironment
  /** @description Optional list of specific package IDs to check */
  package_ids?: string[]
  /** @description Whether to include banned packages in the check */
  include_banned?: boolean
  /** @description Whether to include security-pending packages in the check */
  include_security_pending?: boolean
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

/**
 * Real-time conflict detection event
 */
export interface ConflictDetectionEvent {
  /** @description Type of event */
  event_type:
    | 'conflict_detected'
    | 'conflict_resolved'
    | 'scan_started'
    | 'scan_completed'
  /** @description Event timestamp */
  timestamp: string
  /** @description Package ID associated with the event, if applicable */
  package_id?: string
  /** @description Type of conflict, if applicable */
  conflict_type?: ConflictType
  /** @description Additional event details */
  details?: string
}
