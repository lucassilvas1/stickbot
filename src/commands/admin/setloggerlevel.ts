import { MessageFlags, SlashCommandBuilder } from "discord.js";
import type { CommandData } from "../../types/commands.js";
import { logLevelParser, logLevels } from "../../types/misc.js";
import { logger, setLogLevel } from "../../logging/logger.js";

const commandData: CommandData = {
  isGlobal: false,
  permissions: "special",
  data: new SlashCommandBuilder()
    .setName("setloggerlevel")
    .setDescription("Set level of logger at runtime")
    .addStringOption((opt) =>
      opt
        .setName("level")
        .setDescription("Level to set logger to")
        .addChoices(
          logLevels.map((l) => ({
            name: l[0]?.toUpperCase() + l.slice(1),
            value: l,
          }))
        )
        .setRequired(true)
    ),
  async execute(interaction) {
    const rawLevel = interaction.options.getString("level", true);
    const info = { level: rawLevel, user: interaction.user.id };
    const { data: level } = logLevelParser.safeParse(rawLevel);
    if (!level) {
      logger.debug(info, "tried to set invalid logger level");
      return interaction.reply({
        content: `"${rawLevel}" is not a valid logger level!`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const oldLevel = logger.level;
    setLogLevel(level);
    logger.info({ ...info, oldLevel }, "changed logger level");
    return interaction.reply({
      content: `Logger level has been changed from "${oldLevel}" to "${level}"`,
      flags: MessageFlags.Ephemeral,
    });
  },
};

export default commandData;
