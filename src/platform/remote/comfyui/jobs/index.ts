/**
 * @fileoverview Jobs API module
 * @module platform/remote/comfyui/jobs
 *
 * Unified jobs API for history, queue, and job details.
 */

export {
  extractWorkflow,
  fetchHistory,
  fetchJobDetail,
  fetchQueue
} from './fetchers/fetchJobs'
