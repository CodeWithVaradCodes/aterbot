/**
 * Per-server runtime state shared between each bot instance and the web dashboard.
 * Each server gets its own BotState tracked by its label.
 */
import FS from 'node:fs';
import PATH from 'node:path';

export type BotStatus = "connecting" | "online" | "offline";

export type Stats = {
	/** Human-readable label for this server */
	label: string;
	/** Minecraft host this bot connects to */
	host: string;
	/** Minecraft port */
	port: number;
	/** Bot username */
	username: string;
	/** The most recent login (ms epoch), null while offline */
	thisSessionStart: number | null;
	/** Accumulated online ms across sessions since the process started */
	totalOnlineThisRun: number;
	/** How many times the bot successfully logged in during this process run */
	logins: number;
	/** How many times the bot was disconnected/reconnected */
	reconnects: number;
	/** When this process started */
	processStartedAt: number;
	/** Accumulated ms persisted from previous runs */
	totalOnlineFromPastRunsMs: number;
	lastLoginAt: number | null;
	lastLogoutAt: number | null;
	status: BotStatus;
};

export class BotState {
	private data: Stats;
	private dataFile: string;

	constructor(label: string, host: string, port: number, username: string) {
		// Each server gets its own persisted data file keyed by label slug
		const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
		this.dataFile = PATH.resolve(
			process.cwd(),
			process.env.DATA_DIR || ".data",
			`uptime-${slug}.json`
		);
		this.data = {
			label,
			host,
			port,
			username,
			thisSessionStart: null,
			totalOnlineThisRun: 0,
			logins: 0,
			reconnects: 0,
			processStartedAt: Date.now(),
			totalOnlineFromPastRunsMs: 0,
			lastLoginAt: null,
			lastLogoutAt: null,
			status: "connecting",
		};
		this.load();
	}

	private load(): void {
		try {
			if (FS.existsSync(this.dataFile)) {
				const raw = JSON.parse(FS.readFileSync(this.dataFile, "utf8"));
				this.data.totalOnlineFromPastRunsMs = +raw.totalOnlineFromPastRunsMs || 0;
			}
		} catch {
			/* ignore unreadable data; start fresh */
		}
	}

	private save(): void {
		try {
			FS.mkdirSync(PATH.dirname(this.dataFile), { recursive: true });
			FS.writeFileSync(this.dataFile, JSON.stringify({
				totalOnlineFromPastRunsMs: this.data.totalOnlineFromPastRunsMs
			}, null, "\t"));
		} catch {
			/* read-only filesystem; keep in memory */
		}
	}

	onLogin(): void {
		this.data.thisSessionStart = Date.now();
		this.data.lastLoginAt = Date.now();
		this.data.logins++;
		this.data.status = "online";
	}

	onLogout(): void {
		if (this.data.thisSessionStart) {
			this.data.totalOnlineThisRun += Date.now() - this.data.thisSessionStart;
			this.data.totalOnlineFromPastRunsMs = Math.round(
				(this.data.totalOnlineFromPastRunsMs + this.data.totalOnlineThisRun) / 60000
			) * 60000;
			this.save();
			this.data.totalOnlineThisRun = 0;
		}
		this.data.thisSessionStart = null;
		this.data.lastLogoutAt = Date.now();
		this.data.status = "offline";
	}

	setStatus(s: BotStatus): void {
		if (!this.data.thisSessionStart) this.data.status = s;
	}

	markReconnect(): void {
		this.data.reconnects++;
	}

	getStats(): Stats & { sessionOnlineMs: number; totalOnlineMs: number; processUptimeMs: number } {
		const sessionOnlineMs = this.data.thisSessionStart
			? this.data.totalOnlineThisRun + Date.now() - this.data.thisSessionStart
			: this.data.totalOnlineThisRun;
		return {
			...this.data,
			sessionOnlineMs,
			totalOnlineMs: this.data.totalOnlineFromPastRunsMs + sessionOnlineMs,
			processUptimeMs: Date.now() - this.data.processStartedAt,
		};
	}
}

/** Registry of all active bot states, keyed by label */
const registry = new Map<string, BotState>();

export const registerState = (state: BotState): void => {
	registry.set(state.getStats().label, state);
};

export const getAllStats = () =>
	Array.from(registry.values()).map(s => s.getStats());
