import * as Handlebars from "handlebars";

export abstract class AbstractDTOElement<DTO> extends HTMLElement {
    
    protected readonly _template: HandlebarsTemplateDelegate;

    constructor(protected data: DTO, template: string) {
        super();
        // Load template
        this._template = Handlebars.compile(template);
        this._refresh();
    }

    /** Set data and refresh */
    public setData(data: DTO): void {
        this.data = data;
        this._refresh();
    }

    /** Refresh the content of the element from the template */
    protected _refresh(): void {
        let content: string = this._template(this);
        this.innerHTML = content;
    }

}