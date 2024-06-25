import { app } from "../../scripts/app";
import { api } from "../../scripts/api";
import type { IWidget } from "/types/litegraph";


function getResourceURL(path: string): string {
	let folder_separator = path.lastIndexOf("/");
	let subfolder = "";
	if (folder_separator > -1) {
		subfolder = path.substring(0, folder_separator);
		path = path.substring(folder_separator + 1);
	}

	const params = [
		"filename=" + encodeURIComponent(path),
		"type=input",
		"subfolder=" + subfolder,
		app.getPreviewFormatParam().substring(1),
		app.getRandParam().substring(1),
	].join("&");

	return `/view?${params}`;
}

function updateAudio(audioUIWidget: IWidget, audioFilePath: string) {
	audioUIWidget.property["sourceElement"].src = api.apiURL(getResourceURL(audioFilePath));
}

async function uploadFile(
	audioWidget: IWidget,
	audioUIWidget: IWidget,
	file: File,
	updateNode: boolean,
	pasted: boolean = false
) {
	try {
		// Wrap file in formdata so it includes filename
		const body = new FormData();
		body.append("image", file);
		if (pasted) body.append("subfolder", "pasted");
		const resp = await api.fetchApi("/upload/image", {
			method: "POST",
			body,
		});

		if (resp.status === 200) {
			const data = await resp.json();
			// Add the file to the dropdown list and update the widget value
			let path = data.name;
			if (data.subfolder) path = data.subfolder + "/" + path;

			if (!audioWidget.options.values.includes(path)) {
				audioWidget.options.values.push(path);
			}

			if (updateNode) {
				updateAudio(audioUIWidget, path);
				audioWidget.value = path;
			}
		} else {
			alert(resp.status + " - " + resp.statusText);
		}
	} catch (error) {
		alert(error);
	}
}

app.registerExtension({
	name: "Comfy.UploadAudio",
	async beforeRegisterNodeDef(nodeType, nodeData) {
		if (nodeData?.input?.required?.audio?.[1]?.audio_upload === true) {
			nodeData.input.required.upload = ["AUDIOUPLOAD"];
		}
	},
	getCustomWidgets() {
		return {
			AUDIOUPLOAD(node, inputName: string) {
				// The widget that allows user to select file.
				const audioWidget: IWidget = node.widgets.find((w: IWidget) => w.name === "audio");
				const audioUIWidget: IWidget = node.widgets.find((w: IWidget) => w.name === "audioUI");

				audioWidget.callback = function () {
					updateAudio(audioUIWidget, audioWidget.value);
				}

				const fileInput = document.createElement("input");
				fileInput.type = "file";
				fileInput.accept = "audio/*";
				fileInput.style.display = "none";
				fileInput.onchange = () => {
					if (fileInput.files.length) {
						uploadFile(audioWidget, audioUIWidget, fileInput.files[0], true);
					}
				};
				// The widget to pop up the upload dialog.
				const uploadWidget = node.addWidget("button", inputName, /* value=*/"", () => {
					fileInput.click();
				});
				uploadWidget.label = "choose file to upload";
				uploadWidget.serialize = false;

				return { widget: uploadWidget };
			}
		}
	},
});

app.registerExtension({
	name: "Comfy.AudioWidget",
	async beforeRegisterNodeDef(nodeType, nodeData) {
		if (["LoadAudio", "SaveAudio"].includes(nodeType.comfyClass)) {
			nodeData.input.required.audioUI = ["AUDIO_UI"];
		}
	},
	getCustomWidgets() {
		return {
			AUDIO_UI(node, inputName: string) {
				const audio = document.createElement("audio");
				audio.controls = true;
				audio.classList.add("comfy-audio");
				audio.setAttribute("name", "media");

				const audioUIWidget = node.addDOMWidget(inputName, /* name=*/ "audioUI", audio);
				audioUIWidget.serialize = false;

				return { widget: audioUIWidget };
			}
		}
	},
});
