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
import type { CommandData } from "../../types/commands.js";
import type {
  SimplifiedSticker,
  StickerSearchOrder,
} from "../../types/stickers.js";
import { generateId } from "../../utils/misc.js";
import { getAssetUrl, getVariantUrl } from "../../utils/stickers.js";
import { GRID_PLACEHOLDER_IMG_PATH } from "../../utils/constants.js";
import { logger } from "../../logging/logger.js";
import { BaseButton, NavButtonRow } from "../../components/buttons.js";
import type { BoundDBFunctions } from "../../db/dbActions.js";

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
    ),
  async execute(db, interaction) {
    const query = interaction.options.getString("query") ?? undefined;
    const order = (interaction.options.getString("order") ??
      "usage.timeLastUsed") as StickerSearchOrder;
    const userId = interaction.user.id;
    const results = await db.search({
      query,
      userId,
      limit: 9,
      order,
    });
    const menu = buildMenu(
      query,
      results.stickers,
      0,
      results.totalResultCount
    );

    const response = await interaction.reply({
      components: [menu],
      withResponse: true,
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
    const message = response.resource?.message;

    if (!message) {
      logger.error({ response }, "message object missing");
      return interaction.reply({
        content: "Something went wrong...",
        flags: MessageFlags.Ephemeral,
      });
    }

    await handleMenuInteractions(
      db,
      interaction,
      message,
      userId,
      order,
      results.totalResultCount,
      query
    );
  },
};

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
      const button = new BaseButton(customId, ButtonStyle.Secondary, {
        label: stickerIndex + 1,
        disabled: donePlacing,
        // width: 60,
      });
      rowBuilder.addComponents(button);
    }
    rows.push(rowBuilder);
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
  if (galleryItems.length < 9) {
    const placeholderUrl = getAssetUrl(GRID_PLACEHOLDER_IMG_PATH);
    const placeholderItem = { media: { url: placeholderUrl } };
    const placeholders = Array(9 - galleryItems.length).fill(placeholderItem);
    galleryItems.push(...placeholders);
  }
  const gallery = new MediaGalleryBuilder().addItems(...galleryItems);
  const header = buildHeader(query, offset + stickers.length, resultCount);
  const stickerButtons = buildStickerButtons(stickers);
  const navButtons = new NavButtonRow(offset, 9, resultCount);
  const container = new ContainerBuilder()
    .addTextDisplayComponents(header)
    .addMediaGalleryComponents(gallery)
    .addActionRowComponents(stickerButtons)
    .addActionRowComponents(navButtons);

  return container;
}

async function onSendSticker(
  db: BoundDBFunctions,
  commandInteraction: ChatInputCommandInteraction<CacheType>,
  buttonInteraction: ButtonInteraction<CacheType>,
  stickerId: string,
  userId: string
) {
  const showInfo = commandInteraction.options.getBoolean("info");
  if (showInfo) {
    const sticker = await db.getStickerById(stickerId);
    await commandInteraction.editReply({
      components: [
        new TextDisplayBuilder({
          content: `**Title**: __${sticker?.title}__\n**Tags**: __${sticker?.tags}__`,
        }),
      ],
    });
  } else await commandInteraction.deleteReply();
  await buttonInteraction.reply(getVariantUrl(stickerId, "high"));
  await db.incrementStickerUsage(stickerId, userId);
}

async function onPaginate(
  db: BoundDBFunctions,
  interaction: ButtonInteraction<CacheType>,
  offset: number,
  userId: string,
  query?: string,
  order?: StickerSearchOrder
) {
  const results = await db.search({ query, userId, offset, limit: 9, order });
  const menu = buildMenu(
    query,
    results.stickers,
    offset,
    results.totalResultCount
  );

  return interaction.update({ components: [menu] });
}

function handleMenuInteractions(
  db: BoundDBFunctions,
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
    filter: (i) => i.user.id === interaction.user.id,
  });

  return new Promise<void>((resolve, reject) => {
    collector?.on("collect", async (i) => {
      const [type, value] = i.customId.split(":");

      switch (type) {
        case "sticker": {
          if (!value) {
            throw Error(`Malformed button customId: "${i.customId}"`);
          }
          await onSendSticker(db, interaction, i, value, userId);
          break;
        }
        case "offset": {
          await onPaginate(db, i, +value!, userId, query, order);
          break;
        }
        case "first": {
          await onPaginate(db, i, 0, userId, query, order);
          break;
        }
        case "last": {
          await onPaginate(
            db,
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
          await i.reply({
            content: "Something went wrong...",
            flags: MessageFlags.Ephemeral,
          });
        }
      }

      resolve();
    });
  });
}

export default commandData;
