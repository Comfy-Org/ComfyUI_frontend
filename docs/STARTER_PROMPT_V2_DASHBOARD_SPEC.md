# Starter Prompt Personalization V2 Dashboard Specification

**Event**: `app:agent_starter_prompt_personalization`

**Status**: Draft spec; dashboard creation pending event availability in PostHog after first merged build deployment

**Purpose**: Track the rendering frequency, strategy adoption, signal availability, and treatment effectiveness for the personalized starter prompts V2 experiment.

---

## Dashboard Structure

### 1. **Rendering & Exposure Funnel**

**Title**: Starter Prompt Personalization – Session Rendering

| Insight | Query | Target |
|---------|-------|--------|
| **Sessions with panel open** | Unique count of `$session_id` | baseline |
| **Sessions with any prompt render** | Unique count of `$session_id` where `app:agent_starter_prompt_personalization` fired | baseline |
| **Render-to-selection rate** | (subsequent `app:agent_message_sent` where first event in sequence is personalization render) / (render count) | >30% |

**Metric**: Confirm that the starter prompts panel is shown to users and triggers expected downstream behavior.

---

### 2. **Strategy Distribution & Adoption**

**Title**: Starter Prompt Strategy Breakdown

| Insight | Query | Target |
|---------|-------|--------|
| **Static (control) arm** | Count of events where `strategy == 'static'` | baseline |
| **Profile-based arm** | Count of events where `strategy == 'profile'` | establish signal |
| **Canvas-based arm** | Count of events where `strategy == 'canvas'` | establish signal |
| **Combined arm** | Count of events where `strategy == 'combined'` | establish signal |

**Metric**: Confirm each strategy path is being evaluated and rendering correctly when the flag transitions from off to arm treatment exposure.

---

### 3. **Signal Availability & Failures**

**Title**: Starter Prompt Signal Coverage

| Insight | Query | Target |
|---------|-------|--------|
| **Profile available** | % of renders where `profile_source != 'unavailable'` | >60% |
| **Canvas available** | % of renders where `canvas_presence != 'none'` | >40% |
| **Both signals** | % of renders where profile available AND canvas available | >20% |
| **Neither signal** | % of renders where both unavailable (fallback to static) | <20% |

**Metric**: Ensure signal adapters are successfully reading user context and degrading gracefully when data is unavailable.

---

### 4. **Personalization Application Rate**

**Title**: Starter Prompt Personalization Effectiveness

| Insight | Query | Target |
|---------|-------|--------|
| **Personalization applied** | % of events where `personalization_applied == true` | >60% with signals |
| **Static baseline (no personalization)** | % of events where `personalization_applied == false` | <10% in treatment arms |
| **Unassigned/QA override** | Count of events where `assignment_source == 'unassigned'` or `assignment_source == 'qa_override'` | low during inactive phase |

**Metric**: Confirm that when signals are available, the selector chooses a personalized strategy; when signals are unavailable, safely fall back to static baseline.

---

### 5. **Locale & Catalog Coverage**

**Title**: Starter Prompt Localization

| Insight | Query | Target |
|---------|-------|--------|
| **Events by locale** | Count grouped by `locale` | >95% English in initial rollout |
| **Catalog version distribution** | Count grouped by `catalog_version` | confirm single version served |
| **Prompt count consistency** | Distribution of `prompt_count` across renders | expect 5-6 count for all renders |

**Metric**: Confirm consistent locale handling and catalog versioning across the population.

---

## Dashboard Access & Maintenance

- **PostHog Project**: 204330 (Agent Growth & Conversion)
- **Event Name**: `app:agent_starter_prompt_personalization`
- **Timeline**: 
  - Event fires in production once first build with merged code ships
  - First render data should appear within 24 hours of production deployment
  - Dashboard insights populate after 48+ hours of event volume
  
- **Owner**: growth-conversion operator
- **Decision Dates**:
  - First read (off-state telemetry validation): 2026-11-18 (via readonly event data)
  - Experiment decision read (with flag exposure): 2026-11-25

---

## Notes for Dashboard Wiring

1. **Before flag activation**: The event will fire with `personalization_applied: false` and `assignment_source: 'unassigned'`. Sections 1-5 can validate the inactive baseline behavior.

2. **After flag activation**: Filter by `assignment_source` to see treatment arm breakdowns when the flag is activated for rollout.

3. **Fallback behavior**: When signals are unavailable (`profile_source: 'unavailable'` or `canvas_presence: 'none'`), `strategy` should still resolve to a valid strategy (not null), confirming the fail-closed design.

4. **Deduplication**: The telemetry reporter deduplicates consecutive identical payloads to avoid inflating render counts when the panel re-renders without state changes.

---

## Testing the Event (Pre-Merge)

The event can be tested in staging/dev with QA overrides:

1. Set session override: `?starter_prompt_personalization_strategy=profile` (or `canvas`, `combined`)
2. Verify `app:agent_starter_prompt_personalization` fires in Sentry or local telemetry
3. Check that `assignment_source == 'qa_override'` (confirming the override was applied)
4. Confirm no `$feature/` property fires (inactive flag)
