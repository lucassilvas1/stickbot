import {
  ActionRowBuilder,
  ApplicationIntegrationType,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  ComponentType,
  ContainerBuilder,
  InteractionContextType,
  MediaGalleryBuilder,
  Message,
  MessageFlags,
  SlashCommandBuilder,
  TextDisplayBuilder,
  type CacheType,
} from "discord.js";
import type { CommandExecutor } from "../../types/commands.js";
import { type Align, padStringToWidth } from "discord-button-width";
import {
  getUserPermissionsById,
  incrementStickerUsage,
  search,
} from "../../db/index.js";
import {
  Constants,
  generateId,
  getVariantUrl,
  isFromOwner,
} from "../../utils/index.js";
import type {
  SimplifiedSticker,
  StickerSearchOrder,
} from "../../types/stickers.js";

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
  .setName("liststickers")
  .setDescription("Browse through stickers")
  .addStringOption((opt) =>
    opt.setName("query").setDescription("Narrow down results")
  )
  .addStringOption((opt) =>
    opt
      .setName("order")
      .setDescription("What order to return the results in")
      .addChoices([
        { name: "Most Recent", value: "usage.timeLastUsed" },
        { name: "Most Used", value: "usage.count" },
      ])
  );

function buildHeader(
  query: string | undefined,
  totalShown: number,
  totalResultCount: number
) {
  let headerText = `### **Showing _${totalShown} of ${totalResultCount}_ `;
  if (query) headerText += `results for** "__${query}__":`;
  else headerText += "stickers**:";
  return new TextDisplayBuilder().setContent(headerText);
}

function buildButton(
  label: string | number,
  customId: string,
  width: number,
  style: ButtonStyle,
  disabled: boolean
) {
  const paddedLabel = padStringToWidth(
    String(label),
    // 162
    width,
    "center" as Align
  );

  return new ButtonBuilder()
    .setLabel("\u200b" + paddedLabel + "\u200b")
    .setCustomId(customId)
    .setStyle(style)
    .setDisabled(disabled);
}

function buildStickerButtons(stickers: SimplifiedSticker[]) {
  const rows = [];
  let donePlacing = false;

  for (let row = 0; row < 3; row++) {
    const rowBuilder = new ActionRowBuilder<ButtonBuilder>();
    for (let col = 1; col < 4; col++) {
      const stickerIndex = row * 3 + col - 1;
      if (stickerIndex === stickers.length) {
        donePlacing = true;
      }
      const customId =
        "sticker:" + (stickers[stickerIndex]?.id ?? generateId(4));
      const button = buildButton(
        stickerIndex + 1,
        customId,
        152,
        ButtonStyle.Secondary,
        donePlacing
      );
      rowBuilder.addComponents(button);
    }
    rows.push(rowBuilder);
    if (donePlacing) break;
  }
  return rows;
}

function buildMenu(
  query: string | undefined,
  stickers: SimplifiedSticker[],
  offset: number,
  resultCount: number
) {
  const galleryItems = stickers.map((s) => ({
    media: { url: getVariantUrl(s.id, "high") },
  }));
  const gallery = new MediaGalleryBuilder().addItems(...galleryItems);
  const header = buildHeader(query, offset + stickers.length, resultCount);
  const stickerButtons = buildStickerButtons(stickers);
  const container = new ContainerBuilder()
    .addTextDisplayComponents(header)
    .addMediaGalleryComponents(gallery)
    .addActionRowComponents(stickerButtons);

  const prevOffset = offset - stickers.length;
  const nextOffset = offset + stickers.length;
  container.addActionRowComponents((rowBuilder) =>
    rowBuilder.setComponents(
      buildButton(
        "Previous",
        "offset:" + prevOffset,
        244,
        ButtonStyle.Primary,
        prevOffset < 0
      ),
      buildButton(
        "Next",
        "offset:" + nextOffset,
        244,
        ButtonStyle.Primary,
        nextOffset >= resultCount
      )
    )
  );

  return container;
}

function handleMenuInteractions(
  interaction: ChatInputCommandInteraction<CacheType>,
  message: Message<boolean>,
  userId: string,
  order: StickerSearchOrder,
  query?: string
) {
  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 15 * 60 * 1000,
  });

  collector?.on("collect", async (i) => {
    const [type, value] = i.customId.split(":");

    if (type === "sticker") {
      if (!value) throw Error(`Malformed button customId: "${i.customId}"`);
      await interaction.deleteReply();
      await i.reply(getVariantUrl(value, "high"));
      await incrementStickerUsage(value, userId);
    } else if (type === "offset") {
      const offset = +value!;
      const results = await search({ query, userId, offset, limit: 9, order });
      const menu = buildMenu(
        query,
        results.stickers,
        offset,
        results.totalResultCount
      );

      i.update({ components: [menu] });
    } else {
      // should never happen
      return i.reply({
        content: "Something went wrong...",
        flags: MessageFlags.Ephemeral,
      });
    }
  });
}

export const execute: CommandExecutor = async (interaction) => {
  if (
    !isFromOwner(interaction) &&
    !(await getUserPermissionsById(interaction.user.id))
  ) {
    return interaction.reply({
      content: Constants.PERMISSION_PUNT_MESSAGE,
      flags: MessageFlags.Ephemeral,
    });
  }

  const query = interaction.options.getString("query") ?? undefined;
  const order = (interaction.options.getString("order") ??
    "usage.timeLastUsed") as StickerSearchOrder;
  const userId = interaction.user.id;
  const results = await search({
    query,
    userId,
    limit: 9,
    order,
  });
  const menu = buildMenu(query, results.stickers, 0, results.totalResultCount);

  const response = await interaction.reply({
    components: [menu],
    withResponse: true,
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
  });
  const message = response.resource?.message;

  if (!message) {
    return interaction.reply({
      content: "Something went wrong...",
      flags: MessageFlags.Ephemeral,
    });
  }

  handleMenuInteractions(interaction, message, userId, order, query);
};
