import torch
import comfy.utils as utils
from comfy.model_patcher import ModelPatcher
import nodes
import time
import os
import folder_paths


class ErrorRaiseNode:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {}}

    RETURN_TYPES = ("IMAGE",)
    FUNCTION = "raise_error"
    CATEGORY = "DevTools"
    DESCRIPTION = "Raise an error for development purposes"

    def raise_error(self):
        raise Exception("Error node was called!")


class ErrorRaiseNodeWithMessage:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"message": ("STRING", {"multiline": True})}}

    RETURN_TYPES = ()
    OUTPUT_NODE = True

    FUNCTION = "raise_error"
    CATEGORY = "DevTools"
    DESCRIPTION = "Raise an error with message for development purposes"

    def raise_error(self, message: str):
        raise Exception(message)


class ExperimentalNode:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {}}

    RETURN_TYPES = ()
    OUTPUT_NODE = True
    FUNCTION = "experimental_function"
    CATEGORY = "DevTools"
    DESCRIPTION = "A experimental node"

    EXPERIMENTAL = True

    def experimental_function(self):
        print("Experimental node was called!")


class DeprecatedNode:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {}}

    RETURN_TYPES = ()
    OUTPUT_NODE = True
    FUNCTION = "deprecated_function"
    CATEGORY = "DevTools"
    DESCRIPTION = "A deprecated node"

    DEPRECATED = True

    def deprecated_function(self):
        print("Deprecated node was called!")


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


class DummyPatch(torch.nn.Module):
    def __init__(self, module: torch.nn.Module, dummy_float: float = 0.0):
        super().__init__()
        self.module = module
        self.dummy_float = dummy_float

    def forward(self, *args, **kwargs):
        if isinstance(self.module, DummyPatch):
            raise Exception(f"Calling nested dummy patch! {self.dummy_float}")

        return self.module(*args, **kwargs)


class ObjectPatchNode:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "model": ("MODEL",),
                "target_module": ("STRING", {"multiline": True}),
            },
            "optional": {
                "dummy_float": ("FLOAT", {"default": 0.0}),
            },
        }

    RETURN_TYPES = ("MODEL",)
    FUNCTION = "apply_patch"
    CATEGORY = "DevTools"
    DESCRIPTION = "A node that applies an object patch"

    def apply_patch(
        self, model: ModelPatcher, target_module: str, dummy_float: float = 0.0
    ) -> ModelPatcher:
        module = utils.get_attr(model.model, target_module)
        work_model = model.clone()
        work_model.add_object_patch(target_module, DummyPatch(module, dummy_float))
        return (work_model,)


class RemoteWidgetNode:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "remote_widget_value": (
                    "COMBO",
                    {
                        "remote": {
                            "route": "/api/models/checkpoints",
                        },
                    },
                ),
            },
        }

    FUNCTION = "remote_widget"
    CATEGORY = "DevTools"
    DESCRIPTION = "A node that lazily fetches options from a remote endpoint"
    RETURN_TYPES = ("STRING",)

    def remote_widget(self, remote_widget_value: str):
        return (remote_widget_value,)


class RemoteWidgetNodeWithParams:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "remote_widget_value": (
                    "COMBO",
                    {
                        "remote": {
                            "route": "/api/models/checkpoints",
                            "query_params": {
                                "sort": "true",
                            },
                        },
                    },
                ),
            },
        }

    FUNCTION = "remote_widget"
    CATEGORY = "DevTools"
    DESCRIPTION = (
        "A node that lazily fetches options from a remote endpoint with query params"
    )
    RETURN_TYPES = ("STRING",)

    def remote_widget(self, remote_widget_value: str):
        return (remote_widget_value,)


class RemoteWidgetNodeWithRefresh:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "remote_widget_value": (
                    "COMBO",
                    {
                        "remote": {
                            "route": "/api/models/checkpoints",
                            "refresh": 300,
                            "max_retries": 10,
                            "timeout": 256,
                        },
                    },
                ),
            },
        }

    FUNCTION = "remote_widget"
    CATEGORY = "DevTools"
    DESCRIPTION = "A node that lazily fetches options from a remote endpoint and refresh the options every 300 ms"
    RETURN_TYPES = ("STRING",)

    def remote_widget(self, remote_widget_value: str):
        return (remote_widget_value,)


class RemoteWidgetNodeWithRefreshButton:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "remote_widget_value": (
                    "COMBO",
                    {
                        "remote": {
                            "route": "/api/models/checkpoints",
                            "refresh_button": True,
                        },
                    },
                ),
            },
        }

    FUNCTION = "remote_widget"
    CATEGORY = "DevTools"
    DESCRIPTION = "A node that lazily fetches options from a remote endpoint and has a refresh button to manually reload options"
    RETURN_TYPES = ("STRING",)

    def remote_widget(self, remote_widget_value: str):
        return (remote_widget_value,)


class RemoteWidgetNodeWithControlAfterRefresh:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "remote_widget_value": (
                    "COMBO",
                    {
                        "remote": {
                            "route": "/api/models/checkpoints",
                            "refresh_button": True,
                            "control_after_refresh": "first",
                        },
                    },
                ),
            },
        }

    FUNCTION = "remote_widget"
    CATEGORY = "DevTools"
    DESCRIPTION = "A node that lazily fetches options from a remote endpoint and has a refresh button to manually reload options and select the first option on refresh"
    RETURN_TYPES = ("STRING",)

    def remote_widget(self, remote_widget_value: str):
        return (remote_widget_value,)


class NodeWithOutputCombo:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "subset_options": (["A", "B"], {"forceInput": True}),
                "subset_options_v2": (
                    "COMBO",
                    {"options": ["A", "B"], "forceInput": True},
                ),
            }
        }

    RETURN_TYPES = (["A", "B", "C"],)
    FUNCTION = "node_with_output_combo"
    CATEGORY = "DevTools"
    DESCRIPTION = "A node that outputs a combo type"

    def node_with_output_combo(self, subset_options: str):
        return (subset_options,)


class MultiSelectNode:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "foo": (
                    "COMBO",
                    {
                        "options": ["A", "B", "C"],
                        "multi_select": {
                            "placeholder": "Choose foos",
                            "chip": True,
                        },
                    },
                )
            }
        }

    RETURN_TYPES = ("STRING",)
    OUTPUT_IS_LIST = [True]
    FUNCTION = "multi_select_node"
    CATEGORY = "DevTools"
    DESCRIPTION = "A node that outputs a multi select type"

    def multi_select_node(self, foo: list[str]) -> list[str]:
        return (foo,)


class LoadAnimatedImageTest(nodes.LoadImage):
    @classmethod
    def INPUT_TYPES(s):
        input_dir = folder_paths.get_input_directory()
        files = [
            f
            for f in os.listdir(input_dir)
            if os.path.isfile(os.path.join(input_dir, f)) and f.endswith(".webp")
        ]
        files = folder_paths.filter_files_content_types(files, ["image"])
        return {
            "required": {"image": (sorted(files), {"animated_image_upload": True})},
        }


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


NODE_CLASS_MAPPINGS = {
    "DevToolsErrorRaiseNode": ErrorRaiseNode,
    "DevToolsErrorRaiseNodeWithMessage": ErrorRaiseNodeWithMessage,
    "DevToolsExperimentalNode": ExperimentalNode,
    "DevToolsDeprecatedNode": DeprecatedNode,
    "DevToolsLongComboDropdown": LongComboDropdown,
    "DevToolsNodeWithOptionalInput": NodeWithOptionalInput,
    "DevToolsNodeWithOptionalComboInput": NodeWithOptionalComboInput,
    "DevToolsNodeWithOnlyOptionalInput": NodeWithOnlyOptionalInput,
    "DevToolsNodeWithOutputList": NodeWithOutputList,
    "DevToolsNodeWithForceInput": NodeWithForceInput,
    "DevToolsNodeWithDefaultInput": NodeWithDefaultInput,
    "DevToolsNodeWithStringInput": NodeWithStringInput,
    "DevToolsNodeWithUnionInput": NodeWithUnionInput,
    "DevToolsSimpleSlider": SimpleSlider,
    "DevToolsNodeWithSeedInput": NodeWithSeedInput,
    "DevToolsObjectPatchNode": ObjectPatchNode,
    "DevToolsNodeWithBooleanInput": NodeWithBooleanInput,
    "DevToolsRemoteWidgetNode": RemoteWidgetNode,
    "DevToolsRemoteWidgetNodeWithParams": RemoteWidgetNodeWithParams,
    "DevToolsRemoteWidgetNodeWithRefresh": RemoteWidgetNodeWithRefresh,
    "DevToolsRemoteWidgetNodeWithRefreshButton": RemoteWidgetNodeWithRefreshButton,
    "DevToolsRemoteWidgetNodeWithControlAfterRefresh": RemoteWidgetNodeWithControlAfterRefresh,
    "DevToolsNodeWithOutputCombo": NodeWithOutputCombo,
    "DevToolsMultiSelectNode": MultiSelectNode,
    "DevToolsLoadAnimatedImageTest": LoadAnimatedImageTest,
    "DevToolsNodeWithValidation": NodeWithValidation,
    "DevToolsNodeWithV2ComboInput": NodeWithV2ComboInput,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "DevToolsErrorRaiseNode": "Raise Error",
    "DevToolsErrorRaiseNodeWithMessage": "Raise Error with Message",
    "DevToolsExperimentalNode": "Experimental Node",
    "DevToolsDeprecatedNode": "Deprecated Node",
    "DevToolsLongComboDropdown": "Long Combo Dropdown",
    "DevToolsNodeWithOptionalInput": "Node With Optional Input",
    "DevToolsNodeWithOptionalComboInput": "Node With Optional Combo Input",
    "DevToolsNodeWithOnlyOptionalInput": "Node With Only Optional Input",
    "DevToolsNodeWithOutputList": "Node With Output List",
    "DevToolsNodeWithForceInput": "Node With Force Input",
    "DevToolsNodeWithDefaultInput": "Node With Default Input",
    "DevToolsNodeWithStringInput": "Node With String Input",
    "DevToolsNodeWithUnionInput": "Node With Union Input",
    "DevToolsSimpleSlider": "Simple Slider",
    "DevToolsNodeWithSeedInput": "Node With Seed Input",
    "DevToolsObjectPatchNode": "Object Patch Node",
    "DevToolsNodeWithBooleanInput": "Node With Boolean Input",
    "DevToolsRemoteWidgetNode": "Remote Widget Node",
    "DevToolsRemoteWidgetNodeWithParams": "Remote Widget Node With Sort Query Param",
    "DevToolsRemoteWidgetNodeWithRefresh": "Remote Widget Node With 300ms Refresh",
    "DevToolsRemoteWidgetNodeWithRefreshButton": "Remote Widget Node With Refresh Button",
    "DevToolsRemoteWidgetNodeWithControlAfterRefresh": "Remote Widget Node With Refresh Button and Control After Refresh",
    "DevToolsNodeWithOutputCombo": "Node With Output Combo",
    "DevToolsMultiSelectNode": "Multi Select Node",
    "DevToolsLoadAnimatedImageTest": "Load Animated Image",
    "DevToolsNodeWithValidation": "Node With Validation",
    "DevToolsNodeWithV2ComboInput": "Node With V2 Combo Input",
}