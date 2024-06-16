import { addStylesheet } from "../utils";

// @ts-ignore
addStylesheet(import.meta.url);

export function createSpinner() {
	const div = document.createElement("div");
	div.innerHTML = `<div class="lds-ring"><div></div><div></div><div></div><div></div></div>`;
	return div.firstElementChild;
}
