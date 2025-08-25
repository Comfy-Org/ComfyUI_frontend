# Backend Manager Feature Flag Implementation

## Overview
The frontend sends a client feature flag `supports_manager_v4_ui` to indicate whether it supports the new manager UI. The backend needs to check this flag when deciding which manager package to import.

## Required Backend Changes

### 1. Check Client Feature Flags
When the backend receives the WebSocket connection with client feature flags, it should check for:
```json
{
  "supports_manager_v4_ui": true  // Frontend supports v4 manager UI
}
```

### 2. Manager Loading Logic
The backend should follow this logic when loading the manager:

```python
# Pseudocode for manager loading decision
if "--disable-manager" in cmdline_args:
    # Don't load any manager
    pass
elif "--enable-manager-legacy-ui" in cmdline_args:
    # User explicitly wants legacy, always load legacy
    import_legacy_manager()
elif client_supports_v4_ui:  # Check the client feature flag
    # Client supports v4, load new manager
    import_glob_manager()
    set_feature_flag("extension.manager.supports_v4", True)
else:
    # Old client, must use legacy manager even if v4 is available
    import_legacy_manager()
    set_feature_flag("extension.manager.supports_v4", False)
```

### 3. Feature Flags to Send
The backend should send these feature flags to the frontend:
- `extension.manager.supports_v4`: Whether v4 manager is loaded and available

### 4. API Route Behavior
The `/manager/is_legacy_manager_ui` route should return:
- `{ "is_legacy_manager_ui": true }` when legacy UI is active
- `{ "is_legacy_manager_ui": false }` when v4 UI is active  
- `null` or 404 when manager is disabled

## Summary
This ensures that old frontends (without `supports_manager_v4_ui` flag) will always get the legacy manager they expect, preventing the broken state in row 6 of the compatibility table.