import { asNamed } from "@dagda/shared/entities/named.types";
import { ProjectEntity, ProjectId } from "@eurekai/shared/src/entities";
import { Modal } from "bootstrap";

/** Pinned projects first, then most recent first */
export function sortProjects<T extends Pick<ProjectEntity, "id" | "pinned">>(projects: T[]): T[] {
    return projects.sort((a, b) => (a.pinned === true ? 0 : 1) - (b.pinned === true ? 0 : 1) || -(a.id - b.id));
}

/** Ask for a target project (defaulting to the current one) and a name. Used by "Use as source". */
export function showUseAsSourceDialog(options: {
    projects: ProjectEntity[],
    defaultProjectId: ProjectId,
    defaultName: string
}): Promise<{ projectId: ProjectId, name: string } | undefined> {
    const dialog = htmlStringToElement<HTMLDivElement>(`<div class="modal">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Use as source</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-3">
                            <label class="form-label">Project</label>
                            <select ref="project" class="form-control">
            ${options.projects.map(project => {
        const selected = project.id === options.defaultProjectId ? "selected" : "";
        return `<option value="${project.id}" ${selected}>${project.name}</option>`;
    }).join("\n")}
                            </select>
                        </div>
                        <div>
                            <label class="form-label">Name</label>
                            <input ref="name" type="text" class="form-control" value="${options.defaultName}">
                        </div>
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
    const projectSelect = dialog.querySelector<HTMLSelectElement>("select[ref='project']");
    const nameInput = dialog.querySelector<HTMLInputElement>("input[ref='name']");
    if (projectSelect == null || nameInput == null) {
        return Promise.resolve(undefined);
    }

    const myModal = new Modal(dialog, {
        keyboard: false,
        backdrop: "static"
    });

    return new Promise<{ projectId: ProjectId, name: string } | undefined>((resolve, reject) => {
        dialog.querySelector("button[ref='ok']")?.addEventListener("click", () => {
            const name = nameInput.value.trim();
            if (!name) {
                nameInput.classList.add("is-invalid");
                return;
            }
            resolve({ projectId: asNamed(+projectSelect.value), name });
            myModal.hide();
        });
        dialog.addEventListener('hidden.bs.modal', event => {
            resolve(undefined);
            dialog.remove();
        });
        // -- Show the dialog --
        document.body.appendChild(dialog);
        myModal.show();
    });
}

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