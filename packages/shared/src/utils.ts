import JSZip from "jszip";
import { PicturesWrapper } from "./pictures.wrapper";
import { PromptsWrapper } from "./prompts.wrapper";
import { PictureDTO } from "./types";

export async function zipPictures(data: {
    pictures: PicturesWrapper,
    prompts: PromptsWrapper,
    filter?: (picture: PictureDTO) => boolean
}): Promise<JSZip> {
    const zip = new JSZip();

    const pictures = await data.pictures.getAll({ attachments: true });
    for (const picture of pictures) {
        if (data.filter && !data.filter(picture)) {
            // Skip this picture
            continue;
        }

        const prompt = await data.prompts.getById(picture.promptId);
        let attachmentIndex = 0;
        for (const attachmentUID in picture._attachments) {
            const attachment = picture._attachments[attachmentUID];
            if (!attachment) {
                continue;
            }
            const baseFilename = `${prompt?.index ?? "xx"}-${picture.options.seed}-${attachmentIndex}`;
            attachmentIndex++;
            if (prompt) {
                zip.file(`${baseFilename}.txt`, prompt.prompt, { binary: false /* text, not binary data */ });
            }

            zip.file(`${baseFilename}.png`, attachment.data, { base64: true });
        }
    }

    return zip;
}