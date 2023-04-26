import { PictureDTO } from "@eurekai/shared/src/types";
import * as Handlebars from "handlebars";

export class GeneratedImageElement extends HTMLElement {

    protected _data: PictureDTO;
    protected readonly _template = Handlebars.compile<PictureDTO>(require("./generatedImage.html").default);

    constructor(data: PictureDTO) {
        super();
        this._data = data;
        this._refresh();
    }
    
    public setData(data: PictureDTO): void {
        this._data = data;
        this._refresh();
    }

    protected _refresh(): void {
        let content: string = this._template(this._data);
        // let images: string = "";
        // if (this._data._attachments) {
        //     for (const attachmentUID in this._data._attachments) {
        //         const attachment = this._data._attachments[attachmentUID];
        //         images += `<img class="card-img-top" src="data:image/png;base64, ${attachment.data}" alt="${attachmentUID} - ${attachment.content_type}" title="${attachmentUID}">`;
        //     }
        // }

        // content = content.replace(/\{images\}/g, images);

        this.innerHTML = content;
    }
}

customElements.define("generated-img", GeneratedImageElement);