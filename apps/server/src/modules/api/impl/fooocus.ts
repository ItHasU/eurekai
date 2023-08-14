import { SDModels } from "@eurekai/shared/src/data";
import { AbstractAPI } from "../abstract.api";
import { Txt2ImgOptions } from "@eurekai/shared/src/types";
import { client } from "@gradio/client";

export class Fooocus extends AbstractAPI {

    constructor(protected readonly apiURL: string) {
        super();
    }

    public override getModels(): Promise<SDModels[]> {
        return Promise.resolve<SDModels[]>([{
            title: "SDXL",
            config: "",
            filename: "",
            hash: "",
            model_name: "SDXL",
            sha256: "SDXL"
        }]);
    }

    public override getSelectedModel(): Promise<string | null> {
        return Promise.resolve("SDXL");
    }
    public override setSelectedModel(model: string): Promise<void> {
        return Promise.resolve();
    }

    public override async txt2img(options: Txt2ImgOptions): Promise<string[]> {
        const app = await client(this.apiURL);
        const result = await app.predict(2, [
            options.prompt, // string  in 'parameter_8' Textbox component		
            options.negative_prompt ?? "", // string  in 'Negative Prompt' Textbox component		
            "cinematic_default", // string  in 'parameter_22' Radio component		
            "Speed", // string  in 'Performance' Radio component		
            `${options.width}x${options.height}`, // string  in 'Aspect Ratios (width × height)' Radio component		
            1, // number (numeric value between 1 and 32) in 'Image Number' Slider component		
            options.seed, // number  in 'Random Seed' Number component		
            "sd_xl_base_1.0_0.9vae.safetensors", // string (Option from: ['sd_xl_base_1.0_0.9vae.safetensors', 'sd_xl_refiner_1.0_0.9vae.safetensors']) in 'SDXL Base Model' Dropdown component		
            "sd_xl_refiner_1.0_0.9vae.safetensors", // string (Option from: ['None', 'sd_xl_base_1.0_0.9vae.safetensors', 'sd_xl_refiner_1.0_0.9vae.safetensors']) in 'SDXL Refiner' Dropdown component		
            "None", // string (Option from: ['None', 'legominifig-v1.0-000003.safetensors', 'sd_xl_offset_example-lora_1.0.safetensors']) in 'SDXL LoRA 1' Dropdown component		
            -2, // number (numeric value between -2 and 2) in 'Weight' Slider component		
            "None", // string (Option from: ['None', 'legominifig-v1.0-000003.safetensors', 'sd_xl_offset_example-lora_1.0.safetensors']) in 'SDXL LoRA 2' Dropdown component		
            -2, // number (numeric value between -2 and 2) in 'Weight' Slider component		
            "None", // string (Option from: ['None', 'legominifig-v1.0-000003.safetensors', 'sd_xl_offset_example-lora_1.0.safetensors']) in 'SDXL LoRA 3' Dropdown component		
            -2, // number (numeric value between -2 and 2) in 'Weight' Slider component		
            "None", // string (Option from: ['None', 'legominifig-v1.0-000003.safetensors', 'sd_xl_offset_example-lora_1.0.safetensors']) in 'SDXL LoRA 4' Dropdown component		
            -2, // number (numeric value between -2 and 2) in 'Weight' Slider component		
            "None", // string (Option from: ['None', 'legominifig-v1.0-000003.safetensors', 'sd_xl_offset_example-lora_1.0.safetensors']) in 'SDXL LoRA 5' Dropdown component		
            -2, // number (numeric value between -2 and 2) in 'Weight' Slider component
        ]);

        console.log(result);
        return [];
    }
}