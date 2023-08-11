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
        let content: string = this._template(this, {
            allowProtoPropertiesByDefault: true
        });
        this.innerHTML = content;
    }

    protected _bindClick(ref: string, cb: (evt: MouseEvent) => void): void {
        this._getElementByRef(ref)?.addEventListener("click", cb);
    }

    protected _getElementByRef<T extends HTMLElement>(ref: string): T | undefined {
        return this.querySelector(`*[ref="${ref}"]`) as T | undefined;
    }
}