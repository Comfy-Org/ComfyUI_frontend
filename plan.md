# Implementation Plan: Active Job Previews in Assets Sidebar

## Goal
Expose mid-generation preview thumbnails (KSampler-style) in Assets sidebar active job cards and list items, honoring the existing preview setting (no new setting).

## Scope
Frontend files:
- src/components/sidebar/tabs/AssetsSidebarGridView.vue
- src/components/sidebar/tabs/AssetsSidebarListView.vue
- src/platform/assets/components/ActiveMediaAssetCard.vue
- src/platform/assets/components/AssetsListItem.vue
- Supporting composables/stores/utils as needed

Backend files:
- ../ComfyUI (local backend) settings + jobs/preview metadata
- ../cloud (cloud backend) settings defaults

## Plan
1) Investigate current preview signal paths
   - Locate where live previews are received (websocket b_preview_with_metadata).
   - Identify mapping from preview metadata to job/task (prompt_id, display_node_id).
   - Verify existing job display data includes iconImageUrl only for completed jobs.

2) Use existing preview setting
   - Gate live previews on `Comfy.Execution.PreviewMethod`.
   - Treat `none` as disabled; `default`, `auto`, `latent2rgb`, `taesd` as enabled.
   - No new setting or backend defaults.

3) Create a live-preview mapping store/composable
   - Subscribe to websocket preview events and capture latest preview image per prompt_id.
   - Use prompt_id from preview metadata to associate preview with running job.
   - Store latest preview URL per job, and revoke old object URLs to avoid leaks.
   - Respect the new setting: no capture/use when disabled.

4) Extend job list items with live preview URL
   - In useJobList, read the live-preview store and add a new field (e.g., livePreviewUrl) to JobListItem.
   - Ensure only active/running jobs and when preview setting enabled receive the preview.
   - Keep iconImageUrl for completed jobs intact.

5) Wire UI components
   - ActiveMediaAssetCard: prefer livePreviewUrl for running jobs; fallback to iconImageUrl.
   - AssetsSidebarListView: pass livePreviewUrl to AssetsListItem for active jobs.
   - AssetsListItem: allow explicit preview URL override for job rows without affecting asset rows.

6) Backend support
   - ComfyUI: verify preview websocket metadata includes prompt_id (already present) and preview method is respected.
   - Cloud: no settings changes expected; confirm preview metadata is available in websocket.

7) Tests
   - Add/extend unit tests for job list (useJobList) to validate preview field wiring and setting gating.
   - No settings default tests expected.

8) Manual verification checklist
   - Start a generation; confirm active job cards/list items show live previews.
   - Toggle setting off; confirm previews disappear.
   - Completed jobs still show final preview where applicable.
