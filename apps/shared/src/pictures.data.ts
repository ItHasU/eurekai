import { SQLHandler } from "@dagda/shared/sql/handler";
import { SQLTransaction } from "@dagda/shared/sql/transaction";
import { BooleanEnum, ComputationStatus, Filters, PictureDTO, PromptDTO, Tables } from "./types";

/** Whenever necessary, will generate new pending pictures for the prompt */
export function generateNextPicturesIfNeeded(handler: SQLHandler<Tables, Filters>, tr: SQLTransaction<Tables>, prompt: PromptDTO): void {
    if (prompt.active === BooleanEnum.FALSE) {
        return;
    }

    // -- Count images pending --
    const pendingImages: PictureDTO[] = [];
    for (const picture of handler.getItems("pictures")) {
        if (picture.promptId === prompt.id && picture.status <= ComputationStatus.PENDING) {
            pendingImages.push(picture);
        }
    }

    // -- Create new pictures --
    while (pendingImages.length < prompt.bufferSize) {
        const newPicture: PictureDTO = {
            id: 0,
            promptId: prompt.id,
            seed: Math.floor(Math.random() * Number.MAX_SAFE_INTEGER),
            status: ComputationStatus.PENDING,
            highresStatus: ComputationStatus.NONE
        };
        tr.insert("pictures", newPicture);
        pendingImages.push(newPicture);
    }

}