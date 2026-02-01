# 1.38.x Release - QA Testing Guide

## Queue & Job Management

### Active Jobs Display & Queue Progress
- Add active jobs display to grid view [#8209](https://github.com/Comfy-Org/ComfyUI_frontend/pull/8209)
- feat: show active jobs label in top menu [#8169](https://github.com/Comfy-Org/ComfyUI_frontend/pull/8169)
- feat: enable new queue progress by default [#8121](https://github.com/Comfy-Org/ComfyUI_frontend/pull/8121)
- refactor: use orderBy for queue list sorting [#8228](https://github.com/Comfy-Org/ComfyUI_frontend/pull/8228)

**How to test:**
- Queue multiple workflows and verify active jobs appear in grid view
- Check top menu shows active job count during execution
- Verify queue items display in chronological order (newest first)
- Monitor new progress UI during workflow execution

---

## Workflow & Tab Management

### Workflow Persistence & Bulk Operations
- Feat: Persist all unsaved workflow tabs [#6050](https://github.com/Comfy-Org/ComfyUI_frontend/pull/6050)
- feat: add bulk actions for workflow operations in media assets [#7992](https://github.com/Comfy-Org/ComfyUI_frontend/pull/7992)
- Replace QPO with opening assets tab [#8260](https://github.com/Comfy-Org/ComfyUI_frontend/pull/8260)

**How to test:**
- Create/modify workflows without saving, refresh page, verify tabs persist
- Open media assets, select multiple workflows, use bulk actions (delete, download, etc.)
- Click "Quick Prompt Options" button - should open assets tab instead

---

## Node Widgets & Canvas

### Visual Crop Preview & 3D Thumbnails
- feat: Add visual crop preview widget for ImageCrop node [#7825](https://github.com/Comfy-Org/ComfyUI_frontend/pull/7825)
- add thumbnail for 3d generation [#8129](https://github.com/Comfy-Org/ComfyUI_frontend/pull/8129)

**How to test:**
- Add ImageCrop node, adjust crop parameters, verify visual preview updates in real-time
- Generate 3D output, verify thumbnail appears in output panel

---

## Node Help & Documentation

### Decoupled Node Help
- Decouple node help between sidebar and right panel [#8110](https://github.com/Comfy-Org/ComfyUI_frontend/pull/8110)

**How to test:**
- Open node library sidebar, click help icon on a node
- Open right panel node help for same node
- Verify both work independently without interfering

---

## UI/UX Improvements

### Image Selection & Feedback
- fix: image selection modal Inputs Outputs filtering is not working [#8272](https://github.com/Comfy-Org/ComfyUI_frontend/pull/8272)
- feat: enable feedback button on nightly releases [#8220](https://github.com/Comfy-Org/ComfyUI_frontend/pull/8220)

**How to test:**
- Open image selection modal, toggle Inputs/Outputs filters, verify filtering works
- On nightly build, verify feedback button appears in UI

---

## Platform & Subscription

### Platform URLs & Subscription Links
- fix: use staging platform URL for usage history link [#8056](https://github.com/Comfy-Org/ComfyUI_frontend/pull/8056)
- feat: handling subscription tier button link parameter [#7553](https://github.com/Comfy-Org/ComfyUI_frontend/pull/7553)

**How to test:**
- Click usage history link, verify opens correct staging URL
- Navigate to subscription tier buttons, verify links include proper parameters

---

## Build & Infrastructure

### Vite 8 & Error Handling
- feat: upgrade vite to v8.0.0-beta.8 (Rolldown-powered) [#8127](https://github.com/Comfy-Org/ComfyUI_frontend/pull/8127)
- fix: replace vite preload error reload with error logging [#8261](https://github.com/Comfy-Org/ComfyUI_frontend/pull/8261)

**How to test:**
- Verify app loads without errors in console
- Check for any build/bundling issues
- Monitor network tab for preload errors (should log, not reload)

---

## Miscellaneous

### PWA & Price Badges
- fix: add missing pwa icon in manifest.json [#8071](https://github.com/Comfy-Org/ComfyUI_frontend/pull/8071)
- Move price badges to python nodes [#7816](https://github.com/Comfy-Org/ComfyUI_frontend/pull/7816)

**How to test:**
- Check PWA manifest has all required icons
- Verify price badges display correctly on relevant nodes (should be server-side now)
