import {
  ApplicationIntegrationType,
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";
import type { CommandData } from "../../types/commands.js";

const commandData: CommandData = {
  isGlobal: true,
  permissions: [],
  data: new SlashCommandBuilder()
    .setContexts([
      InteractionContextType.PrivateChannel,
      InteractionContextType.Guild,
      InteractionContextType.BotDM,
    ])
    .setIntegrationTypes([
      ApplicationIntegrationType.GuildInstall,
      ApplicationIntegrationType.UserInstall,
    ])
    .setName("ping")
    .setDescription("Estimates the latency between you and the BOT"),
  async execute(interaction) {
    const start = performance.now();
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const totalLatency = performance.now() - start;
    return interaction.editReply({
      content: `Total Latency: ${Math.ceil(
        totalLatency
      )}ms\nWebSocket Latency: ${Math.ceil(interaction.client.ws.ping)}ms`,
    });
  },
};

export default commandData;
