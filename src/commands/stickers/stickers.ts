import {
  ActionRowBuilder,
  ApplicationIntegrationType,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  ComponentType,
  ContainerBuilder,
  Emoji,
  InteractionContextType,
  MediaGalleryBuilder,
  Message,
  MessageFlags,
  SlashCommandBuilder,
  TextDisplayBuilder,
  type CacheType,
} from "discord.js";
import type { CommandData } from "../../types/commands.js";
import { type Align, padStringToWidth } from "discord-button-width";
import type {
  SimplifiedSticker,
  StickerSearchOrder,
} from "../../types/stickers.js";
import {
  getStickerById,
  incrementStickerUsage,
  search,
} from "../../db/dbActions.js";
import { generateId } from "../../utils/misc.js";
import { getAssetUrl, getVariantUrl } from "../../utils/stickers.js";
import { GRID_PLACEHOLDER_IMG_PATH } from "../../utils/constants.js";
import { logger } from "../../logger.js";

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
  async execute(interaction) {
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

    handleMenuInteractions(
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

function buildButton(
  id: string,
  style: ButtonStyle,
  options: {
    label?: string | number;
    emoji?: string;
    width?: number;
    disabled?: boolean;
  } = {}
) {
  const defaults = { width: 0, disabled: false };
  const opts = { ...defaults, ...options };

  const button = new ButtonBuilder()
    // .setLabel(label.toString())
    .setCustomId(id)
    .setStyle(style)
    .setDisabled(opts.disabled);

  if (opts.label) {
    const label = opts.width
      ? "\u200b" +
        padStringToWidth(
          String(opts.label),
          // 162
          opts.width,
          "center" as Align
        ) +
        "\u200b"
      : String(opts.label);

    button.setLabel(label);
  }
  if (opts.emoji) {
    button.setEmoji(opts.emoji);
  }

  return button;
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
      const button = buildButton(customId, ButtonStyle.Secondary, {
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

function buildNavigationButtons(offset: number, resultCount: number) {
  const prevOffset = offset - 9;
  const isFirstPage = prevOffset < 0;
  const nextOffset = offset + 9;
  const isLastPage = nextOffset >= resultCount;

  return [
    buildButton(
      "first",
      ButtonStyle.Primary,
      {
        emoji: "⏪",
        disabled: isFirstPage,
      }
      // Avoid duplicating customId
    ),
    buildButton("offset:" + prevOffset, ButtonStyle.Primary, {
      emoji: "⬅️",
      disabled: isFirstPage,
    }),
    buildButton("offset:" + nextOffset, ButtonStyle.Primary, {
      emoji: "➡️",
      disabled: isLastPage,
    }),
    buildButton("last", ButtonStyle.Primary, {
      emoji: "⏩",
      disabled: isLastPage,
    }),
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
  if (galleryItems.length < 9) {
    const placeholderUrl = getAssetUrl(GRID_PLACEHOLDER_IMG_PATH);
    const placeholderItem = { media: { url: placeholderUrl } };
    const placeholders = Array(9 - galleryItems.length).fill(placeholderItem);
    galleryItems.push(...placeholders);
  }
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

    try {
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
          await i.reply({
            content: "Something went wrong...",
            flags: MessageFlags.Ephemeral,
          });
        }
      }
    } catch (error) {
      logger.error({ error, buttonInteraction: i, interaction });
    }
  });
}

export default commandData;
