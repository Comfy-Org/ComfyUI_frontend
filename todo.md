# Bug Description

When using a primitive node to select a model, this causes an issue specifically on Comfy Cloud. The issue does not appear to occur in the local version.

## Context

This bug was reported in the #frontend-bug-dump channel with reference links to Slack thread discussions:

- https://comfy-organization.slack.com/archives/C07RCREPL67/p1767751867519549?thread_ts=1767751129.592359&cid=C07RCREPL67
- https://comfy-organization.slack.com/archives/C07RCREPL67/p1767752100115359?thread_ts=1767751129.592359&cid=C07RCREPL67

## Reproduction

The issue is triggered when a model is selected by a primitive node in workflows running on the cloud.

## Expected Behavior

Model selection via primitive nodes should work consistently between local and cloud environments.

## Actual Behavior

An issue occurs on cloud when using primitive nodes for model selection.

## Additional Information

### Related Bug Ticket

Another bug ticket was created here: https://comfy-organization.slack.com/archives/C09FY39CC3V/p1767753991406309?thread_ts=1767734275.051999&cid=C09FY39CC3V

### Updated Reproduction Details

**Important:** This workflow didn't include any primitive nodes, but still caused the same issue. This indicates the problem is not limited to primitive nodes as originally thought.

**Affected Workflow File:** video*ltx2*t2v_distilled.json (provided in Slack thread)
