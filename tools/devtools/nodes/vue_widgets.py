from __future__ import annotations

SAMPLE_IMAGE_DATA_URI = (
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAAKklEQVR4nO3NsQEAAATAMLzr/5kn2NIDmpzu+Kxe7wAAAAAAAAAAAOCwBcUDAhU8Tp3xAAAAAElFTkSuQmCC"
)
SAMPLE_IMAGE_DATA_URI_ALT = (
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAALUlEQVR4nGM0nvWBgZaAiaamj1owasGoBaMWjFowasGoBaMWjFowasGoBVQEAKDTAf3D6Eg+AAAAAElFTkSuQmCC"
)
SAMPLE_IMAGE_DATA_URI_THIRD = (
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAALUlEQVR4nGMMPJ/GQEvARFPTRy0YtWDUglELRi0YtWDUglELRi0YtWDUAioCAAbrAcZ7cQHKAAAAAElFTkSuQmCC"
)


class VueFileUploadWidgetNode:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "uploaded_file": (
                    "FILEUPLOAD",
                    {
                        "default": [],
                        "options": {
                            "extensions": ["png", "jpg", "jpeg", "webp"],
                            "accept": "image/png,image/jpeg,image/webp",
                            "tooltip": "Upload an image file",
                        },
                    },
                )
            }
        }

    RETURN_TYPES = ("STRING",)
    FUNCTION = "return_file"
    CATEGORY = "DevTools/Vue Widgets"
    DESCRIPTION = "Showcases the FILEUPLOAD widget"

    def return_file(self, uploaded_file: str | None):
        return (uploaded_file or "",)


class VueImageCompareWidgetNode:
    BEFORE_IMAGE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMgAAAB4CAIAAAA48Cq8AAAC8ElEQVR4nO3Wv0uqURzH8Y/ykNXgFBQ1NERBNIS7jTUF4VBQ7RE4SH9Hg0jQ3KA1WVO74RYWREskREE0NRUNYvrc4XZBL3V/wP3kNd+v7eGcL5zhzTlPJEynBfxr0U4fAF8TYcGCsGBBWLAgLFgQFiwICxaEBQvCggVhwYKwYEFYsCAsWBAWLAgLFoQFC8KCBWHBgrBgQViwICxYEBYsCAsWhAULwoIFYcGCsGBBWLAgLFgQFiwICxaEBQvCggVhwYKwYEFYsCAsWBAWLAgLFoQFC8KCBWHBgrBgQViwICxYEBYsuhHW6KgWFzU01IWj8b8EEf9ePq/7e8ViGhzU6amurz/Zs7WlalVPNbMdHsJdEHdbzu07aaY0Pb252Elk6pUIj4XPSbqsH55elKzqeFhra4qmVQQ6PhYDw9aWFAioVxOpZLW1pRIKAxVLOrlRbu7urrS46POz3+fQr+xfWPNzKhcViajszPt7engQBsbklStKgxVKGh5WTVa8nnVaspiLCtCh8e6m0N7NZpclMUyo3LUqk0U0Ppra+vwOaPNZCn1ddn8dEtYvVSpOYqSRMT89g4MdKRpJKpRMoqXTdfqfBWm08RF4z/y9Ktfm+fXpLLjEgcFPTd1WsHyJRKxBqVTpIqH9f1f3xBd5JJkEplI+LtMv4ucVaFZ7o2j/AuAxn4OwIEFYkCAsSBAWJAgLEoQFCcKCBGFBgrAgQViQICxIEBYkCAsShAUJwoIEYUGCsCBBWJAgLEgQFiQICxKEBQnCggRhQYKwIEFYkCAsSBAWJAgLEoQFCcKCBGFBgrAgQViQICxIEBYkCAsShAUJwoIEYUGCsCBBWJAgLEgQFiw+AcwZf7lBBNZAAA"
    AFTER_IMAGE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMgAAAB4CAIAAAA48Cq8AAADDklEQVR4nO3Z32uNcRzA8e/3Oc85Oz/WLFqNzjZuxKgtWpmwluxiUYoLudlKubH/QHJBuZE7LuYfoCQXolxJasmF1EjJhRrhQpQ1O85zjouzEm69d7Ler6vvU8+Pz8W7b9964u7ZL0H615J2D6C1ybCEMCwhDEsIwxLCsIQwLCEMSwjDEsKwhDAsIQxLCMMSwrCEMCwhDEsIwxLCsIQwLCEMSwjDEsKwhDAsIQxLCMMSwrCEMCwhDEsIwxLCsIQwLCEMSwjDEsKwhDAsIQxLCMMSwrCEMCwhDEsIwxLCsIQwLCEMSwjDEsKwhDAsIQxLCMMSwrCEMCwhDEsIwxLCsIRY1bA2dydTQx2dhbiaH1VbsGEd3VaYO7VufWmlpMuHKstZM2uE6eEO9LtqOzasA/3pjfnlfX351uWGcrwxX1uqN6eHDGuNA8MqprGYxjuvavsG0hDC8cFCJR9nD1dmRorlfLw6WenqiBfGy9cmK9ePVHb05FpPPZzqOj9WOrGzwA2mVZByrx6tpnML9bdfG5s6k3wSbr2szYwUT99dDCEcHyycubd47kDp5ovl+U9Zb2dyZaJ88va3EEIhFx+8+TG3UOcG0yoAwxobSLduyB3cku8pJ7s2pk/e/dnKaDXt61rZMkv5mMTQaIas2fz7Tv13qLCSGPrX5Vqb0Gg13d+f/zuXXIwz9xdrWUhiGE5NG80QQsgaobXQf406Yw33pq8/Z631sw/ZnupvBScxJDE8/1gf35wPIeztSz3OrzHUjjU2kD59v7JFfa83Py81tnT/ivjZh+zKROXS46Wz+0vHtheyZrj4aAmaRG0Rd89+afcMWoP8pSOEYQlhWEIYlhCGJYRhCWFYQhiWEIYlhGEJYVhCGJYQhiWEYQlhWEIYlhCGJYRhCWFYQhiWEIYlhGEJYVhCGJYQhiWEYQlhWEIYlhCGJYRhCWFYQhiWEIYlhGEJYVhCGJYQhiWEYQlhWEIYlhCGJYRhCWFYQhiWEIYlhGEJYVhCGJYQhiWEYQlhWEIYlhCGJYRhCWFYQvwE4Ex5XANtu7QAAAAASUVORK5CYII="
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "comparison": (
                    "IMAGECOMPARE",
                    {
                        "default": {
                            "before": BEFORE_IMAGE,
                            "after": AFTER_IMAGE,
                        },
                        "options": {
                            "beforeAlt": "Before",
                            "afterAlt": "After",
                            "initialPosition": 40,
                        },
                    },
                )
            }
        }

    RETURN_TYPES = ()
    FUNCTION = "noop"
    CATEGORY = "DevTools/Vue Widgets"
    DESCRIPTION = "Showcases the IMAGECOMPARE widget"

    def noop(self, comparison):
        return tuple()


class VueTreeSelectWidgetNode:
    TREE_DATA = [
        {
            "key": "root",
            "label": "Root",
            "children": [
                {
                    "key": "section-a",
                    "label": "Section A",
                    "children": [
                        {"key": "item-a1", "label": "Item A1"},
                        {"key": "item-a2", "label": "Item A2"},
                    ],
                },
                {
                    "key": "section-b",
                    "label": "Section B",
                    "children": [
                        {"key": "item-b1", "label": "Item B1"},
                        {"key": "item-b2", "label": "Item B2"},
                    ],
                },
            ],
        }
    ]

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "selection": (
                    "TREESELECT",
                    {
                        "default": "item-a1",
                        "options": {
                            "values": cls.TREE_DATA,
                            "multiple": False,
                            "placeholder": "Select an item",
                        },
                    },
                )
            }
        }

    RETURN_TYPES = ("STRING",)
    FUNCTION = "return_selection"
    CATEGORY = "DevTools/Vue Widgets"
    DESCRIPTION = "Showcases the TREESELECT widget"

    def return_selection(self, selection: str):
        return (selection,)


class VueTreeSelectMultiWidgetNode(VueTreeSelectWidgetNode):
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "selection": (
                    "TREESELECT",
                    {
                        "default": ["item-a1", "item-b1"],
                        "options": {
                            "values": cls.TREE_DATA,
                            "multiple": True,
                            "placeholder": "Select items",
                        },
                    },
                )
            }
        }

    RETURN_TYPES = ("STRING",)
    OUTPUT_IS_LIST = (True,)
    FUNCTION = "return_selection"
    CATEGORY = "DevTools/Vue Widgets"
    DESCRIPTION = "Showcases the TREESELECT widget in multi-select mode"

    def return_selection(self, selection: list[str]):
        return (selection,)


class VueSelectButtonWidgetNode:
    @classmethod
    def INPUT_TYPES(cls):
        options = [
            {"label": "Low", "value": "low"},
            {"label": "Medium", "value": "medium"},
            {"label": "High", "value": "high"},
        ]

        return {
            "required": {
                "mode": (
                    "SELECTBUTTON",
                    {
                        "default": "Medium",
                        "options": {
                            "values": ["Low", "Medium", "High"],
                        },
                    },
                )
            }
        }

    RETURN_TYPES = ("STRING",)
    FUNCTION = "return_mode"
    CATEGORY = "DevTools/Vue Widgets"
    DESCRIPTION = "Showcases the SELECTBUTTON widget"

    def return_mode(self, mode: str):
        return (mode,)


class VueTextareaWidgetNode:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "notes": (
                    "TEXTAREA",
                    {
                        "default": "This is a DevTools textarea widget.\nFeel free to edit me!",
                        "options": {
                            "rows": 4,
                            "cols": 40,
                        },
                    },
                )
            }
        }

    RETURN_TYPES = ("STRING",)
    FUNCTION = "return_notes"
    CATEGORY = "DevTools/Vue Widgets"
    DESCRIPTION = "Showcases the TEXTAREA widget"

    def return_notes(self, notes: str):
        return (notes,)


class VueChartWidgetNode:
    CHART_DATA = {
        "labels": ["Iteration 1", "Iteration 2", "Iteration 3"],
        "datasets": [
            {
                "label": "Loss",
                "data": [0.95, 0.62, 0.31],
                "borderColor": "#339AF0",
                "backgroundColor": "rgba(51, 154, 240, 0.2)",
                "fill": True,
                "tension": 0.35,
            }
        ],
    }

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "chart": (
                    "CHART",
                    {
                        "options": {
                            "type": "line",
                            "data": cls.CHART_DATA,
                        },
                    },
                )
            }
        }

    RETURN_TYPES = ("DICT",)
    FUNCTION = "return_chart"
    CATEGORY = "DevTools/Vue Widgets"
    DESCRIPTION = "Showcases the CHART widget"

    def return_chart(self, chart):
        return (chart,)


class VueGalleriaWidgetNode:
    GALLERIA_IMAGES = [
        {
            "itemImageSrc": SAMPLE_IMAGE_DATA_URI,
            "thumbnailImageSrc": SAMPLE_IMAGE_DATA_URI,
            "alt": "Warm gradient",
        },
        {
            "itemImageSrc": SAMPLE_IMAGE_DATA_URI_ALT,
            "thumbnailImageSrc": SAMPLE_IMAGE_DATA_URI_ALT,
            "alt": "Cool gradient",
        },
        {
            "itemImageSrc": SAMPLE_IMAGE_DATA_URI_THIRD,
            "thumbnailImageSrc": SAMPLE_IMAGE_DATA_URI_THIRD,
            "alt": "Fresh gradient",
        },
    ]

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "gallery": (
                    "GALLERIA",
                    {
                        "default": cls.GALLERIA_IMAGES,
                        "options": {
                            "images": cls.GALLERIA_IMAGES,
                            "showThumbnails": True,
                            "showItemNavigators": True,
                        },
                    },
                )
            }
        }

    RETURN_TYPES = ()
    FUNCTION = "noop"
    CATEGORY = "DevTools/Vue Widgets"
    DESCRIPTION = "Showcases the GALLERIA widget"

    def noop(self, gallery):
        return tuple()


class VueMarkdownWidgetNode:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "markdown": (
                    "MARKDOWN",
                    {
                        "default": "# DevTools Markdown\nThis widget renders **Markdown** content.",
                        "options": {
                            "content": "# DevTools Markdown\nThis widget renders **Markdown** content.",
                        },
                    },
                )
            }
        }

    RETURN_TYPES = ()
    FUNCTION = "noop"
    CATEGORY = "DevTools/Vue Widgets"
    DESCRIPTION = "Showcases the MARKDOWN widget"

    def noop(self, markdown):
        return tuple()


class VueAudioRecordWidgetNode:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "recording": (
                    "AUDIORECORD",
                    {
                        "default": "",
                    },
                )
            }
        }

    RETURN_TYPES = ("STRING",)
    FUNCTION = "return_recording"
    CATEGORY = "DevTools/Vue Widgets"
    DESCRIPTION = "Showcases the AUDIORECORD widget"

    def return_recording(self, recording: str):
        return (recording,)


class VueMultiSelectWidgetNode:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "selection": (
                    "MULTISELECT",
                    {
                        "default": ["option1", "option3"],
                        "options": {
                            "values": ["option1", "option2", "option3", "option4", "option5"],
                        },
                    },
                )
            }
        }

    RETURN_TYPES = ("STRING",)
    OUTPUT_IS_LIST = (True,)
    FUNCTION = "return_selection"
    CATEGORY = "DevTools/Vue Widgets"
    DESCRIPTION = "Showcases the MULTISELECT widget"

    def return_selection(self, selection: list[str]):
        return (selection,)


class VueColorWidgetNode:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "color": (
                    "COLOR",
                    {
                        "default": "#ff6b6b",
                        "options": {
                            "tooltip": "Pick a color",
                        },
                    },
                )
            }
        }

    RETURN_TYPES = ("STRING",)
    FUNCTION = "return_color"
    CATEGORY = "DevTools/Vue Widgets"
    DESCRIPTION = "Showcases the COLOR widget"

    def return_color(self, color: str):
        return (color,)


class VueAudioPreviewComboNode:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "audio": (
                    "COMBO",
                    {
                        "options": ["ambient.wav", "dialog.wav"],
                        "default": "ambient.wav",
                        "tooltip": "Pick an audio clip",
                    },
                )
            }
        }

    RETURN_TYPES = ("STRING",)
    FUNCTION = "return_audio"
    CATEGORY = "DevTools/Vue Widgets"
    DESCRIPTION = "Showcases the COMBO widget rendered as Audio UI"

    def return_audio(self, audio: str):
        return (audio,)


NODE_CLASS_MAPPINGS = {
    "DevToolsVueFileUploadWidgetNode": VueFileUploadWidgetNode,
    "DevToolsVueImageCompareWidgetNode": VueImageCompareWidgetNode,
    "DevToolsVueTreeSelectWidgetNode": VueTreeSelectWidgetNode,
    "DevToolsVueTreeSelectMultiWidgetNode": VueTreeSelectMultiWidgetNode,
    "DevToolsVueSelectButtonWidgetNode": VueSelectButtonWidgetNode,
    "DevToolsVueMultiSelectWidgetNode": VueMultiSelectWidgetNode,
    "DevToolsVueTextareaWidgetNode": VueTextareaWidgetNode,
    "DevToolsVueChartWidgetNode": VueChartWidgetNode,
    "DevToolsVueGalleriaWidgetNode": VueGalleriaWidgetNode,
    "DevToolsVueMarkdownWidgetNode": VueMarkdownWidgetNode,
    "DevToolsVueAudioRecordWidgetNode": VueAudioRecordWidgetNode,
    "DevToolsVueColorWidgetNode": VueColorWidgetNode,
    "DevToolsVueAudioPreviewComboNode": VueAudioPreviewComboNode,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "DevToolsVueFileUploadWidgetNode": "Vue File Upload Widget",
    "DevToolsVueImageCompareWidgetNode": "Vue Image Compare Widget",
    "DevToolsVueTreeSelectWidgetNode": "Vue Tree Select Widget",
    "DevToolsVueTreeSelectMultiWidgetNode": "Vue Tree Select (Multi) Widget",
    "DevToolsVueSelectButtonWidgetNode": "Vue Select Button Widget",
    "DevToolsVueMultiSelectWidgetNode": "Vue Multi Select Widget",
    "DevToolsVueTextareaWidgetNode": "Vue Textarea Widget",
    "DevToolsVueChartWidgetNode": "Vue Chart Widget",
    "DevToolsVueGalleriaWidgetNode": "Vue Galleria Widget",
    "DevToolsVueMarkdownWidgetNode": "Vue Markdown Widget",
    "DevToolsVueAudioRecordWidgetNode": "Vue Audio Record Widget",
    "DevToolsVueColorWidgetNode": "Vue Color Widget",
    "DevToolsVueAudioPreviewComboNode": "Vue Audio Combo Widget",
}

__all__ = [
    "VueFileUploadWidgetNode",
    "VueImageCompareWidgetNode",
    "VueTreeSelectWidgetNode",
    "VueTreeSelectMultiWidgetNode",
    "VueSelectButtonWidgetNode",
    "VueMultiSelectWidgetNode",
    "VueTextareaWidgetNode",
    "VueChartWidgetNode",
    "VueGalleriaWidgetNode",
    "VueMarkdownWidgetNode",
    "VueAudioRecordWidgetNode",
    "VueColorWidgetNode",
    "VueAudioPreviewComboNode",
    "NODE_CLASS_MAPPINGS",
    "NODE_DISPLAY_NAME_MAPPINGS",
]
