import { PromptManager } from "@eurekai/shared/src/prompt.manager";
import PouchDB from "pouchdb";
import { PromptElement } from "src/components/prompt.element";

export class ClientPromptManager extends PromptManager {

    protected readonly _replication: PouchDB.Replication.Sync<{}>;

    // -- Main form --
    protected readonly _positiveInput: HTMLInputElement;
    protected readonly _negativeInput: HTMLInputElement;
    protected readonly _queueButton: HTMLButtonElement;
    protected readonly _cleanButton: HTMLButtonElement;

    // -- Prompt divs --
    protected readonly _promptsDiv: HTMLDivElement;
    protected _promptsCache: {[_id:string]: PromptElement} = {};

    constructor() {
        super(PouchDB);

        // -- Get components --
        this._positiveInput = document.getElementById("positiveInput") as HTMLInputElement;
        this._negativeInput = document.getElementById("negativeInput") as HTMLInputElement;
        this._promptsDiv = document.getElementById("promptsDiv") as HTMLDivElement;
        this._queueButton = document.getElementById("queueButton") as HTMLButtonElement;
        this._cleanButton = document.getElementById("cleanPromptsButton") as HTMLButtonElement;

        // -- Bind callbacks for buttons --
        this._queueButton.addEventListener("click", this._onQueueClick.bind(this));
        this._cleanButton.addEventListener("click", this._onCleanClick.bind(this));
        
        // -- Setup db replication --
        // FIXME Read URL from location
        this._replication = this._db.sync('http://localhost:3000/db/prompts', {
            live: true,
            retry: true,
            since: 0
        });
        this._replication.on("change", this._refresh.bind(this));

        this._refresh();
    }

    /** Refresh prompts */
    protected async _refresh(): Promise<void> {
        try {
            // -- Get images --
            const prompts = await this.getAllPrompts();

            // -- Clear --
            this._promptsDiv.innerHTML = "";
            // -- Render --
            for (const prompt of prompts) {
                const existing: PromptElement | undefined = this._promptsCache[prompt._id];
                if (existing == null) {
                    // Not existing yet
                    const element = new PromptElement(prompt);
                    this._promptsDiv.append(element);
                } else {
                    // Existing
                    existing.setData(prompt); // Maybe image has been updated
                    this._promptsDiv.append(existing);
                }
            }
        } catch(e) {
            console.error(e);
        }

    }

    /** Add queue button callback */
    protected async _onQueueClick(): Promise<void> {
        const positivePrompt = this._positiveInput.value;
        const negativePrompt = this._negativeInput.value;

        await this.push(positivePrompt, negativePrompt ? undefined : negativePrompt);
    }

    protected _onCleanClick(): Promise<void> {
        this._promptsCache = {};
        return this.clean();
    }

}