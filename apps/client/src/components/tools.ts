import { Modal } from "bootstrap";

export function showSelect<T>(choices: T[], options: {
    valueKey: keyof T,
    displayString: keyof T,
    selected?: T
}): Promise<T | undefined> {
    // -- Create a dialog with a select --
    const dialog = htmlStringToElement<HTMLDivElement>(`<div class="modal">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Move to</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <select ref="choices" class="form-control">
            ${choices.map(choice => {
        const value = choice[options.valueKey];
        const displayString = choice[options.displayString];
        const selected = options.selected === choice ? "selected" : "";
        return `<option value="${value}" ${selected}>${displayString}</option>`;
    }).join("\n")}
                        </select>
                    </div>
                    <div class="modal-footer">
                        <button ref="cancel" type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button ref="ok" type="button" class="btn btn-primary">Ok</button>
                    </div>
                </div>
            </div>
        </div>`);
    if (dialog == null) {
        return Promise.resolve(undefined);
    }
    const select = dialog.querySelector("select");
    if (select == null) {
        return Promise.resolve(undefined);
    }

    const myModal = new Modal(dialog, {
        keyboard: false,
        backdrop: "static"
    });

    return new Promise<T | undefined>((resolve, reject) => {
        dialog.querySelector("button[ref='ok']")?.addEventListener("click", () => {
            const value = select.value;
            const choice = choices.find(c => c[options.valueKey] == value);
            console.log("selected:", choice);
            resolve(choice);
            myModal.hide();
        });
        dialog.addEventListener('hidden.bs.modal', event => {
            console.log("modal hidden");
            resolve(undefined);
            dialog.remove();
        });
        // -- Show the dialog --
        document.body.appendChild(dialog);
        myModal.show();
    });
}

export function showConfirm(options: {
    title: string,
    message: string,
    okText?: string,
    cancelText?: string
}): Promise<boolean> {
    // -- Create a dialog with a select --
    const dialog = htmlStringToElement<HTMLDivElement>(`<div class="modal">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">${options.title}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <p>${options.message}</p>
                    </div>
                    <div class="modal-footer">
                        <button ref="cancel" type="button" class="btn btn-secondary" data-bs-dismiss="modal">${options.cancelText ?? "Cancel"}</button>
                        <button ref="ok" type="button" class="btn btn-primary">${options.okText ?? "Ok"}</button>
                    </div>
                </div>
            </div>
        </div>`);
    if (dialog == null) {
        return Promise.resolve(false);
    }

    const myModal = new Modal(dialog, {
        keyboard: false,
        backdrop: "static"
    });

    return new Promise<boolean>((resolve, reject) => {
        dialog.querySelector("button[ref='ok']")?.addEventListener("click", () => {
            resolve(true);
            myModal.hide();
        });
        dialog.addEventListener('hidden.bs.modal', event => {
            resolve(false);
            dialog.remove();
        });
        // -- Show the dialog --
        document.body.appendChild(dialog);
        myModal.show();
    });
}

export function htmlStringToElement<E extends HTMLElement>(htmlString: string): E | null {
    if (htmlString == null || htmlString === "") { return null; }
    const template = document.createElement("template");
    template.innerHTML = htmlString;

    return template.content.firstChild as E;
}