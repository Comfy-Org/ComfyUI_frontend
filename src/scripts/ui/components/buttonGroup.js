// @ts-check

import { $el } from "../../ui";
import { ComfyButton } from "./button";
import { prop } from "../../utils";

export class ComfyButtonGroup {
	element = $el("div.comfyui-button-group");

	/** @param {Array<ComfyButton | HTMLElement>} buttons */
	constructor(...buttons) {
		this.buttons = prop(this, "buttons", buttons, () => this.update());
	}

	/**
	 * @param {ComfyButton} button
	 * @param {number} index
	 */
	insert(button, index) {
		this.buttons.splice(index, 0, button);
		this.update();
	}

	/** @param {ComfyButton} button */
	append(button) {
		this.buttons.push(button);
		this.update();
	}

	/** @param {ComfyButton|number} indexOrButton */
	remove(indexOrButton) {
		if (typeof indexOrButton !== "number") {
			indexOrButton = this.buttons.indexOf(indexOrButton);
		}
		if (indexOrButton > -1) {
			const r = this.buttons.splice(indexOrButton, 1);
			this.update();
			return r;
		}
	}

	update() {
		this.element.replaceChildren(...this.buttons.map((b) => b["element"] ?? b));
	}
}
