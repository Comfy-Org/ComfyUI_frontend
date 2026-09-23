from __future__ import annotations

import time

from comfy_api.v0_0_2 import IO
from nodes import LoadImage


class LongComboDropdown:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"option": ([f"Option {i}" for i in range(1_000)],)}}

    RETURN_TYPES = ()
    OUTPUT_NODE = True
    FUNCTION = "long_combo_dropdown"
    CATEGORY = "DevTools"
    DESCRIPTION = "A long combo dropdown"

    def long_combo_dropdown(self, option: str):
        print(option)


class NodeWithOptionalInput:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {"required_input": ("IMAGE",)},
            "optional": {"optional_input": ("IMAGE", {"default": None})},
        }

    RETURN_TYPES = ("IMAGE",)
    FUNCTION = "node_with_optional_input"
    CATEGORY = "DevTools"
    DESCRIPTION = "A node with an optional input"

    def node_with_optional_input(self, required_input, optional_input=None):
        print(
            f"Calling node with required_input: {required_input} and optional_input: {optional_input}"
        )
        return (required_input,)


class NodeWithOptionalComboInput:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "optional": {
                "optional_combo_input": (
                    [f"Random Unique Option {time.time()}" for _ in range(8)],
                    {"default": None},
                )
            },
        }

    RETURN_TYPES = ("STRING",)
    FUNCTION = "node_with_optional_combo_input"
    CATEGORY = "DevTools"
    DESCRIPTION = "A node with an optional combo input that returns unique values every time INPUT_TYPES is called"

    def node_with_optional_combo_input(self, optional_combo_input=None):
        print(f"Calling node with optional_combo_input: {optional_combo_input}")
        return (optional_combo_input,)


class NodeWithOnlyOptionalInput:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "optional": {
                "text": ("STRING", {"multiline": True, "dynamicPrompts": True}),
                "clip": ("CLIP", {}),
            }
        }

    RETURN_TYPES = ()
    FUNCTION = "node_with_only_optional_input"
    CATEGORY = "DevTools"
    DESCRIPTION = "A node with only optional input"

    def node_with_only_optional_input(self, clip=None, text=None):
        pass


class NodeWithOutputList:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {}}

    RETURN_TYPES = (
        "INT",
        "INT",
    )
    RETURN_NAMES = (
        "INTEGER OUTPUT",
        "INTEGER LIST OUTPUT",
    )
    OUTPUT_IS_LIST = (
        False,
        True,
    )
    FUNCTION = "node_with_output_list"
    CATEGORY = "DevTools"
    DESCRIPTION = "A node with an output list"

    def node_with_output_list(self):
        return (1, [1, 2, 3])


class NodeWithForceInput:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "int_input": ("INT", {"forceInput": True}),
                "int_input_widget": ("INT", {"default": 1}),
            },
            "optional": {"float_input": ("FLOAT", {"forceInput": True})},
        }

    RETURN_TYPES = ()
    OUTPUT_NODE = True
    FUNCTION = "node_with_force_input"
    CATEGORY = "DevTools"
    DESCRIPTION = "A node with a forced input"

    def node_with_force_input(
        self, int_input: int, int_input_widget: int, float_input: float = 0.0
    ):
        print(
            f"int_input: {int_input}, int_input_widget: {int_input_widget}, float_input: {float_input}"
        )


class NodeWithDefaultInput:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "int_input": ("INT", {"defaultInput": True}),
                "int_input_widget": ("INT", {"default": 1}),
            },
            "optional": {"float_input": ("FLOAT", {"defaultInput": True})},
        }

    RETURN_TYPES = ()
    OUTPUT_NODE = True
    FUNCTION = "node_with_default_input"
    CATEGORY = "DevTools"
    DESCRIPTION = "A node with a default input"

    def node_with_default_input(
        self, int_input: int, int_input_widget: int, float_input: float = 0.0
    ):
        print(
            f"int_input: {int_input}, int_input_widget: {int_input_widget}, float_input: {float_input}"
        )


class NodeWithStringInput:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"string_input": ("STRING",)}}

    RETURN_TYPES = ()
    FUNCTION = "node_with_string_input"
    CATEGORY = "DevTools"
    DESCRIPTION = "A node with a string input"

    def node_with_string_input(self, string_input: str):
        print(f"string_input: {string_input}")


class NodeWithUnionInput:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "optional": {
                "string_or_int_input": ("STRING,INT",),
                "string_input": ("STRING", {"forceInput": True}),
                "int_input": ("INT", {"forceInput": True}),
            }
        }

    RETURN_TYPES = ()
    OUTPUT_NODE = True
    FUNCTION = "node_with_union_input"
    CATEGORY = "DevTools"
    DESCRIPTION = "A node with a union input"

    def node_with_union_input(
        self,
        string_or_int_input: str | int = "",
        string_input: str = "",
        int_input: int = 0,
    ):
        print(
            f"string_or_int_input: {string_or_int_input}, string_input: {string_input}, int_input: {int_input}"
        )
        return {
            "ui": {
                "text": string_or_int_input,
            }
        }


class NodeWithBooleanInput:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"boolean_input": ("BOOLEAN",)}}

    RETURN_TYPES = ()
    FUNCTION = "node_with_boolean_input"
    CATEGORY = "DevTools"
    DESCRIPTION = "A node with a boolean input"

    def node_with_boolean_input(self, boolean_input: bool):
        print(f"boolean_input: {boolean_input}")


class NodeWithColorInput:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"color_input": ("COLOR", {"default": "#00ff00"})}}

    RETURN_TYPES = ()
    FUNCTION = "node_with_color_input"
    CATEGORY = "DevTools"
    DESCRIPTION = "A node with a color input that declares a non-black default"

    def node_with_color_input(self, color_input: str):
        print(f"color_input: {color_input}")


class SimpleSlider:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "value": (
                    "FLOAT",
                    {
                        "display": "slider",
                        "default": 0.5,
                        "min": 0.0,
                        "max": 1.0,
                        "step": 0.001,
                    },
                ),
            },
        }

    RETURN_TYPES = ("FLOAT",)
    FUNCTION = "execute"
    CATEGORY = "DevTools"

    def execute(self, value):
        return (value,)


class NodeWithSeedInput:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"seed": ("INT", {"default": 0})}}

    RETURN_TYPES = ()
    FUNCTION = "node_with_seed_input"
    CATEGORY = "DevTools"
    DESCRIPTION = "A node with a seed input"
    OUTPUT_NODE = True

    def node_with_seed_input(self, seed: int):
        print(f"seed: {seed}")


class NodeWithValidation:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {"int_input": ("INT",)},
        }

    @classmethod
    def VALIDATE_INPUTS(cls, int_input: int):
        if int_input < 0:
            raise ValueError("int_input must be greater than 0")
        return True

    RETURN_TYPES = ()
    FUNCTION = "execute"
    CATEGORY = "DevTools"
    DESCRIPTION = "A node that validates an input"
    OUTPUT_NODE = True

    def execute(self, int_input: int):
        print(f"int_input: {int_input}")
        return tuple()


class NodeWithV2ComboInput:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "combo_input": (
                    "COMBO",
                    {"options": ["A", "B"]},
                ),
            }
        }

    RETURN_TYPES = ("COMBO",)
    FUNCTION = "node_with_v2_combo_input"
    CATEGORY = "DevTools"
    DESCRIPTION = (
        "A node that outputs a combo type that adheres to the v2 combo input spec"
    )

    def node_with_v2_combo_input(self, combo_input: str):
        return (combo_input,)

class NodeWithLegacyWidget:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": { "legacy_widget": ("INT", { "widgetType":  "DEVTOOLSLEGACYWIDGET" }) }
        }

    RETURN_TYPES = ()
    FUNCTION = "node_with_legacy_widget"
    CATEGORY = "DevTools"
    DESCRIPTION = ("A node with a legacy widget")

    def node_with_legacy_widget(self):
        return ()

class NodeWithPreAttachLegacyWidgets:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {}}

    RETURN_TYPES = ()
    FUNCTION = "node_with_pre_attach_legacy_widgets"
    CATEGORY = "DevTools"
    DESCRIPTION = ("A node whose widgets are foreign legacy objects created before graph attachment")

    def node_with_pre_attach_legacy_widgets(self):
        return ()


class NodeWithComparerWidget:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {}}

    RETURN_TYPES = ()
    FUNCTION = "node_with_comparer_widget"
    CATEGORY = "DevTools"
    DESCRIPTION = "A node whose web extension mirrors rgthree's image comparer"

    def node_with_comparer_widget(self):
        return ()


class NodeWithHiddenAriaDialog:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {}}

    RETURN_TYPES = ()
    FUNCTION = "node_with_hidden_aria_dialog"
    CATEGORY = "DevTools"
    DESCRIPTION = "A node whose web extension keeps a hidden ARIA dialog mounted"

    def node_with_hidden_aria_dialog(self):
        return ()


class WASPause:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {}}

    RETURN_TYPES = ()
    FUNCTION = "pause"
    CATEGORY = "DevTools"
    DESCRIPTION = "Reproduces WAS Pause's live button disabled getter"

    def pause(self):
        return ()


class RefModLoader:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {
            "show_info": ("BOOLEAN", {"default": True}),
            **{f"mod_{i}": (["(none)", "voice.refmod"],) for i in range(1, 9)},
            **{f"strength_{i}": ("FLOAT", {"default": 1.0}) for i in range(1, 9)},
        }}

    RETURN_TYPES = ()
    FUNCTION = "load"
    CATEGORY = "DevTools"
    DESCRIPTION = "Reproduces MiniMax RefMod's schema-order serialization wrappers"

    def load(self, **kwargs):
        return ()


class PreviewBridge:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {
            "source_image": LoadImage.INPUT_TYPES()["required"]["image"],
            "image": ("STRING", {"default": "$preview-before-mask"}),
        }}

    RETURN_TYPES = ()
    FUNCTION = "preview"
    CATEGORY = "DevTools"
    DESCRIPTION = "Reproduces Impact Preview Bridge's asynchronous image registration setter"

    def preview(self, source_image, image):
        return ()


class NodeWithPriceBadge(IO.ComfyNode):
    @classmethod
    def define_schema(cls):
        return IO.Schema(
            node_id="DevToolsNodeWithPriceBadge",
            display_name="Node With Price Badge",
            description="An API node with a price badge",
            inputs=[IO.Combo.Input("price", options=["1x", "2x", "3x"])],
            is_api_node=True,
            price_badge=IO.PriceBadge(
                depends_on=IO.PriceBadgeDepends(widgets=["price"]),
                expr="""
                (
                  $p := widgets.price;
                  {"type":"usd","usd": $contains($p, "2x") ? 2 : $contains($p, "3x") ? 3 : 1}
                )
                """,
            ),
        )

    @classmethod
    async def execute(cls, price):
        return IO.NodeOutput()


class NodeWithNumericCombo(IO.ComfyNode):
    @classmethod
    def define_schema(cls):
        return IO.Schema(
            node_id="DevToolsNodeWithNumericCombo",
            display_name="Node With Numeric Combo",
            description="An API node whose combo options are numbers",
            inputs=[IO.Combo.Input("duration", options=[5, 10], default=5)],
            is_api_node=True,
            price_badge=IO.PriceBadge(
                depends_on=IO.PriceBadgeDepends(widgets=["duration"]),
                expr='{"type":"usd","usd": widgets.duration / 5}',
            ),
        )

    @classmethod
    async def execute(cls, duration):
        return IO.NodeOutput()


class NodeWithDynamicCombo(IO.ComfyNode):
    @classmethod
    def define_schema(cls):
        return IO.Schema(
            node_id="DevToolsNodeWithDynamicCombo",
            display_name="Node With Dynamic Combo",
            description="A node with a Dynamic combo",
            inputs=[IO.DynamicCombo.Input("combo", options=[
                IO.DynamicCombo.Option("option1", [IO.Combo.Input("suboption", options=["1x"])]),
                IO.DynamicCombo.Option("option2", [IO.Combo.Input("suboption", options=["2x"])]),
                IO.DynamicCombo.Option("option3", [IO.Image.Input("image")]),
                IO.DynamicCombo.Option("option4", [
                    IO.DynamicCombo.Input("subcombo", options=[
                        IO.DynamicCombo.Option("opt1", [IO.Float.Input("float_x"), IO.Float.Input("float_y")]),
                        IO.DynamicCombo.Option("opt2", [IO.Mask.Input("mask1", optional=True)]),
                    ])
                ])]
            )],
        )

    @classmethod
    async def execute(cls):
        return IO.NodeOutput()


def _dynamic_combo_autogrow_model_inputs():
    return [
        IO.Combo.Input("size", default="auto", options=["auto", "1024x1024", "1536x1024"]),
        IO.Combo.Input("quality", default="low", options=["low", "medium", "high"]),
        IO.Autogrow.Input(
            "images",
            template=IO.Autogrow.TemplateNames(
                IO.Image.Input("image"),
                names=[f"image_{i}" for i in range(1, 17)],
                min=0,
            ),
        ),
        IO.Mask.Input("mask", optional=True),
    ]


class AutogrowImagesInDynamicCombo(IO.ComfyNode):
    """Minimal node carrying `OpenAIGPTImageNodeV2`'s autogrow-in-dynamic-combo shape.

    An autogrow image group nested inside a dynamic combo option is the shape
    that loses its links on workflow load, so a test for that needs a node
    built this way. It reproduces that shape only and does not track the real
    node's schema, so the test needs no partner-node availability or pricing.
    """

    @classmethod
    def define_schema(cls):
        return IO.Schema(
            node_id="DevToolsAutogrowImagesInDynamicCombo",
            display_name="Autogrow Images In Dynamic Combo",
            description="A node whose dynamic combo options each carry an autogrow image group",
            inputs=[
                IO.String.Input("prompt", default="", multiline=True),
                IO.DynamicCombo.Input(
                    "model",
                    options=[
                        IO.DynamicCombo.Option("model-flare", _dynamic_combo_autogrow_model_inputs()),
                        IO.DynamicCombo.Option("model-sunburst", _dynamic_combo_autogrow_model_inputs()),
                    ],
                ),
                IO.Int.Input("n", default=1, min=1, max=8),
            ],
            outputs=[IO.Image.Output()],
        )

    @classmethod
    async def execute(cls, **kwargs):
        return IO.NodeOutput()


NODE_CLASS_MAPPINGS = {
    "DevToolsLongComboDropdown": LongComboDropdown,
    "DevToolsNodeWithOptionalInput": NodeWithOptionalInput,
    "DevToolsNodeWithOptionalComboInput": NodeWithOptionalComboInput,
    "DevToolsNodeWithOnlyOptionalInput": NodeWithOnlyOptionalInput,
    "DevToolsNodeWithOutputList": NodeWithOutputList,
    "DevToolsNodeWithForceInput": NodeWithForceInput,
    "DevToolsNodeWithDefaultInput": NodeWithDefaultInput,
    "DevToolsNodeWithStringInput": NodeWithStringInput,
    "DevToolsNodeWithUnionInput": NodeWithUnionInput,
    "DevToolsNodeWithBooleanInput": NodeWithBooleanInput,
    "DevToolsNodeWithColorInput": NodeWithColorInput,
    "DevToolsSimpleSlider": SimpleSlider,
    "DevToolsNodeWithSeedInput": NodeWithSeedInput,
    "DevToolsNodeWithValidation": NodeWithValidation,
    "DevToolsNodeWithV2ComboInput": NodeWithV2ComboInput,
    "DevToolsNodeWithLegacyWidget": NodeWithLegacyWidget,
    "DevToolsNodeWithPreAttachLegacyWidgets": NodeWithPreAttachLegacyWidgets,
    "DevToolsNodeWithComparerWidget": NodeWithComparerWidget,
    "DevToolsNodeWithHiddenAriaDialog": NodeWithHiddenAriaDialog,
    "DevToolsWASPause": WASPause,
    "DevToolsRefModLoader": RefModLoader,
    "DevToolsPreviewBridge": PreviewBridge,
    "DevToolsNodeWithPriceBadge": NodeWithPriceBadge,
    "DevToolsNodeWithNumericCombo": NodeWithNumericCombo,
    "DevToolsNodeWithDynamicCombo": NodeWithDynamicCombo,
    "DevToolsAutogrowImagesInDynamicCombo": AutogrowImagesInDynamicCombo,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "DevToolsLongComboDropdown": "Long Combo Dropdown",
    "DevToolsNodeWithOptionalInput": "Node With Optional Input",
    "DevToolsNodeWithOptionalComboInput": "Node With Optional Combo Input",
    "DevToolsNodeWithOnlyOptionalInput": "Node With Only Optional Input",
    "DevToolsNodeWithOutputList": "Node With Output List",
    "DevToolsNodeWithForceInput": "Node With Force Input",
    "DevToolsNodeWithDefaultInput": "Node With Default Input",
    "DevToolsNodeWithStringInput": "Node With String Input",
    "DevToolsNodeWithUnionInput": "Node With Union Input",
    "DevToolsNodeWithBooleanInput": "Node With Boolean Input",
    "DevToolsNodeWithColorInput": "Node With Color Input",
    "DevToolsSimpleSlider": "Simple Slider",
    "DevToolsNodeWithSeedInput": "Node With Seed Input",
    "DevToolsNodeWithValidation": "Node With Validation",
    "DevToolsNodeWithV2ComboInput": "Node With V2 Combo Input",
    "DevToolsNodeWithLegacyWidget": "Node With Legacy Widget",
    "DevToolsNodeWithPreAttachLegacyWidgets": "Node With Pre-Attach Legacy Widgets",
    "DevToolsNodeWithComparerWidget": "Node With Comparer Widget",
    "DevToolsNodeWithHiddenAriaDialog": "Node With Hidden ARIA Dialog",
    "DevToolsWASPause": "WAS Pause Compatibility",
    "DevToolsRefModLoader": "RefMod Loader Compatibility",
    "DevToolsPreviewBridge": "Preview Bridge Compatibility",
    "DevToolsNodeWithPriceBadge": "Node With Price Badge",
    "DevToolsNodeWithNumericCombo": "Node With Numeric Combo",
    "DevToolsNodeWithDynamicCombo": "Node With Dynamic Combo",
    "DevToolsAutogrowImagesInDynamicCombo": "Autogrow Images In Dynamic Combo",
}

__all__ = [
    "LongComboDropdown",
    "NodeWithOptionalInput",
    "NodeWithOptionalComboInput",
    "NodeWithOnlyOptionalInput",
    "NodeWithOutputList",
    "NodeWithForceInput",
    "NodeWithDefaultInput",
    "NodeWithStringInput",
    "NodeWithUnionInput",
    "NodeWithBooleanInput",
    "NodeWithColorInput",
    "SimpleSlider",
    "NodeWithSeedInput",
    "NodeWithValidation",
    "NodeWithV2ComboInput",
    "NodeWithNumericCombo",
    "NODE_CLASS_MAPPINGS",
    "NODE_DISPLAY_NAME_MAPPINGS",
]
