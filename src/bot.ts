import Mineflayer from 'mineflayer';
import { sleep, getRandom } from "./utils.ts";
import CONFIG from "../config.json" with { type: 'json' };
import { BotState } from "./state.ts";

export type ServerConfig = {
	label: string;
	host: string;
	port: number;
	username: string;
	version: string;
};

/**
 * Spawns and manages a single AFK bot for one server.
 * Call this once per server entry — all calls run concurrently.
 */
export const startBot = (server: ServerConfig, state: BotState): void => {
	let loop: NodeJS.Timeout;
	let bot: Mineflayer.Bot;

	const version = server.version && server.version !== "auto" ? server.version : undefined;

	const tag = `[${server.label}]`;

	const disconnect = (): void => {
		clearInterval(loop);
		bot?.quit?.();
		bot?.end?.();
	};

	const reconnect = async (): Promise<void> => {
		console.log(`${tag} Reconnecting in ${CONFIG.action.retryDelay / 1000}s...\n`);
		state.onLogout();
		state.markReconnect();
		state.setStatus("connecting");
		clearInterval(loop);
		await sleep(CONFIG.action.retryDelay);
		createBot();
	};

	const createBot = (): void => {
		bot = Mineflayer.createBot({
			host: server.host,
			port: server.port,
			username: server.username,
			...(version ? { version } : {})
		} as const);

		bot.once('error', error => {
			console.error(`${tag} Error: ${error}`);
		});

		bot.once('kicked', rawResponse => {
			console.error(`${tag} Kicked: ${typeof rawResponse === "string" ? rawResponse : JSON.stringify(rawResponse, null, 2)}`);
		});

		bot.once('end', () => void reconnect());

		bot.once('spawn', () => {
			state.onLogin();
			console.log(`${tag} Spawned on ${server.host}:${server.port} — uptime counting.\n`);

			const changePos = async (): Promise<void> => {
				const lastAction = getRandom(CONFIG.action.commands) as Mineflayer.ControlState;
				console.debug(`${tag} ${lastAction}`);
				bot.setControlState('sprint', false);
				bot.setControlState(lastAction, true);
				await sleep(2000);
				bot.clearControlStates();
				await sleep(Math.max(1000, CONFIG.action.holdDuration - 2000));
			};

			const changeView = async (): Promise<void> => {
				const yaw = (Math.random() * Math.PI) - (0.5 * Math.PI),
					pitch = (Math.random() * Math.PI) - (0.5 * Math.PI);
				await bot.look(yaw, pitch, false);
			};

			loop = setInterval(() => {
				changeView();
				changePos();
			}, CONFIG.action.holdDuration);
		});

		bot.once('login', () => {
			console.log(`${tag} Logged in as ${bot.username}\n`);
		});
	};

	state.setStatus("connecting");
	createBot();
};
