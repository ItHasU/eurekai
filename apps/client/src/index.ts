import "bootstrap/dist/css/bootstrap.css";
import "bootstrap/dist/js/bootstrap.js";
import "bootstrap-icons/font/bootstrap-icons.css";

import { ClientPromptManager } from "./managers/client.prompt.manager";
import { ClientPictureManager } from "./managers/client.picture.manager";

class App {
    
    protected readonly _promptsTab: ClientPromptManager = new ClientPromptManager();
    protected readonly _picturesTab: ClientPictureManager = new ClientPictureManager();

    constructor() {
    }

}

const APP: App = new App();
