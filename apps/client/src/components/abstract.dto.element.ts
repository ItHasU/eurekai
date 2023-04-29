import * as Handlebars from "handlebars";

export abstract class AbstractDTOElement<DTO> extends HTMLElement {
    
    protected readonly _template: HandlebarsTemplateDelegate;

    constructor(protected data: DTO, template: string) {
        super();
        // Load template
        this._template = Handlebars.compile(template);
    }

    /** Set data and refresh */
    public setData(data: DTO): void {
        this.data = data;
    }

    /** Refresh the content of the element from the template */
    public refresh(): void {
        let content: string = this._template(this);
        this.innerHTML = content;
    }

    protected _bindClick(ref: string, cb: () => void): void {
        (this.querySelector(`*[ref="${ref}"]`) as HTMLButtonElement | undefined)?.addEventListener("click", cb);
    }

}