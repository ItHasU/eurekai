/// <reference lib="WebWorker" />
// export empty type because of tsc --isolatedModules flag
export type { };
declare const self: ServiceWorkerGlobalScope;

console.log("Hello world!");

self.addEventListener('install', (event) => {
    console.log("Client required install of the service worker");
});

self.addEventListener('activate', (event) => {
    console.log("Service worker is now activated");
});

self.addEventListener("push", (event) => {
    console.log("received a push", event.data);
})

var i = 0;
setInterval(() => {
    console.log(i++);
}, 2000)

// self.addEventListener('fetch', (event) => {
//     event.respondWith(
//         cacheFirst({
//             request: event.request,
//             preloadResponsePromise: event.preloadResponse,
//             fallbackUrl: './gallery/myLittleVader.jpg',
//         })
//     );
// });