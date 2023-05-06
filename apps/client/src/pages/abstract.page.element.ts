import * as Handlebars from "handlebars";

export abstract class AbstractPageElement extends HTMLElement {

    protected readonly _template: Handlebars.TemplateDelegate;

    constructor(template: string) {
        super();
        // Load template
        this._template = Handlebars.compile(template);
    }

    public connectedCallback(): void {
        this.refresh().catch(console.error.bind(console));
    }

    /** Refresh the content of the element from the template */
    public async refresh(): Promise<void> {
        await this._loadData();
        let content: string = this._template(this, {
            allowProtoPropertiesByDefault: true
        });
        this.innerHTML = content;
        await this._postRender();
    }

    //#region Abstract methods

    /** Load data before refresh */
    protected abstract _loadData(): Promise<void>;

    /** Post-process once the template is rendered */
    protected abstract _postRender(): Promise<void>;

    //#endregion

    //#region Tools

    protected _bindClick(ref: string, cb: () => void): void {
        (this.querySelector(`*[ref="${ref}"]`) as HTMLButtonElement | undefined)?.addEventListener("click", cb);
    }

    //#endregion
}