import {
  ApplicationIntegrationType,
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";
import type {
  CommandAutocomplete,
  CommandExecutor,
} from "../../types/commands.js";
import {
  getStickerById,
  search,
  toAutocompleteType,
  updateSticker,
} from "../../db/index.js";
import type { SimplifiedSticker } from "../../types/stickers.js";
import { Constants, isFromAppUser, isUserAllowed } from "../../utils/index.js";

export const isGlobal = true;

export const data = new SlashCommandBuilder()
  .setContexts([
    InteractionContextType.PrivateChannel,
    InteractionContextType.Guild,
    InteractionContextType.BotDM,
  ])
  .setIntegrationTypes([
    ApplicationIntegrationType.GuildInstall,
    ApplicationIntegrationType.UserInstall,
  ])
  .setName("editsticker")
  .setDescription("Edit a sticker by title")
  .addStringOption((opt) =>
    opt
      .setName("query")
      .setDescription("Describe the sticker to get suggestions")
      .setRequired(true)
      .setAutocomplete(true)
  )
  .addStringOption((opt) =>
    opt
      .setName("title")
      .setDescription("Update sticker title or leave it as it is")
      .setMinLength(Constants.MIN_TITLE_LENGTH)
      .setMaxLength(Constants.MAX_TITLE_LENGTH)
      .setAutocomplete(true)
  )
  .addStringOption((opt) =>
    opt
      .setName("tags")
      .setDescription("Update sticker tags or leave them as they are")
      .setMinLength(Constants.MIN_TAGS_LENGTH)
      .setMaxLength(Constants.MAX_TAGS_LENGTH)
      .setAutocomplete(true)
  )
  .addStringOption((opt) =>
    opt
      .setName("description")
      .setDescription(
        "Update sticker description or leave it as it is (currently unused)"
      )
      .setMaxLength(Constants.MAX_DESCRIPTION_LENGTH)
  );

export const execute: CommandExecutor = async (interaction) => {
  if (!(await isUserAllowed("editSticker", interaction))) {
    return interaction.reply({
      content: Constants.PERMISSION_PUNT_MESSAGE,
      flags: MessageFlags.Ephemeral,
    });
  }

  const id = interaction.options.getString("query", true);
  const title = interaction.options.getString("title") ?? undefined;
  const tags = interaction.options.getString("tags") ?? undefined;
  const description = interaction.options.getString("description") ?? undefined;

  try {
    await updateSticker(id, { title, tags, description });
    return interaction.reply({
      content: "Changes were successfully saved",
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    console.error("Could not update sticker: ", error);
    return interaction.reply({
      content: "Something went wrong while saving changes...",
      flags: MessageFlags.Ephemeral,
    });
  }
};

export const autocomplete: CommandAutocomplete = async (interaction) => {
  if (!(await isFromAppUser(interaction))) return interaction.respond([]);

  const prop = interaction.options.getFocused(true);
  if (prop.name === "query") {
    return interaction.respond(
      toAutocompleteType(await search({ query: prop.value }))
    );
  }
  const id = interaction.options.getString("query", true);
  const sticker = await getStickerById(id);
  if (!sticker) {
    return interaction.respond([
      {
        name: "STICKER NOT FOUND! PICK A VALID STICKER FROM THE query SUGGESTION FIRST",
        value:
          "STICKER NOT FOUND! PICK A VALID STICKER FROM THE query SUGGESTION FIRST",
      },
    ]);
  }
  if (!prop.value.length) {
    // value can only be string because the only columns you can edit are text
    // (title, tags, description)
    const value = sticker[prop.name as keyof SimplifiedSticker] as string;
    return interaction.respond([{ name: value, value }]);
  }
  return interaction.respond([]);
};
