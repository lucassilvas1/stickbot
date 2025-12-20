import { Client, Events } from "discord.js";
import { logger } from "../logger.js";

export const name = Events.ClientReady;

export const once = true;

export async function handle(client: Client<true>) {
  await client.application.fetch();
  logger.info({ tag: client.user.tag }, `BOT connected`);
}
