# ComfyUI Feature Flags System

## Overview

The ComfyUI feature flags system enables capability negotiation between frontend and backend, allowing both sides to communicate their supported features and adapt behavior accordingly. This ensures backward compatibility while enabling progressive enhancement of features.

## System Architecture

### High-Level Flow

```mermaid
sequenceDiagram
    participant Frontend
    participant WebSocket
    participant Backend
    participant FeatureFlags Module

    Frontend->>WebSocket: Connect
    WebSocket-->>Frontend: Connection established

    Note over Frontend: First message must be feature flags
    Frontend->>WebSocket: Send client feature flags
    WebSocket->>Backend: Receive feature flags
    Backend->>FeatureFlags Module: Store client capabilities

    Backend->>FeatureFlags Module: Get server features
    FeatureFlags Module-->>Backend: Return server capabilities
    Backend->>WebSocket: Send server feature flags
    WebSocket-->>Frontend: Receive server features

    Note over Frontend,Backend: Both sides now know each other's capabilities

    Frontend->>Frontend: Store server features
    Frontend->>Frontend: Components use useFeatureFlags()
```

### Component Architecture

```mermaid
graph TB
    subgraph Frontend
        A[clientFeatureFlags.json] --> B[api.ts]
        B --> C[WebSocket Handler]
        D[useFeatureFlags composable] --> B
        E[Vue Components] --> D
    end

    subgraph Backend
        F[feature_flags.py] --> G[SERVER_FEATURE_FLAGS]
        H[server.py WebSocket] --> F
        I[Feature Consumers] --> F
    end

    C <--> H

    style A fill:#f9f,stroke:#333,stroke-width:2px
    style G fill:#f9f,stroke:#333,stroke-width:2px
    style D fill:#9ff,stroke:#333,stroke-width:2px
```

## Feature Flag Structure

Feature flags are organized as a flat dictionary at the top level, with extensions nested under an `extension` object:

### Naming Convention

- **Core features**: Top-level keys (e.g., `"async_execution"`, `"supports_batch_queue"`)
- **Client features**: Top-level keys (e.g., `"supports_preview_metadata"`)
- **Extensions**: Nested under `"extension"` object (e.g., `extension.manager`)

### Structure Example

```json
{
  "async_execution": true,
  "supports_batch_queue": false,
  "supports_preview_metadata": true,
  "supports_websocket_v2": false,
  "max_upload_size": 104857600,
  "extension": {
    "manager": {
      "supports_v4": true,
      "supports_ai_search": false
    }
  }
}
```

## Implementation Details

### Backend Implementation

```mermaid
classDiagram
    class FeatureFlagsModule {
        +SERVER_FEATURE_FLAGS: Dict
        +get_server_features() Dict
        +supports_feature(sockets_metadata, sid, feature_name) bool
        +get_connection_feature(sockets_metadata, sid, feature_name, default) Any
    }

    class PromptServer {
        -sockets_metadata: Dict
        +websocket_handler()
        +send()
    }

    class FeatureConsumer {
        <<interface>>
        +check_feature()
        +use_feature()
    }

    PromptServer --> FeatureFlagsModule
    FeatureConsumer --> FeatureFlagsModule
```

### Frontend Implementation

The `useFeatureFlags` composable provides reactive access to feature flags, meaning components will automatically update when feature flags change (e.g., during WebSocket reconnection).

```mermaid
classDiagram
    class ComfyApi {
        +serverFeatureFlags: Record~string, unknown~
        +getClientFeatureFlags() Record
        +serverSupportsFeature(name) boolean
        +getServerFeature(name, default) T
    }

    class useFeatureFlags {
        +serverSupports(name) boolean
        +getServerFeature(name, default) T
        +createServerFeatureFlag(name) ComputedRef
        +extension: ExtensionFlags
    }

    class VueComponent {
        <<component>>
        +setup()
    }

    ComfyApi <-- useFeatureFlags
    VueComponent --> useFeatureFlags
```

## Examples

### 1. Preview Metadata Support

```mermaid
graph LR
    A[Preview Generation] --> B{supports_preview_metadata?}
    B -->|Yes| C[Send metadata with preview]
    B -->|No| D[Send preview only]

    C --> E[Enhanced preview with node info]
    D --> F[Basic preview image]
```

**Backend Usage:**

```python
# Check if client supports preview metadata
if feature_flags.supports_feature(
    self.server_instance.sockets_metadata,
    self.server_instance.client_id,
    "supports_preview_metadata"
):
    # Send enhanced preview with metadata
    metadata = {
        "node_id": node_id,
        "prompt_id": prompt_id,
        "display_node_id": display_node_id,
        "parent_node_id": parent_node_id,
        "real_node_id": real_node_id,
    }
    self.server_instance.send_sync(
        BinaryEventTypes.PREVIEW_IMAGE_WITH_METADATA,
        (image, metadata),
        self.server_instance.client_id,
    )
```

### 2. Max Upload Size

```mermaid
graph TB
    A[Client File Upload] --> B[Check max_upload_size]
    B --> C{File size OK?}
    C -->|Yes| D[Upload file]
    C -->|No| E[Show error]

    F[Backend] --> G[Set from CLI args]
    G --> H[Convert MB to bytes]
    H --> I[Include in feature flags]
```

**Backend Configuration:**

```python
# In feature_flags.py
SERVER_FEATURE_FLAGS = {
    "supports_preview_metadata": True,
    "max_upload_size": args.max_upload_size * 1024 * 1024,  # Convert MB to bytes
}
```

**Frontend Usage:**

```typescript
const { getServerFeature } = useFeatureFlags()
const maxUploadSize = getServerFeature('max_upload_size', 100 * 1024 * 1024) // Default 100MB
```

## Using Feature Flags

### Frontend Access Patterns

1. **Direct API access:**

```typescript
// Check boolean feature
if (api.serverSupportsFeature('supports_preview_metadata')) {
  // Feature is supported
}

// Get feature value with default
const maxSize = api.getServerFeature('max_upload_size', 100 * 1024 * 1024)
```

2. **Using the composable (recommended for reactive components):**

```typescript
const { serverSupports, getServerFeature, extension } = useFeatureFlags()

// Check feature support
if (serverSupports('supports_preview_metadata')) {
  // Use enhanced previews
}

// Use reactive convenience properties (automatically update if flags change)
if (extension.manager.supportsV4.value) {
  // Use V4 manager API
}
```

3. **Reactive usage in templates:**

```vue
<template>
  <div v-if="featureFlags.extension.manager.supportsV4">
    <!-- V4-specific UI -->
  </div>
  <div v-else>
    <!-- Legacy UI -->
  </div>
</template>

<script setup>
import { useFeatureFlags } from '@/composables/useFeatureFlags'
const featureFlags = useFeatureFlags()
</script>
```

### Backend Access Patterns

```python
# Check if a specific client supports a feature
if feature_flags.supports_feature(
    sockets_metadata,
    client_id,
    "supports_preview_metadata"
):
    # Client supports this feature

# Get feature value with default
max_size = feature_flags.get_connection_feature(
    sockets_metadata,
    client_id,
    "max_upload_size",
    100 * 1024 * 1024  # Default 100MB
)
```

## Adding New Feature Flags

### High-risk Cloud PRs

A `risk:high` or `risk:xhigh` PR that changes Cloud runtime behavior must be
operationally inert while its rollout flag is OFF. The flag may be new or
pre-existing, but it must fail closed in code and be OFF for every Cloud
production cohort when the PR merges.

![Risk disputes override the effective PR risk before high-risk Cloud changes enter the default-OFF flag or approved exception paths.](./images/high-risk-cloud-pr-flag-contract.png)

`clientFeatureFlags.json` advertises client capabilities. It is not a rollout
control and does not satisfy this policy.

The merge gate determines runtime scope from the changed files and the classes
in `.github/risk.json`; the PR author's **Cloud runtime change** answer is
reviewer context, not a bypass. Files classified only as `risk-map`,
`codeowners`, `ci`, `deps`, `build-config`, `website`, `docs`, `i18n-copy`,
`storybook`, or `tests` are outside this feature-flag gate.

For an in-scope change, complete the PR template with:

1. The flag key and whether it is new or existing.
2. Code showing that the flag exists and defaults to OFF.
3. Source-of-truth evidence that every Cloud production cohort is OFF.
4. A description of what still runs while the flag is OFF.
5. An automated test covering the OFF path.

If a flag cannot isolate the change safely, select a fixed exception reason,
provide validation and rollback evidence, and ask any `comfy_frontend_devs`
reviewer to apply the `flag-exempt` label. Urgency alone is not an exception.

With the flag OFF, merging the PR must not change observable Cloud behavior or
cause new side effects.

### Example

```markdown
## Feature flag

- **Cloud runtime change**: yes
- **Flag**: unified_cloud_auth
- **Flag source**: existing
- **Default-OFF code evidence**: src/composables/useFeatureFlags.ts:221
- **Production-OFF evidence**: https://example.internal/flags/unified_cloud_auth
- **Flag-OFF behavior**: Existing authentication flow remains unchanged.
- **Flag-OFF test**: src/composables/useFeatureFlags.test.ts:715
- **Exception**: none
- **Exception evidence**: N/A
```

### Backend

1. **For server capabilities**, add to `SERVER_FEATURE_FLAGS` in `comfy_api/feature_flags.py`:

```python
SERVER_FEATURE_FLAGS = {
    "supports_preview_metadata": True,
    "max_upload_size": args.max_upload_size * 1024 * 1024,
    "your_new_feature": True,  # Add your flag
}
```

2. **Use in your code:**

```python
if feature_flags.supports_feature(sockets_metadata, sid, "your_new_feature"):
    # Feature-specific code
```

### Frontend

1. **For client capabilities**, add to `src/config/clientFeatureFlags.json`:

```json
{
  "supports_preview_metadata": false,
  "your_new_feature": true
}
```

2. **For extension features**, update the composable to add convenience accessors:

```typescript
// In useFeatureFlags.ts
const extension = {
  manager: {
    supportsV4: computed(() =>
      getServerFeature('extension.manager.supports_v4', false)
    )
  },
  yourExtension: {
    supportsNewFeature: computed(() =>
      getServerFeature('extension.yourExtension.supports_new_feature', false)
    )
  }
}

return {
  // ... existing returns
  extension
}
```

## Testing Feature Flags

```mermaid
graph LR
    A[Test Scenarios] --> B[Both support feature]
    A --> C[Only frontend supports]
    A --> D[Only backend supports]
    A --> E[Neither supports]

    B --> F[Feature enabled]
    C --> G[Feature disabled]
    D --> H[Feature disabled]
    E --> I[Feature disabled]
```

Test your feature flags with different combinations:

- Frontend with flag + Backend with flag = Feature works
- Frontend with flag + Backend without = Graceful degradation
- Frontend without + Backend with flag = No feature usage
- Neither has flag = Default behavior

### Example Test

```typescript
// Example from a colocated unit test
it('should handle preview metadata based on feature flag', () => {
  // Mock server supports feature
  api.serverFeatureFlags = { supports_preview_metadata: true }

  expect(api.serverSupportsFeature('supports_preview_metadata')).toBe(true)

  // Mock server doesn't support feature
  api.serverFeatureFlags = {}

  expect(api.serverSupportsFeature('supports_preview_metadata')).toBe(false)
})
```
