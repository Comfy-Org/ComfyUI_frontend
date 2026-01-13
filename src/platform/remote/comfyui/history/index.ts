/**
 * @fileoverview History API module - Distribution-aware exports
 * @module platform/remote/comfyui/history
 *
 * This module provides a unified history fetching interface that automatically
 * uses the correct implementation based on build-time distribution constant.
 *
 * - Cloud builds: Uses V2 API with adapter (tree-shakes V1 fetcher)
 * - Desktop/localhost builds: Uses V1 API directly (tree-shakes V2 fetcher + adapter)
 *
 * The rest of the application only needs to import from this module and use
 * V1 types - all distribution-specific details are encapsulated here.
 */

import { isCloud } from '@/platform/distribution/types'
import { fetchHistoryV1 } from './fetchers/fetchHistoryV1'
import { fetchHistoryV2 } from './fetchers/fetchHistoryV2'

/**
 * Fetches history using the appropriate API for the current distribution.
 * Build-time constant enables dead code elimination - only one implementation
 * will be included in the final bundle.
 */
export const fetchHistory = isCloud ? fetchHistoryV2 : fetchHistoryV1

/**
 * Export only V1 types publicly - consumers don't need to know about V2
 */
export type * from './types'
