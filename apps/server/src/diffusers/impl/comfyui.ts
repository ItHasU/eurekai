import { asNamed } from "@dagda/shared/entities/named.types";
import { AppTypes } from "@eurekai/shared/src/entities";
import { ModelInfo } from "@eurekai/shared/src/models.api";
import { Prompt, QueuePromptResult, ResponseError } from 'comfy-ui-client';
import { fetch } from "undici";
import { WebSocket } from "ws";
import { AbstractDiffuser, ImageDescription } from "../diffuser";

type Workflow = { nodes: Prompt };

export class ComfyUI extends AbstractDiffuser {

    protected _clientId: string = "EurekAI";

    /** 
     * The websocket is stored here once connected.
     * On disconnection the value is reset to null.
     * 
     * Use @see _getWebsocket() to connect to the server.
     */
    protected _ws: Promise<WebSocket> | null = null;

    constructor(protected _url: string, protected _name: string, protected _workflow: string) {
        super();
    }

    /** @inheritdoc */
    public override getModelInfo(): ModelInfo {
        return {
            uid: `comfy.${this._name}`,
            displayName: `[Comfy] ${this._name}`,
            size: 1024
        };
    }

    //#region Image generation

    /** @inheritdoc */
    public override async txt2img(image: ImageDescription): Promise<{ data: AppTypes["BASE64_DATA"] }> {
        // -- Prepare the workflow --------------------------------------------
        const prompt = this._getWorkflowPrepared(image);
        const queueInfo = await this._queuePrompt(prompt);
        console.info(queueInfo);

        // // -- Get the websocket -----------------------------------------------
        // try {
        //     const ws = await this._getWebsocket();
        // }

        // // -- Run the workflow ------------------------------------------------
        // // Create client
        // const serverAddress = '192.168.42.20:8188';
        // const clientId = 'baadbabe-b00b-4206-9420-deadd00d1337';
        // const client = new ComfyUIClient(serverAddress, clientId);

        // // Connect to server
        // await client.connect();

        // // Generate images
        // const images = await client.getImages(workflow);

        // // Disconnect
        // await client.disconnect();
        // debugger;
        return { data: asNamed("") };
    }

    /** Replace values in the templates */
    protected _getWorkflowPrepared(image: ImageDescription): Prompt {
        let workflow: Prompt;
        try {
            let workflowStr = this._workflow;
            for (const [name, value] of Object.entries(image)) {
                if (typeof value === "number") {
                    workflowStr = workflowStr.replace(`"\${+${name}}"`, "" + value);
                } else if (typeof value === "string") {
                    workflowStr = workflowStr.replace(`\${${name}}`, value);
                } else {
                    console.warn(`Ignoring variable ${name} with value of type ${typeof value} (${JSON.stringify(value)})`);
                }
            }
            return JSON.parse(workflowStr) as Prompt;
        } catch (e) {
            console.error("Failed to prepare the workflow", e);
            throw e;
        }
    }

    /** 
     * (Re)connect to ComfyUI
     * @returns null if connection fails.
     */
    protected async _getWebsocket(): Promise<WebSocket> {
        if (this._ws != null) {
            // Already connected or connecting
            return this._ws;
        }

        this._ws = new Promise<WebSocket>(async (resolve) => {
            const url = `ws://${this._url}/ws?clientId=eurekai`;
            console.info(`Connecting to url: ${url}`);

            const ws = new WebSocket(url, {
                perMessageDeflate: false,
            });

            ws.on('open', () => {
                console.info('Connection opened');
                resolve(ws);
            });

            ws.on('close', () => {
                console.info('Connection closed');
                // Reset connection cache so it will be reopened on next call
                this._ws = null;
            });

            ws.on('error', (err) => {
                console.error({ err }, 'WebSockets error');
            });

            ws.on('message', (data, isBinary) => {
                if (isBinary) {
                    console.debug('Received binary data');
                } else {
                    console.debug('Received data: %s', data.toString());
                }
            });
        });
        return this._ws;
    }

    protected async _queuePrompt(prompt: Prompt): Promise<QueuePromptResult> {
        const res = await fetch(`http://${this._url}/prompt`, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                client_id: this._clientId,
                prompt
            })
        });

        if (!res.ok) {
            throw `${res.status} - ${res.statusText}`;
        } else {
            try {
                const json: QueuePromptResult | ResponseError = await res.json() as any;
                console.log(json);
                if ('error' in json) {
                    throw new Error(JSON.stringify(json));
                }

                return json;
            } catch (e) {
                console.error("Failed to queue prompt", e);
                throw e;
            }
        }
    }


    // protected async _getImage(): Promise<ImagesResponse[]> {
    //     const ws = await this._getWebsocket();

    //     if (!ws) {
    //         throw new Error(
    //             'WebSocket client is not connected. Please call connect() before interacting.',
    //         );
    //     }

    //     const queue = await this.queuePrompt(prompt);
    //     const promptId = queue.prompt_id;

    //     return new Promise<ImagesResponse>((resolve, reject) => {
    //         const outputImages: ImagesResponse = {};

    //         const onMessage = async (data: WebSocket.RawData, isBinary: boolean) => {
    //             // Previews are binary data
    //             if (isBinary) {
    //                 return;
    //             }

    //             try {
    //                 const message = JSON.parse(data.toString());
    //                 if (message.type === 'executing') {
    //                     const messageData = message.data;
    //                     if (!messageData.node) {
    //                         const donePromptId = messageData.prompt_id;

    //                         logger.info(`Done executing prompt (ID: ${donePromptId})`);

    //                         // Execution is done
    //                         if (messageData.prompt_id === promptId) {
    //                             // Get history
    //                             const historyRes = await this.getHistory(promptId);
    //                             const history = historyRes[promptId];

    //                             // Populate output images
    //                             for (const nodeId of Object.keys(history.outputs)) {
    //                                 const nodeOutput = history.outputs[nodeId];
    //                                 if (nodeOutput.images) {
    //                                     const imagesOutput: ImageContainer[] = [];
    //                                     for (const image of nodeOutput.images) {
    //                                         const blob = await this.getImage(
    //                                             image.filename,
    //                                             image.subfolder,
    //                                             image.type,
    //                                         );
    //                                         imagesOutput.push({
    //                                             blob,
    //                                             image,
    //                                         });
    //                                     }

    //                                     outputImages[nodeId] = imagesOutput;
    //                                 }
    //                             }

    //                             // Remove listener
    //                             this.ws?.off('message', onMessage);
    //                             return resolve(outputImages);
    //                         }
    //                     }
    //                 }
    //             } catch (err) {
    //                 return reject(err);
    //             }
    //         };

    //         // Add listener
    //         this.ws?.on('message', onMessage);
    //     });
    // }


    //#endregion

}
