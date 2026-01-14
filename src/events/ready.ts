import { Client, Events } from "discord.js";
import { logger } from "../logging/logger.js";

export const name = Events.ClientReady;

export const once = true;

export async function handle(_: any, client: Client<true>) {
  await client.application.fetch();
  logger.info({ tag: client.user.tag }, `BOT connected`);
}
