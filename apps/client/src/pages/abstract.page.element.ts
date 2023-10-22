import { DataCache } from "@eurekai/shared/src/cache";

/**
 * Abstract class for a page.
 * This class will render the template only once on construction.
 * 
 * You need to implement the refresh method to update the content of the rendered template.
 * refresh() will be called automatically on connectedCallback().
 */
export abstract class AbstractPageElement extends HTMLElement {

    /** Real implementation of the refresh method. Wrapped in refresh() function to handle errors. */
    protected abstract _refresh(): Promise<void>;

    /** 
     * Pass the HTML template to render in the WebComponent.
     */
    constructor(template: string, protected _cache: DataCache) {
        super();
        // Load template
        this.innerHTML = template;
    }

    /** 
     * Refresh the content of the element from the template.
     * 
     * If thowError param is passed as false (default behavior), this method is garanteed to never fail.
     * If an error occurs, it will be catched and logged.
     */
    public refresh(throwError: boolean = false): Promise<void> {
        try {
            return this._refresh();
        } catch (e) {
            // Log error and continue
            console.error(e);
            if (throwError) {
                throw e;
            } else {
                return Promise.resolve();
            }
        }
    }

    /** Called when the component is inserted in the DOM */
    public connectedCallback(): void {
        this.refresh();
    }

    //#region Tools

    protected _bindClickForRef(ref: string, cb: () => void): void {
        (this.querySelector(`*[ref="${ref}"]`) as HTMLButtonElement | undefined)?.addEventListener("click", cb);
    }

    //#endregion
}