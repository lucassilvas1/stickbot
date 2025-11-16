import {
  ApplicationIntegrationType,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  InteractionContextType,
  MediaGalleryBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";
import type { CommandExecutor } from "../../types/commands.js";
import { type Align, padStringToWidth } from "discord-button-width";
import { getUserPermissionsById } from "../../db/index.js";
import { Constants } from "../../utils/index.js";

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
  );

export const execute: CommandExecutor = async (interaction) => {
  if (!(await getUserPermissionsById(interaction.user.id))) {
    return interaction.reply({
      content: Constants.PERMISSION_PUNT_MESSAGE,
      flags: MessageFlags.Ephemeral,
    });
  }

  const _placeholderImgUrl =
    "https://media.discordapp.net/attachments/1436806338465235136/1437233183933464596/image.png?ex=69127f35&is=69112db5&hm=8263589e0c7e64d116ab19ce5b5fd0e069cc1072f54466d6f2b2e66e1aabb04e&=&format=webp&quality=lossless&width=599&height=266";

  const results = new MediaGalleryBuilder().addItems(
    (item) => item.setURL(_placeholderImgUrl),
    (item) => item.setURL(_placeholderImgUrl),
    (item) => item.setURL(_placeholderImgUrl),
    (item) => item.setURL(_placeholderImgUrl),
    (item) => item.setURL(_placeholderImgUrl),
    (item) => item.setURL(_placeholderImgUrl),
    (item) => item.setURL(_placeholderImgUrl),
    (item) => item.setURL("https://c.tenor.com/wLAAxdmOk1YAAAAC/tenor.gif"),
    (item) => item.setDescription("foo bar baz").setURL(_placeholderImgUrl)
  );

  const container = new ContainerBuilder().addMediaGalleryComponents(results);

  for (let row = 0; row < 3; row++) {
    container.addActionRowComponents((rowBuilder) => {
      for (let col = 1; col < 4; col++) {
        const label = padStringToWidth(
          String(col + row * 3),
          // 162
          152,
          "center" as Align
        );
        rowBuilder.addComponents(
          new ButtonBuilder()
            .setLabel("\u200b" + label + "\u200b")
            .setCustomId("pick_" + label)
            .setStyle(ButtonStyle.Secondary)
        );
      }
      return rowBuilder;
    });
  }

  container.addActionRowComponents((rowBuilder) =>
    rowBuilder.setComponents(
      new ButtonBuilder()
        .setLabel(
          "\u200b" +
            // 255
            padStringToWidth("Previous", 244, "center" as Align) +
            "\u200b"
        )
        .setCustomId("previous_stickers")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setLabel(
          "\u200b" + padStringToWidth("Next", 244, "center" as Align) + "\u200b"
        )
        .setCustomId("next_stickers")
        .setStyle(ButtonStyle.Primary)
    )
  );

  interaction.reply({
    components: [container],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
  });
};
