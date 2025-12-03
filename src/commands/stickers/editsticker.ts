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
import type { SimplifiedSticker } from "../../types/stickers.js";
import { getStickerById, search, updateSticker } from "../../db/dbActions.js";
import {
  MAX_DESCRIPTION_LENGTH,
  MAX_TAGS_LENGTH,
  MAX_TITLE_LENGTH,
  MIN_TAGS_LENGTH,
  MIN_TITLE_LENGTH,
  PERMISSION_PUNT_MESSAGE,
} from "../../utils/constants.js";
import { isFromAppUser, isUploader, isUserAllowed } from "../../utils/users.js";
import { toAutocompleteType } from "../../utils/stickers.js";
import { invalidCharGuard } from "../../utils/middleware.js";

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
      .setMinLength(MIN_TITLE_LENGTH)
      .setMaxLength(MAX_TITLE_LENGTH)
      .setAutocomplete(true)
  )
  .addStringOption((opt) =>
    opt
      .setName("tags")
      .setDescription("Update sticker tags or leave them as they are")
      .setMinLength(MIN_TAGS_LENGTH)
      .setMaxLength(MAX_TAGS_LENGTH)
      .setAutocomplete(true)
  )
  .addStringOption((opt) =>
    opt
      .setName("description")
      .setDescription(
        "Update sticker description or leave it as it is (currently unused)"
      )
      .setMaxLength(MAX_DESCRIPTION_LENGTH)
  );

export const execute: CommandExecutor = async (interaction) => {
  const id = interaction.options.getString("query", true);

  if (
    !(await isUserAllowed("editSticker", interaction)) &&
    !(await isUploader(interaction.user.id, id))
  ) {
    return interaction.reply({
      content: PERMISSION_PUNT_MESSAGE,
      flags: MessageFlags.Ephemeral,
    });
  }

  const isValidInput = await invalidCharGuard(interaction);
  if (!isValidInput) return;

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
    const { stickers } = await search({ query: prop.value });
    return interaction.respond(toAutocompleteType(stickers));
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
