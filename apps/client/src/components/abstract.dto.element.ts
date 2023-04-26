import * as Handlebars from "handlebars";

export abstract class AbstractDTOElement<DTO> extends HTMLElement {
    
    protected readonly _template: HandlebarsTemplateDelegate<DTO>;

    constructor(protected _data: DTO, template: string) {
        super();
        // Load template
        this._template = Handlebars.compile<DTO>(template);
        this._refresh();
    }

    /** Set data and refresh */
    public setData(data: DTO): void {
        this._data = data;
        this._refresh();
    }

    /** Refresh the content of the element from the template */
    protected _refresh(): void {
        let content: string = this._template(this._data);
        this.innerHTML = content;
    }

}