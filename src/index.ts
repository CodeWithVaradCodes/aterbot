import CONFIG from "../config.json" with { type: 'json' };
import { startBot } from "./bot.ts";
import { BotState, registerState } from "./state.ts";
import initWeb from "./web.ts";

// Launch one bot per server entry — all run simultaneously
for (const server of CONFIG.servers) {
	const state = new BotState(server.label, server.host, server.port, server.username);
	registerState(state);
	startBot(server, state);
}

initWeb();

// Graceful quit — drop all MC connections cleanly
for (const signal of ["SIGTERM", "SIGINT"] as const) {
	process.on(signal, () => {
		console.log(`Received ${signal} — disconnecting all AFK bots...`);
		process.exit(0);
	});
}
