import { apiCall } from "@dagda/client/api";
import { COMFY_URL, ComfyAPI, ComfyHostStatus, ComfyLogEntry } from "@eurekai/shared/src/comfy.api";
import { formatDuration } from "src/components/tools";
import { AbstractPageElement } from "./abstract.page.element";

/** Delay between two refreshes of the page */
const POLLING_MS = 1000;
/** Number of log lines kept in the page */
const MAX_LOG_LINES = 300;

/**
 * Administration page displaying the live state of the ComfyUI servers and their log.
 *
 * The data is polled while the page is displayed, on purpose : the notification websocket is a
 * broadcast to every client, it would be rude to push a log there for a page only one person has
 * open.
 */
export class ComfyPage extends AbstractPageElement {

    protected readonly _hostsDiv: HTMLDivElement;
    protected readonly _logDiv: HTMLDivElement;
    protected readonly _logPre: HTMLPreElement;

    /** One card per host, kept between refreshes so the page does not flicker every second */
    protected readonly _cards: Map<string, HostCard> = new Map();

    /** Id of the last log entry received, used as a cursor to only fetch the new ones */
    protected _lastLogId: number = 0;

    protected _timer: number | null = null;

    constructor() {
        super(require("./comfy.page.html").default);

        this._hostsDiv = this.querySelector("#hostsDiv") as HTMLDivElement;
        this._logDiv = this.querySelector("#logDiv") as HTMLDivElement;
        this._logPre = this.querySelector("#logPre") as HTMLPreElement;
    }

    /** @inheritdoc */
    public override connectedCallback(): void {
        super.connectedCallback();
        this._scheduleNextRefresh();
    }

    /** Called when the page is replaced by another one, App.setPage() empties the page div */
    public disconnectedCallback(): void {
        if (this._timer != null) {
            window.clearTimeout(this._timer);
            this._timer = null;
        }
    }

    /**
     * Re-arm the polling once the previous refresh is over.
     * A setInterval would stack the calls if the server answers slowly, and two overlapping
     * refreshes would fight over the log cursor and lose lines.
     */
    protected _scheduleNextRefresh(): void {
        this._timer = window.setTimeout(async () => {
            this._timer = null;
            try {
                await this._refresh();
            } catch (e) {
                // The server may be restarting, keep polling
                console.error(e);
            }
            if (this.isConnected) {
                this._scheduleNextRefresh();
            }
        }, POLLING_MS);
    }

    /** @inheritdoc */
    protected override async _refresh(): Promise<void> {
        const status = await apiCall<ComfyAPI, "getStatus">(COMFY_URL, "getStatus", this._lastLogId);

        this._refreshHosts(status.hosts);
        this._appendLogs(status.logs);
        this._lastLogId = status.lastLogId;
    }

    protected _refreshHosts(hosts: ComfyHostStatus[]): void {
        if (hosts.length === 0) {
            return;
        }
        // The placeholder is only there until we know there is at least one host.
        // It is removed by id : the cards themselves hold .text-secondary labels, looking the
        // placeholder up by class would wipe them on every refresh.
        this._hostsDiv.querySelector("#noHostDiv")?.remove();

        for (const host of hosts) {
            let card = this._cards.get(host.host);
            if (card == null) {
                card = new HostCard();
                this._cards.set(host.host, card);
                this._hostsDiv.appendChild(card.element);
            }
            card.update(host);
        }
    }

    protected _appendLogs(logs: ComfyLogEntry[]): void {
        if (logs.length === 0) {
            return;
        }

        // Only scroll down if the user was already at the bottom, otherwise reading the log
        // while something is running would be impossible
        const wasAtBottom = this._logDiv.scrollTop + this._logDiv.clientHeight >= this._logDiv.scrollHeight - 4;

        for (const entry of logs) {
            const line = document.createElement("div");
            line.classList.add(entry.level === "error" ? "text-danger" : "text-secondary");
            line.innerText = `${new Date(entry.time).toLocaleTimeString()} ${entry.message}`;
            this._logPre.appendChild(line);
        }
        while (this._logPre.childElementCount > MAX_LOG_LINES) {
            this._logPre.removeChild(this._logPre.children[0]);
        }

        if (wasAtBottom) {
            this._logDiv.scrollTop = this._logDiv.scrollHeight;
        }
    }
}

/** The card displaying the state of one host. Its DOM is built once and then updated in place. */
class HostCard {

    public readonly element: HTMLDivElement;

    protected readonly _host: HTMLElement;
    protected readonly _connected: HTMLElement;
    protected readonly _queue: HTMLElement;
    protected readonly _picture: HTMLElement;
    protected readonly _elapsed: HTMLElement;
    protected readonly _node: HTMLElement;
    protected readonly _progressBar: HTMLElement;
    protected readonly _progressBarLabel: HTMLElement;
    /** Free-form text reported by nodes that can't give a numeric step (a remote API node, typically) */
    protected readonly _progressTextLine: HTMLElement;

    constructor() {
        this.element = document.createElement("div");
        this.element.classList.add("card", "mb-2");
        this.element.innerHTML = `
            <div class="card-body">
                <h5 class="card-title d-flex justify-content-between align-items-center">
                    <span ref="host"></span>
                    <span ref="connected" class="badge"></span>
                </h5>
                <div class="row">
                    <div class="col-md"><small class="text-secondary">Queue</small><div ref="queue">-</div></div>
                    <div class="col-md"><small class="text-secondary">Picture</small><div ref="picture">-</div></div>
                    <div class="col-md"><small class="text-secondary">Elapsed</small><div ref="elapsed">-</div></div>
                    <div class="col-md"><small class="text-secondary">Node</small><div ref="node">-</div></div>
                </div>
                <div class="progress mt-2" role="progressbar">
                    <div ref="progressBar" class="progress-bar" style="width: 0%;"><span ref="progressBarLabel"></span></div>
                </div>
                <div ref="progressTextLine" class="small text-secondary mt-1"></div>
            </div>`;

        const get = (ref: string): HTMLElement => this.element.querySelector(`*[ref="${ref}"]`) as HTMLElement;
        this._host = get("host");
        this._connected = get("connected");
        this._queue = get("queue");
        this._picture = get("picture");
        this._elapsed = get("elapsed");
        this._node = get("node");
        this._progressBar = get("progressBar");
        this._progressBarLabel = get("progressBarLabel");
        this._progressTextLine = get("progressTextLine");
    }

    public update(status: ComfyHostStatus): void {
        this._host.innerText = status.host;

        this._connected.innerText = status.connected ? "connected" : "disconnected";
        this._connected.classList.toggle("text-bg-success", status.connected);
        this._connected.classList.toggle("text-bg-secondary", !status.connected);

        this._queue.innerText = status.queueRemaining == null ? "-" : `${status.queueRemaining} prompt(s)`;

        this._picture.innerText = status.pictureId == null
            ? (status.promptId == null ? "-" : status.promptId)
            : `#${status.pictureId}${status.model == null ? "" : ` (${status.model})`}`;

        // Computed here rather than server side, so it keeps ticking between two polls
        this._elapsed.innerText = status.startedAt == null ? "-" : formatDuration(Date.now() - status.startedAt);

        this._node.innerText = status.nodeId == null ? "-" : status.nodeId;

        // Numeric progress (sampling steps, typically) drives the bar itself
        const percent = status.progress == null || status.progress.max <= 0
            ? 0
            : Math.round(100 * status.progress.value / status.progress.max);
        this._progressBar.style.width = `${percent}%`;
        this._progressBar.classList.toggle("progress-bar-striped", status.progress == null && status.progressText != null);
        this._progressBar.classList.toggle("progress-bar-animated", status.progress == null && status.progressText != null);
        this._progressBarLabel.innerText = status.progress == null ? "" : `${status.progress.value} / ${status.progress.max}`;

        // Free-form progress (a remote API node reporting its own status text, e.g. Minimax)
        this._progressTextLine.innerText = status.progressText ?? "";
    }
}

customElements.define("comfy-page", ComfyPage);
