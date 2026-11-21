from __future__ import annotations

from comfy_api.latest import io  # pyright: ignore[reportMissingImports]


class DynamicComboStringOutput(io.ComfyNode):
    @classmethod
    def define_schema(cls):
        sampling_options = [
            io.DynamicCombo.Option(
                key="on",
                inputs=[
                    io.Float.Input("temperature", default=0.7, min=0.01, max=2.0),
                    io.Int.Input("top_k", default=64, min=0, max=1000),
                ],
            ),
            io.DynamicCombo.Option(key="off", inputs=[]),
        ]

        return io.Schema(
            node_id="DynamicComboStringOutput",
            category="DevTools",
            inputs=[
                io.String.Input("prompt", multiline=True, default="test input"),
                io.DynamicCombo.Input("sampling_mode", options=sampling_options),
            ],
            outputs=[io.String.Output(display_name="output_text")],
        )

    @classmethod
    def execute(cls, prompt, sampling_mode) -> io.NodeOutput:
        mode = sampling_mode.get("sampling_mode", "unknown")
        return io.NodeOutput(f"DynamicCombo output ({mode}): {prompt}")


NODE_CLASS_MAPPINGS = {
    "DynamicComboStringOutput": DynamicComboStringOutput,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "DynamicComboStringOutput": "Dynamic Combo String Output",
}

__all__ = [
    "DynamicComboStringOutput",
    "NODE_CLASS_MAPPINGS",
    "NODE_DISPLAY_NAME_MAPPINGS",
]
