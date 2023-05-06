import JSZip from "jszip";
import { PictureDTO } from "./types";
import { AbstractDataWrapper } from "./data";

export async function zipPictures(params: {
    data: AbstractDataWrapper,
    projectId: number,
    filter?: (picture: PictureDTO) => boolean
}): Promise<JSZip> {
    const zip = new JSZip();

    const pictures = await params.data.getPictures(params.projectId);
    for (const picture of pictures) {
        if (!picture.attachmentId) {
            // No attachment, skip
            continue;
        }
        if (params.filter && !params.filter(picture)) {
            // Skip this picture
            continue;
        }

        // Gst the picture's prompt
        const prompt = await params.data.getPrompt(picture.promptId);
        let attachmentIndex = 0;

        // Get the attachment (picture data)
        const attachment = await params.data.getAttachment(picture.attachmentId);
        if (!attachment) {
            continue;
        }

        const baseFilename = `${prompt?.index ?? "xx"}-${picture.options.seed}-${attachmentIndex}`;
        attachmentIndex++;

        // Add prompt as txt to zip
        zip.file(`${baseFilename}.txt`, prompt.prompt, { binary: false /* text, not binary data */ });
        // Add picture as png to zip
        zip.file(`${baseFilename}.png`, attachment, { base64: true });
    }

    return zip;
}
