# Network Activity Audit - ComfyUI Frontend

## Overview
This document provides a comprehensive audit of all network activity in the ComfyUI frontend codebase, organized by request type and location. This audit was conducted to support the implementation of an extensible header system for all network requests.

## 1. WebSocket Connections

### Primary WebSocket API
- **Location**: `src/scripts/api.ts`
- **URL Pattern**: `ws(s)://${host}${api_base}/ws`
- **Purpose**: Real-time communication with ComfyUI backend
- **Features**:
  - Status updates
  - Execution progress
  - Binary previews
  - Log streaming
  - Feature flag updates
- **Auto-reconnect**: 300ms delay

## 2. HTTP Clients

### 2.1 Core API Client
- **Location**: `src/scripts/api.ts`
- **Methods**: Mixed usage of `fetch()` and `axios`
- **Custom Wrapper**: `fetchApi()` method with auth header support
- **Endpoints**:
  - `/api/prompt` - Queue prompts
  - `/api/queue` - Queue management
  - `/api/history` - Execution history
  - `/api/interrupt` - Interrupt execution
  - `/api/object_info` - Node definitions (called early in lifecycle)
  - `/api/embeddings` - Embedding data
  - `/api/extensions` - Extensions list
  - `/api/settings` - User settings
  - `/api/userdata/*` - User data storage
  - `/api/system_stats` - System statistics
  - `/api/experiment/models/*` - Model management
  - `/api/workflow_templates` - Workflow templates
  - `/api/i18n` - Internationalization data
  - `/internal/logs` - Server logs
  - `/internal/folder_paths` - Folder paths

### 2.2 Service Classes

#### ComfyUI Manager Service
- **Location**: `src/services/comfyManagerService.ts`
- **HTTP Client**: axios exclusively
- **Base URL**: Same as main API
- **Endpoints**:
  - `/api/manager/queue/*`
  - `/api/customnode/*`
  - `/api/manager/reboot`

#### Comfy Registry Service
- **Location**: `src/services/comfyRegistryService.ts`
- **HTTP Client**: axios with custom instance
- **Base URL**: `https://api.comfy.org`
- **External API**: Yes
- **Endpoints**:
  - Node pack search
  - Publisher information
  - Pack versions and reviews

#### Customer Events Service
- **Location**: `src/services/customerEventsService.ts`
- **HTTP Client**: axios
- **Base URL**: `COMFY_API_BASE_URL` (configurable)
- **Authentication**: Firebase auth headers
- **Endpoints**: `/customers/events`

#### Other Services
- **Release Service**: `src/services/releaseService.ts` (axios)
- **Node Help Service**: `src/services/nodeHelpService.ts` (fetch)
- **Media Cache Service**: `src/services/mediaCacheService.ts` (fetch with blob handling)

## 3. Direct Network Calls Outside Services

### Firebase Auth Store
- **Location**: `src/stores/firebaseAuthStore.ts`
- **HTTP Client**: Direct fetch()
- **Endpoints**:
  - `/customers` - Customer creation
  - `/customers/credit` - Credit purchases
  - `/customers/billing` - Billing portal
  - `/customers/balance` - Balance retrieval

### Network Utility
- **Location**: `src/utils/networkUtil.ts`
- **HTTP Client**: Direct fetch() and axios.head()
- **External URLs**:
  - `https://www.google.com` - China firewall detection
  - `https://www.baidu.com` - China latency test

### Extension and Feature Code
- **Template Workflows**: `src/composables/useTemplateWorkflows.ts` (fetch)
- **Upload Audio**: `src/extensions/core/uploadAudio.ts` (fetch)
- **3D Loading**: `src/extensions/core/load3d/Load3dUtils.ts` (fetch)
- **Model Exporter**: `src/extensions/core/load3d/ModelExporter.ts` (fetch)
- **CivitAI Integration**: `src/composables/useCivitaiModel.ts` (fetch)
- **Download Utility**: `src/composables/useDownload.ts` (fetch)
- **Workflow Packs**: `src/composables/nodePack/useWorkflowPacks.ts` (fetch)
- **Installed Packs**: `src/composables/nodePack/useInstalledPacks.ts` (fetch)

## 4. XMLHttpRequest Usage
- **Location**: `src/lib/litegraph/src/LGraph.ts`
- **Usage**: Limited, within LiteGraph library

## 5. Server-Sent Events (SSE)
- **None found** in the codebase

## Summary

### HTTP Client Distribution
1. **axios**: 6 service classes + network utility
2. **fetch**: 11+ locations (core API, stores, composables, extensions)
3. **XMLHttpRequest**: 1 location (LiteGraph)
4. **WebSocket**: 1 centralized implementation

### Key Findings
1. **Mixed client usage**: Both fetch() and axios are used throughout
2. **Scattered direct calls**: Many direct fetch() calls outside service classes
3. **Early requests**: `/api/object_info` called before extension init
4. **External APIs**: Multiple external API integrations
5. **Auth complexity**: Different auth patterns (Firebase, custom headers)

### Consolidation Opportunities
1. **High**: Service classes already use consistent patterns
2. **Medium**: Direct fetch() calls could be migrated to services
3. **Low**: LiteGraph XMLHttpRequest (library code)

### Critical Early Requests
These requests happen before extension `init()`:
- `/api/object_info` - Node definitions
- `/api/embeddings` - Embedding data
- Initial WebSocket connection

This audit provides the foundation for implementing a comprehensive header registration system that can intercept all network activity.