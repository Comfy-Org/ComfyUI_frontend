# Thread Analysis: Per-Tab Auth Implementation

**Date**: 2026-01-13
**Participants**: Christian, Hunter, Jake

---

## Summary of Decisions

✅ **Agreed Architecture**:

1. Firebase auth stays in **localStorage** (persistent login across tabs/sessions)
2. Workspace context stored in **sessionStorage** (per-tab isolation)
3. `/view` endpoint uses cookies, scoped to USER (not workspace) - backend validates permission across all user's workspaces
4. API key fallback auth remains **localStorage** (acceptable limitation - personal workspace only)
5. **Full app refresh on workspace change** (no complex invalidation)

---

## Technical Accuracy Audit

### ✅ Correct Understandings

1. **Firebase persistence strategy** (Christian, 3:35 PM):

   > "Keep Firebase auth using localStorage (cross-tab, persistent), then secondary auth initialization stored in sessionStorage"

   **✅ CORRECT** - This is the hybrid approach that maintains "always logged in" while enabling per-tab workspace context.

2. **SessionStorage compatibility** (Christian, 3:37 PM):

   > "97% [compatibility]... sessionStorage technically has less compat than localStorage"

   **✅ CORRECT** - [97%+ global support](https://caniuse.com/mdn-api_window_sessionstorage), minor iOS private mode issue with fallback.

3. **/view endpoint scoping** (Hunter, 3:39-3:40 PM):

   > "When we're doing cookie auth for /view we can validate that the user has permission to view that item (in any workspace they are in)... technically /view isn't scoped to workspace"

   **✅ CORRECT** - Cookie authenticates USER, backend checks permission across all workspaces. No per-tab cookies needed.

4. **Workflow asset access** (Hunter, 3:48 PM):

   > "Someone could copy a workflow json from workspace A, load it from local file in workspace B, and if it referenced an image (that uses /view) to populate that image would show up"

   **✅ CORRECT** - This is expected behavior. Workflow will fail on inference when loading assets user doesn't have access to.

5. **API key fallback limitation** (Christian, 3:59 PM):

   > "This issue is acceptable"

   **✅ CORRECT** - API key users stay in personal workspace only (see per-tab-auth-analysis.md for full analysis).

6. **Full app refresh on workspace change** (Christian, 4:32 PM):

   > "I would just suggest refreshing the entire app on session change, rather than trying to introduce invalidation concept"

   **✅ CORRECT - with caveats** (see concerns below).

---

## ⚠️ Potential Issues & Gaps

### 🔴 **CRITICAL: Existing localStorage Usage**

**Hunter's Question** (4:23 PM):

> "We also need any other local storage (if any) to be stored in session storage, right?"

**Christian's Response** (4:25 PM):

> "I don't believe so"

**⚠️ INCOMPLETE ANSWER** - There IS localStorage usage that needs consideration:

#### Current localStorage Usage (found in codebase):

1. **Workflow-scoped data** (src/stores/workspace/favoritedWidgetsStore.ts:107):

   ```typescript
   localStorage.getItem(`Comfy.Workflow.${workflowId}.FavoritedWidgets`)
   ```

   - ✅ Safe - keyed by workflow ID, not workspace
   - But: Same workflow in different workspaces could have shared state

2. **Client-scoped data with hybrid storage** (src/scripts/utils.ts:96-110):

   ```typescript
   getStorageValue(id) {
     return sessionStorage.getItem(`${id}:${clientId}`) ?? localStorage.getItem(id)
   }
   ```

   - ✅ Already implements per-tab pattern!
   - sessionStorage prefixed with clientId, localStorage fallback

3. **Global app state** (various locations):
   - Menu position: `localStorage.getItem('Comfy.MenuPosition')`
   - Clipboard: `localStorage.getItem('litegrapheditor_clipboard')`
   - New user checks: `localStorage.getItem('workflow')`
   - Conflict acknowledgments: `localStorage.getItem('Comfy.ConflictModalDismissed')`
   - Telemetry: `localStorage.getItem('Comfy.Topup.Timestamp')`

   **Analysis**: These are **user-level preferences** (not workspace-specific), so localStorage is correct.

#### What DOES Need Workspace Scoping?

**Workspace-specific state that currently uses localStorage:**

❌ **None found** - Most app state is in Pinia stores (in-memory), not persisted storage.

**But consider future cases:**

- Workspace-specific UI settings?
- Workspace-specific node favorites?
- Workspace-specific recent items?

---

### 🟡 **MEDIUM: Full App Refresh Strategy**

**Christian's Proposal** (4:32 PM):

> "Just suggest refreshing the entire app on session change"

**Concerns:**

1. **Loss of unsaved work**:

   ```
   User in Workspace A → Editing workflow (unsaved changes)
   User switches to Workspace B → Full page reload
   Result: Loses all unsaved changes in Workspace A
   ```

2. **User Experience**:
   - Jarring full page reload
   - Loss of ephemeral UI state (scroll position, open panels, etc.)
   - Breaks browser back/forward navigation

3. **WebSocket reconnection**:
   - Full reload → WebSocket disconnect/reconnect
   - Could interrupt in-progress queue jobs

**Alternative Approaches:**

#### Option A: Save-Before-Switch (Recommended)

```typescript
const switchWorkspace = async (workspaceId: string) => {
  // Check for unsaved changes
  if (workflowStore.hasUnsavedChanges()) {
    const shouldSave = await showConfirmDialog({
      title: 'Save Changes?',
      message: 'You have unsaved changes. Save before switching workspaces?',
      options: ['Save & Switch', 'Discard & Switch', 'Cancel']
    })

    if (shouldSave === 'Save & Switch') {
      await workflowStore.save()
    } else if (shouldSave === 'Cancel') {
      return
    }
  }

  // Full reload with workspace context
  window.location.href = `/?workspace=${workspaceId}`
}
```

#### Option B: Selective Store Reset (Complex)

```typescript
const switchWorkspace = async (workspaceId: string) => {
  // Reset workspace-scoped stores
  await workspaceAuth.switchWorkspace(workspaceId)

  // Reset affected stores
  workflowStore.$reset()
  queueStore.$reset()
  nodeLibraryStore.refresh()

  // Reconnect WebSocket with new workspace token
  await api.reconnect()
}
```

**Recommendation**: Start with **Option A** (full reload with save prompt), iterate to Option B if needed.

---

### 🟡 **MEDIUM: SessionStorage Quota Management**

**Christian's Concern** (3:37 PM):

> "Some browsers have storage quotas and we have not been diligent in ensuring we don't exceed them"

**Current Risk Assessment**:

**What gets stored in sessionStorage?**

1. Workspace ID: `~50 bytes`
2. Workspace token (JWT): `~500-1000 bytes`
3. ClientId: `~50 bytes`
4. Preserved query params: `~200 bytes`
5. **Future**: Per-tab state: `~?? bytes`

**Total estimated**: <2 KB per tab

**Safari Mobile limit**: 2.5-5 MB = Room for 1,250+ tabs

**Verdict**: ✅ Not a concern for workspace auth specifically, but **should add monitoring**.

**Recommendation**:

```typescript
// Add error handling for quota exceeded
function saveToSessionStorage(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value)
  } catch (error) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      // Fallback to in-memory storage
      console.warn('SessionStorage quota exceeded, using in-memory fallback')
      inMemoryStore.set(key, value)

      // Optional: Clear old session data
      cleanupOldSessionData()
    } else {
      throw error
    }
  }
}
```

---

### 🟢 **LOW: Session Change Frequency**

**Christian's Concern** (4:32 PM):

> "It involves some risk e.g. if the session changes frequently"

**Analysis**:

**When does workspace context change?**

1. User explicitly switches workspace (rare - maybe 1-5 times per session)
2. User opens new tab with different workspace (common in power user scenarios)
3. Token expiration → refresh (every 1 hour for ID token, but transparent)

**Workspace switching is NOT frequent** - Users typically:

- Work in one workspace for extended period (hours)
- Switch contexts deliberately (not accidental)

**Full reload on switch is acceptable** given low frequency.

---

## Missing Considerations

### 1. **Multi-Tab Workflow Sharing**

**Scenario**:

```
Tab A (Workspace A) → Editing "workflow_123"
Tab B (Workspace B) → Tries to open "workflow_123"
```

**Questions**:

- Are workflow IDs globally unique or workspace-scoped?
- Can same workflow exist in multiple workspaces?
- If user saves workflow in Tab A, does Tab B see update?

**Recommendation**: Clarify workflow scoping with backend team.

---

### 2. **Token Refresh During Active Work**

**Scenario**:

```
User in Workspace A → Token expires (1 hour)
Background refresh: POST /api/auth/token (exchange Firebase token for new workspace token)
User continues working → All API calls use new token transparently
```

**Questions**:

- How to handle refresh failure? (e.g., user loses workspace access)
- Should refresh happen proactively (before expiration) or reactively (on 401)?

**Recommendation**:

```typescript
// Proactive refresh (5 min before expiration)
const TOKEN_REFRESH_BUFFER = 5 * 60 * 1000 // 5 minutes

watchEffect(() => {
  if (!workspaceToken.value) return

  const decoded = jwtDecode(workspaceToken.value)
  const expiresAt = decoded.exp * 1000
  const refreshAt = expiresAt - TOKEN_REFRESH_BUFFER
  const delay = refreshAt - Date.now()

  if (delay > 0) {
    setTimeout(async () => {
      try {
        await refreshWorkspaceToken()
      } catch (error) {
        // Token refresh failed - workspace access revoked?
        handleTokenRefreshError(error)
      }
    }, delay)
  }
})
```

---

### 3. **WebSocket Connection Management**

**Current Implementation** (src/scripts/api.ts):

- WebSocket connection established with `clientId`
- `clientId` stored in sessionStorage per tab

**Questions**:

- Does WebSocket need workspace context in headers/auth?
- What happens when workspace switches - reconnect with new token?
- How to handle in-progress queue jobs during workspace switch?

**Recommendation**: Verify WebSocket auth strategy with Hunter.

---

### 4. **Browser Back/Forward Navigation**

**Scenario**:

```
User in Workspace A → Switches to Workspace B (full reload)
User clicks browser back button → ???
```

**Current behavior with full reload**:

- Back button goes to previous URL
- But workspace context is in sessionStorage, not URL

**Recommendation**: Encode workspace in URL query param:

```
https://app.comfy.org/?workspace=ws_abc123
```

Then on page load:

```typescript
const urlWorkspace = new URLSearchParams(location.search).get('workspace')
const sessionWorkspace = sessionStorage.getItem('Comfy.Workspace.Current')

if (urlWorkspace && urlWorkspace !== sessionWorkspace) {
  // URL takes precedence - switch to URL workspace
  await switchWorkspace(urlWorkspace)
}
```

---

## Recommendations Summary

### 🔴 Critical (Must Address)

1. **Document localStorage usage policy**:
   - User-level preferences → localStorage (shared across workspaces)
   - Workspace-specific state → sessionStorage or scoped localStorage keys
   - Ephemeral state → in-memory Pinia stores

2. **Implement save-before-switch for workspace changes**:
   - Prevent loss of unsaved work
   - Clear user confirmation flow

3. **Add sessionStorage quota error handling**:
   - Fallback to in-memory storage
   - Graceful degradation for iOS private mode

### 🟡 Important (Should Address)

1. **Clarify workflow scoping** with backend team:
   - Are workflows workspace-scoped or globally unique?
   - Can same workflow exist in multiple workspaces?

2. **Implement proactive token refresh**:
   - Refresh 5 min before expiration
   - Handle refresh failures gracefully

3. **Verify WebSocket auth strategy**:
   - Does WebSocket need workspace token?
   - How to handle reconnection on workspace switch?

### 🟢 Nice to Have

1. **Encode workspace in URL** for better browser navigation:
   - `/?workspace=ws_abc123`
   - Enables back/forward button support

2. **Add telemetry for workspace switching**:
   - Track frequency of workspace changes
   - Monitor for UX issues with full reload approach

---

## Validation Checklist

Before implementing, verify these assumptions with Hunter:

- [ ] `/view` endpoint: Confirmed user-scoped (not workspace-scoped)?
- [ ] Workflows: Workspace-scoped or globally unique IDs?
- [ ] Token refresh: `POST /api/auth/token` supports refresh flow?
- [ ] WebSocket: Needs workspace token or user token?
- [ ] API key users: Confirmed personal workspace only?
- [ ] Workspace access revocation: How to handle mid-session?
- [ ] In-progress queue jobs: Behavior on workspace switch?

---

## Conclusion

**Overall Assessment**: ✅ **Plan is technically sound with identified gaps**

**Key Strengths**:

- Hybrid storage approach (Firebase in localStorage, workspace in sessionStorage) solves "always logged in" concern
- `/view` endpoint design correctly scopes to user (not workspace)
- Full reload on workspace switch is pragmatic given low frequency
- API key limitation is acceptable for automation use case

**Key Risks**:

1. 🔴 Loss of unsaved work on workspace switch (needs save prompt)
2. 🟡 Unclear workflow scoping (needs backend clarification)
3. 🟡 Token refresh failure handling (needs proactive strategy)

**Recommendation**: Proceed with implementation, but add save-before-switch protection and clarify workflow scoping before shipping.
