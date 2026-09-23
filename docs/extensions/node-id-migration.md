# Node ID Migration Notes

ComfyUI frontend now normalizes local node IDs to the branded `NodeId` string
type at internal boundaries. Serialized workflows and API payloads may still
contain numeric IDs, but litegraph node and link fields should be treated as
strings after they enter the frontend.

Extension authors should avoid numeric comparisons against node IDs. In
particular, subgraph boundary sentinels are exposed as branded string IDs:

- `SUBGRAPH_INPUT_ID` serializes from `-10`
- `SUBGRAPH_OUTPUT_ID` serializes from `-20`

Use the exported constants where available, or normalize both sides to strings
before comparing legacy values.
