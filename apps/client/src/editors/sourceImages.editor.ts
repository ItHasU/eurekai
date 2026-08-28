import { asNamed } from "@dagda/shared/entities/named.types";
import { PictureType, ProjectId, SourceImageEntity } from "@eurekai/shared/src/entities";
import { deleteSourceImage } from "@eurekai/shared/src/pictures.data";
import { htmlStringToElement, showConfirm } from "src/components/tools";
import { StaticDataProvider } from "src/tools/dataProvider";

/** Longest side an uploaded source image is resized to before being stored */
const MAX_DIMENSION = 2048;
const JPEG_QUALITY = 0.92;

/** Read a file, downscale it and return its raw base64 data (no "data:...;base64," prefix) */
function resizeImageToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error ?? new Error(`Failed to read ${file.name}`));
        reader.onload = () => {
            const img = new Image();
            img.onerror = () => reject(new Error(`Failed to decode ${file.name}`));
            img.onload = () => {
                const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
                const width = Math.max(1, Math.round(img.width * scale));
                const height = Math.max(1, Math.round(img.height * scale));
                const canvas = document.createElement("canvas");
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                if (ctx == null) {
                    reject(new Error("Canvas 2d context not available"));
                    return;
                }
                ctx.drawImage(img, 0, 0, width, height);
                const dataURL = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
                resolve(dataURL.substring(dataURL.indexOf(",") + 1));
            };
            img.src = reader.result as string;
        };
        reader.readAsDataURL(file);
    });
}

/** Gallery of the source images attached to the current project, with upload / delete */
export class SourceImagesEditor extends HTMLElement {

    protected _projectId: ProjectId | null = null;
    protected readonly _fileInput: HTMLInputElement;
    protected readonly _gridDiv: HTMLDivElement;

    constructor() {
        super();
        this.innerHTML = require("./sourceImages.editor.html").default;

        this._fileInput = this.querySelector("#sourceImagesFileInput") as HTMLInputElement;
        this._gridDiv = this.querySelector("#sourceImagesGrid") as HTMLDivElement;

        this._fileInput.addEventListener("change", () => void this._onFilesSelected());
    }

    public setProjectId(projectId: ProjectId): void {
        this._projectId = projectId;
        this.refresh();
    }

    public refresh(): void {
        this._gridDiv.innerHTML = "";
        if (this._projectId == null) {
            return;
        }
        for (const sourceImage of StaticDataProvider.entitiesHandler.getItems("sources")) {
            if (!StaticDataProvider.entitiesHandler.isSameId(sourceImage.projectId, this._projectId)) {
                continue;
            }
            this._gridDiv.appendChild(this._buildThumbnail(sourceImage));
        }
    }

    protected _buildThumbnail(sourceImage: SourceImageEntity): HTMLElement {
        // htmlStringToElement() returns the template content's firstChild : the string must not
        // start with whitespace/a newline, otherwise firstChild is a text node, not the <div>.
        const el = htmlStringToElement<HTMLDivElement>(`<div class="col-4 col-md-3 col-lg-2 mb-2">
                <div class="card">
                    <img class="card-img-top" src="/attachment/${sourceImage.attachmentId}" style="aspect-ratio: 1/1; object-fit: cover;" alt="${sourceImage.name}">
                    <div class="card-body p-1 text-center">
                        <small class="text-truncate d-block" title="${sourceImage.name}">${sourceImage.name}</small>
                        <button type="button" class="btn btn-sm btn-outline-danger w-100" ref="delete">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </div>
            </div>`)!;

        el.querySelector("[ref='delete']")?.addEventListener("click", async () => {
            const confirmed = await showConfirm({ title: "Delete image", message: `Delete "${sourceImage.name}"?` });
            if (confirmed !== true) {
                return;
            }
            await StaticDataProvider.entitiesHandler.withTransaction((tr) => {
                deleteSourceImage(StaticDataProvider.entitiesHandler, tr, sourceImage);
            });
            this.refresh();
        });
        return el;
    }

    protected async _onFilesSelected(): Promise<void> {
        const files = this._fileInput.files;
        const projectId = this._projectId;
        if (files == null || files.length === 0 || projectId == null) {
            return;
        }
        try {
            for (const file of Array.from(files)) {
                const base64 = await resizeImageToBase64(file);
                await StaticDataProvider.entitiesHandler.withTransaction((tr) => {
                    const attachment = tr.insert("attachments", {
                        id: asNamed(0),
                        type: asNamed(PictureType.IMAGE),
                        data: asNamed(base64)
                    });
                    tr.insert("sources", {
                        id: asNamed(0),
                        projectId,
                        attachmentId: attachment.id,
                        name: asNamed(file.name)
                    });
                });
                // withTransaction() resolves as soon as the request is sent, before the server
                // assigns real ids. Wait for it, otherwise the thumbnail below is requested with
                // the temporary (negative) attachment id and 404s.
                await StaticDataProvider.entitiesHandler.waitForSubmit();
            }
        } catch (e) {
            console.error(e);
        } finally {
            this._fileInput.value = "";
            this.refresh();
        }
    }
}

customElements.define("editor-source-images", SourceImagesEditor);
