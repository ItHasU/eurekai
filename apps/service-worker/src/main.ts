import { PushHelper } from "@dagda/webworker/src/push/push.helper";

const pushHelper: PushHelper = new PushHelper("eurekAI", { icon: "/assets/icon.png", silent: false });

self.addEventListener('activate', (event) => {
    pushHelper.subscribe().then(() => console.log("Registered for push notification")).catch(e => console.error(e));
});
