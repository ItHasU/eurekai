import { installPushWorker } from "@dagda/webworker/push/push.worker";

installPushWorker({
    title: "eurekAI",
    icon: "/assets/icon.png",
    requireInteraction: true
});
