import {
  ActionRowBuilder,
  ApplicationIntegrationType,
  ButtonBuilder,
  ButtonInteraction,
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
  getStickerById,
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
  )
  .addBooleanOption((opt) =>
    opt
      .setName("info")
      .setDescription("Display title and tags for the chosen sticker")
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
  }
  return rows;
}

function buildNavigationButtons(offset: number, resultCount: number) {
  const prevOffset = offset - 9;
  const isFirstPage = prevOffset < 0;
  const nextOffset = offset + 9;
  const isLastPage = nextOffset >= resultCount;
  const buttonWidth = 106;

  return [
    buildButton(
      "First Page",
      // Avoid duplicating customId
      "first",
      buttonWidth,
      ButtonStyle.Primary,
      isFirstPage
    ),
    buildButton(
      "Previous",
      "offset:" + prevOffset,
      buttonWidth,
      // 244,
      ButtonStyle.Primary,
      isFirstPage
    ),
    buildButton(
      "Next",
      "offset:" + nextOffset,
      buttonWidth,
      ButtonStyle.Primary,
      isLastPage
    ),
    buildButton(
      "Last Page",
      "last",
      buttonWidth,
      ButtonStyle.Primary,
      isLastPage
    ),
  ];
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

  container.addActionRowComponents((rowBuilder) =>
    rowBuilder.setComponents(buildNavigationButtons(offset, resultCount))
  );

  return container;
}

async function onSendSticker(
  commandInteraction: ChatInputCommandInteraction<CacheType>,
  buttonInteraction: ButtonInteraction<CacheType>,
  stickerId: string,
  userId: string
) {
  const showInfo = commandInteraction.options.getBoolean("info");
  if (showInfo) {
    const sticker = await getStickerById(stickerId);
    await commandInteraction.editReply({
      components: [
        new TextDisplayBuilder({
          content: `**Title**: __${sticker?.title}__\n**Tags**: __${sticker?.tags}__`,
        }),
      ],
    });
  } else await commandInteraction.deleteReply();
  await buttonInteraction.reply(getVariantUrl(stickerId, "high"));
  await incrementStickerUsage(stickerId, userId);
}

async function onPaginate(
  interaction: ButtonInteraction<CacheType>,
  offset: number,
  userId: string,
  query?: string,
  order?: StickerSearchOrder
) {
  const results = await search({ query, userId, offset, limit: 9, order });
  const menu = buildMenu(
    query,
    results.stickers,
    offset,
    results.totalResultCount
  );

  await interaction.update({ components: [menu] });
}

function handleMenuInteractions(
  interaction: ChatInputCommandInteraction<CacheType>,
  message: Message<boolean>,
  userId: string,
  order: StickerSearchOrder,
  resultCount: number,
  query?: string
) {
  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 15 * 60 * 1000,
  });

  collector?.on("collect", async (i) => {
    const [type, value] = i.customId.split(":");

    switch (type) {
      case "sticker": {
        if (!value) throw Error(`Malformed button customId: "${i.customId}"`);
        await onSendSticker(interaction, i, value, userId);
        break;
      }
      case "offset": {
        await onPaginate(i, +value!, userId, query, order);
        break;
      }
      case "first": {
        await onPaginate(i, 0, userId, query, order);
        break;
      }
      case "last": {
        await onPaginate(
          i,
          resultCount - (resultCount % 9 || 9),
          userId,
          query,
          order
        );
        break;
      }
      default: {
        // should never happen
        return i.reply({
          content: "Something went wrong...",
          flags: MessageFlags.Ephemeral,
        });
      }
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

  handleMenuInteractions(
    interaction,
    message,
    userId,
    order,
    results.totalResultCount,
    query
  );
};
