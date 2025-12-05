# Feature Flags System Explanation

## Overview

The `useFeatureFlag` hook (actually named `useFeatureFlags`) is a Vue 3 composable that provides **reactive access to server-side feature flags** received via WebSocket from the backend. It enables capability negotiation between frontend and backend, allowing the UI to adapt based on what features the server supports.

## Architecture Flow

```
1. Frontend connects via WebSocket
2. Frontend sends client feature flags (first message)
3. Backend responds with server feature flags
4. Frontend stores flags in api.serverFeatureFlags
5. Components use useFeatureFlags() to access flags reactively
```

## Core Implementation

### 1. The `useFeatureFlags` Composable

**Location:** `src/composables/useFeatureFlags.ts`

The composable returns two things:

#### A. Predefined `flags` Object
A reactive object with getter properties for commonly-used feature flags:

```typescript
const { flags } = useFeatureFlags()

// Access predefined flags
flags.supportsPreviewMetadata  // boolean | undefined
flags.maxUploadSize            // number | undefined
flags.supportsManagerV4        // boolean | undefined
flags.modelUploadButtonEnabled // boolean (checks remoteConfig first)
flags.assetUpdateOptionsEnabled // boolean (checks remoteConfig first)
```

**Key Points:**
- Uses Vue's `reactive()` to make the object reactive
- Each getter calls `api.getServerFeature()` which reads from `api.serverFeatureFlags`
- Some flags (like `modelUploadButtonEnabled`) check `remoteConfig` first (from `/api/features` endpoint) before falling back to WebSocket flags
- Returns a `readonly()` wrapper to prevent external mutation

#### B. Generic `featureFlag` Function
A function that creates a computed ref for any feature flag path:

```typescript
const { featureFlag } = useFeatureFlags()

// Create a reactive computed ref for any flag
const myFlag = featureFlag('custom.feature.path', false) // defaultValue is optional
// myFlag is a ComputedRef that updates when serverFeatureFlags changes
```

**Key Points:**
- Accepts any string path (supports dot notation for nested values)
- Returns a `computed()` ref that automatically updates when flags change
- Generic type parameter allows type safety: `featureFlag<boolean>('flag', false)`

### 2. The Underlying API Layer

**Location:** `src/scripts/api.ts`

The `ComfyApi` class manages feature flags:

```typescript
class ComfyApi {
  // Stores flags received from backend
  serverFeatureFlags: Record<string, unknown> = {}
  
  // Retrieves a flag value using dot notation
  getServerFeature<T>(featureName: string, defaultValue?: T): T {
    return get(this.serverFeatureFlags, featureName, defaultValue) as T
  }
}
```

**How Flags Are Received:**
1. WebSocket connection is established
2. Frontend sends client feature flags as first message
3. Backend responds with a `feature_flags` message type
4. The message handler stores it: `this.serverFeatureFlags = msg.data`

**The `get` Function:**
- Uses `es-toolkit/compat`'s `get` function (lodash-style)
- Supports dot notation: `'extension.manager.supports_v4'` accesses nested objects
- Returns `defaultValue` if the path doesn't exist

### 3. Remote Config Integration

**Location:** `src/platform/remoteConfig/remoteConfig.ts`

Some flags check `remoteConfig` first (loaded from `/api/features` endpoint):

```typescript
// Example from modelUploadButtonEnabled
return (
  remoteConfig.value.model_upload_button_enabled ??  // Check remote config first
  api.getServerFeature(ServerFeatureFlag.MODEL_UPLOAD_BUTTON_ENABLED, false)  // Fallback
)
```

**Why Two Sources?**
- `remoteConfig`: Fetched via HTTP at app startup, can be updated without WebSocket
- WebSocket flags: Real-time capability negotiation, updated on reconnection

## Usage Patterns

### Pattern 1: Using Predefined Flags

```typescript
import { useFeatureFlags } from '@/composables/useFeatureFlags'

const { flags } = useFeatureFlags()

// In template
if (flags.supportsPreviewMetadata) {
  // Use enhanced preview feature
}

// In script
const maxSize = flags.maxUploadSize ?? 100 * 1024 * 1024 // Default 100MB
```

### Pattern 2: Using Generic featureFlag Function

```typescript
import { useFeatureFlags } from '@/composables/useFeatureFlags'

const { featureFlag } = useFeatureFlags()

// Create a reactive computed ref
const customFeature = featureFlag<boolean>('extension.custom.feature', false)

// Use in template (automatically reactive)
// <div v-if="customFeature">New Feature UI</div>

// Use in script
watch(customFeature, (enabled) => {
  if (enabled) {
    // Feature was enabled
  }
})
```

### Pattern 3: Direct API Access (Non-Reactive)

```typescript
import { api } from '@/scripts/api'

// Direct access (not reactive, use sparingly)
if (api.serverSupportsFeature('supports_preview_metadata')) {
  // Feature is supported
}

const maxSize = api.getServerFeature('max_upload_size', 100 * 1024 * 1024)
```

## Reactivity Explained

The composable is **reactive** because:

1. **Predefined flags**: Use `reactive()` with getters, so when `api.serverFeatureFlags` changes, Vue's reactivity system detects it
2. **Generic featureFlag**: Returns `computed()`, which automatically tracks `api.getServerFeature()` calls and re-evaluates when flags change
3. **WebSocket updates**: When flags are updated via WebSocket, `api.serverFeatureFlags` is reassigned, triggering reactivity

## Adding New Feature Flags

### Step 1: Add to Enum (if it's a core flag)

```typescript
// In useFeatureFlags.ts
export enum ServerFeatureFlag {
  // ... existing flags
  MY_NEW_FEATURE = 'my_new_feature'
}
```

### Step 2: Add to flags Object (if commonly used)

```typescript
// In useFeatureFlags.ts flags object
get myNewFeature() {
  return api.getServerFeature(ServerFeatureFlag.MY_NEW_FEATURE, false)
}
```

### Step 3: Use in Components

```typescript
const { flags } = useFeatureFlags()
if (flags.myNewFeature) {
  // Use the feature
}
```

**OR** use the generic function without modifying the composable:

```typescript
const { featureFlag } = useFeatureFlags()
const myFeature = featureFlag('my_new_feature', false)
```

## Important Notes

1. **Flags are server-driven**: The backend controls which flags are available
2. **Default values**: Always provide sensible defaults when using `getServerFeature()`
3. **Reactivity**: The composable ensures UI updates automatically when flags change (e.g., on WebSocket reconnection)
4. **Type safety**: Use TypeScript generics with `featureFlag<T>()` for type safety
5. **Dot notation**: Feature flags can be nested, use dot notation: `'extension.manager.supports_v4'`
6. **Remote config priority**: Some flags check `remoteConfig` first, then fall back to WebSocket flags

## Testing

See `tests-ui/tests/composables/useFeatureFlags.test.ts` for examples of:
- Mocking `api.getServerFeature()`
- Testing reactive behavior
- Testing default values
- Testing nested paths

## Related Files

- `src/composables/useFeatureFlags.ts` - The main composable
- `src/scripts/api.ts` - API layer with `getServerFeature()` method
- `src/platform/remoteConfig/remoteConfig.ts` - Remote config integration
- `docs/FEATURE_FLAGS.md` - Full system documentation
- `tests-ui/tests/composables/useFeatureFlags.test.ts` - Unit tests

