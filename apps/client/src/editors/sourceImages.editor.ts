import { asNamed } from "@dagda/shared/entities/named.types";
import { PICTURE_TYPE, PictureType, ProjectId, SourceImageEntity } from "@eurekai/shared/src/entities";
import { deleteSourceImage } from "@eurekai/shared/src/pictures.data";
import { htmlStringToElement, showConfirm } from "src/components/tools";
import { StaticDataProvider } from "src/tools/dataProvider";

/** Longest side an uploaded source image is resized to before being stored */
const MAX_DIMENSION = 2048;
const JPEG_QUALITY = 0.92;

/**
 * Largest video accepted, in bytes. A video is stored as it is (base64, which inflates it by a
 * third) and submitted through the entities endpoint, whose body limit is 15mb (@see server.ts).
 */
const MAX_VIDEO_BYTES = 10 * 1024 * 1024;

/** Read a file and return its raw base64 data (no "data:...;base64," prefix) */
function readAsBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error ?? new Error(`Failed to read ${file.name}`));
        reader.onload = () => {
            const dataURL = reader.result as string;
            resolve(dataURL.substring(dataURL.indexOf(",") + 1));
        };
        reader.readAsDataURL(file);
    });
}

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

/** Gallery of the sources attached to the current project, with upload / delete */
export class SourceImagesEditor extends HTMLElement {

    protected _projectId: ProjectId | null = null;
    protected readonly _fileInput: HTMLInputElement;
    protected readonly _errorDiv: HTMLDivElement;
    protected readonly _gridDiv: HTMLDivElement;

    constructor() {
        super();
        this.innerHTML = require("./sourceImages.editor.html").default;

        this._fileInput = this.querySelector("#sourceImagesFileInput") as HTMLInputElement;
        this._errorDiv = this.querySelector("#sourceImagesError") as HTMLDivElement;
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
        // A video has no still to display, the thumbnail route extracts a frame out of it
        const el = htmlStringToElement<HTMLDivElement>(`<div class="col-4 col-md-3 col-lg-2 mb-2">
                <div class="card">
                    <img class="card-img-top" src="/attachment/${sourceImage.attachmentId}/thumbnail" style="aspect-ratio: 1/1; object-fit: cover;" ref="thumbnail">
                    <div class="card-body p-1 text-center">
                        <small class="text-truncate d-block" ref="name"></small>
                        <button type="button" class="btn btn-sm btn-outline-danger w-100" ref="delete">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </div>
            </div>`)!;

        (el.querySelector("[ref='thumbnail']") as HTMLImageElement).alt = sourceImage.name;
        const name = el.querySelector("[ref='name']") as HTMLElement;
        name.textContent = sourceImage.name;
        name.title = sourceImage.name;
        if (sourceImage.type === PictureType.VIDEO) {
            name.prepend(htmlStringToElement(`<i class="bi bi-camera-video me-1"></i>`)!);
        }

        el.querySelector("[ref='delete']")?.addEventListener("click", async () => {
            const confirmed = await showConfirm({ title: "Delete source", message: `Delete "${sourceImage.name}"?` });
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
        this._setError(null);
        try {
            for (const file of Array.from(files)) {
                // A video is stored as it is : it cannot be downscaled in the browser, and a
                // workflow taking a video as an input expects the original file
                const isVideo = file.type.startsWith("video/");
                if (isVideo && file.size > MAX_VIDEO_BYTES) {
                    this._setError(`"${file.name}" is too large, videos are limited to ${Math.floor(MAX_VIDEO_BYTES / (1024 * 1024))} MB.`);
                    continue;
                }
                const type: PICTURE_TYPE = asNamed(isVideo ? PictureType.VIDEO : PictureType.IMAGE);
                const base64 = isVideo ? await readAsBase64(file) : await resizeImageToBase64(file);
                await StaticDataProvider.entitiesHandler.withTransaction((tr) => {
                    const attachment = tr.insert("attachments", {
                        id: asNamed(0),
                        type,
                        data: asNamed(base64)
                    });
                    tr.insert("sources", {
                        id: asNamed(0),
                        projectId,
                        attachmentId: attachment.id,
                        type,
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
            this._setError("Upload failed, see the console for details.");
        } finally {
            this._fileInput.value = "";
            this.refresh();
        }
    }

    protected _setError(message: string | null): void {
        this._errorDiv.textContent = message ?? "";
        this._errorDiv.classList.toggle("d-none", message == null);
    }
}

customElements.define("editor-source-images", SourceImagesEditor);
