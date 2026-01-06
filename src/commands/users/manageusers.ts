import {
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  ComponentType,
  ContainerBuilder,
  LabelBuilder,
  Message,
  MessageComponentInteraction,
  MessageFlags,
  ModalBuilder,
  ModalSubmitInteraction,
  SectionBuilder,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextDisplayBuilder,
  TextInputBuilder,
  TextInputStyle,
  type CacheType,
  type ModalMessageModalSubmitInteraction,
} from "discord.js";
import type { CommandData } from "../../types/commands.js";
import type { Permissions, UserPermissions } from "../../types/db.js";
import { BaseButton, NavButtonRow } from "../../components/buttons.js";
import {
  deleteUserPermissions,
  getUserPermissionsById,
  getUsers,
  updatedUserPermissions,
} from "../../db/dbActions.js";
import { logger } from "../../logger.js";
import {
  GENERIC_ERROR_MESSAGE,
  MAX_USERNAME_LENGTH,
  MIN_USERNAME_LENGTH,
} from "../../utils/constants.js";
import {
  isValidPermissionArray,
  permissionArrayToObj,
} from "../../utils/users.js";
import { invalidCharGuard } from "../../utils/middleware.js";
import { type Align, padStringToWidth } from "discord-button-width";

const USER_PER_PAGE_LIMIT = 10;
const MAX_INTERACTION_AGE_MS = 15 * 60 * 1000;
const DELETE_CONFIRMATION_TEXT = "DELETE";

const commandData: CommandData = {
  isGlobal: false,
  permissions: ["addUser", "editUser", "deleteUser"],
  data: new SlashCommandBuilder()
    .setName("manageusers")
    .setDescription("Manage users and their permissions"),
  async execute(interaction) {
    const results = await getUsers(0, USER_PER_PAGE_LIMIT);
    const menu = buildMenu(results.users, 0, results.totalResultCount);

    const response = await interaction.reply({
      components: [menu],
      withResponse: true,
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
    const message = response.resource?.message;

    if (!message) {
      logger.error({ response }, "message object missing");
      return interaction.reply({
        content: GENERIC_ERROR_MESSAGE,
        flags: MessageFlags.Ephemeral,
      });
    }

    await handleMenuInteractions(
      interaction,
      message,
      results.totalResultCount
    );
  },
};

async function onPaginate(
  interaction: MessageComponentInteraction | ModalMessageModalSubmitInteraction,
  offset: number
) {
  let results = await getUsers(offset, USER_PER_PAGE_LIMIT);
  // Probably means users were deleted after menu was sent, try previous page
  if (offset && !results.users.length) {
    const newOffset = Math.max(0, offset - USER_PER_PAGE_LIMIT);
    results = await getUsers(newOffset, USER_PER_PAGE_LIMIT);
  }

  const menu = buildMenu(results.users, offset, results.totalResultCount);

  await interaction.update({ components: [menu] });
}

function buildEditModal(user: UserPermissions) {
  const usernameInput = new TextInputBuilder()
    .setCustomId("username")
    .setValue(user.username)
    .setRequired(true)
    .setStyle(TextInputStyle.Short)
    .setMinLength(MIN_USERNAME_LENGTH)
    .setMaxLength(MAX_USERNAME_LENGTH);
  const usernameLabel = new LabelBuilder()
    .setLabel("Username")
    .setDescription(
      "Does not need to match their display name. Only letters, numbers and spaces allowed!"
    )
    .setTextInputComponent(usernameInput);

  const permissionsSelect = new StringSelectMenuBuilder()
    .setCustomId("permissions")
    .setPlaceholder("No permissions selected")
    .setMinValues(0)
    .setMaxValues(6)
    .setRequired(false)
    .setOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel("Add Stickers")
        .setValue("addSticker")
        .setDefault(!!user.addSticker),
      new StringSelectMenuOptionBuilder()
        .setLabel("Edit Stickers")
        .setValue("editSticker")
        .setDefault(!!user.editSticker),
      new StringSelectMenuOptionBuilder()
        .setLabel("Delete Stickers")
        .setValue("deleteSticker")
        .setDefault(!!user.deleteSticker),
      new StringSelectMenuOptionBuilder()
        .setLabel("Add Users")
        .setValue("addUser")
        .setDefault(!!user.addUser),
      new StringSelectMenuOptionBuilder()
        .setLabel("Edit Users")
        .setValue("editUser")
        .setDefault(!!user.editUser),
      new StringSelectMenuOptionBuilder()
        .setLabel("Delete Users")
        .setValue("deleteUser")
        .setDefault(!!user.deleteUser)
    );
  const permissionsLabel = new LabelBuilder()
    .setLabel("Permissions")
    .setDescription("Select the permissions for this user.")
    .setStringSelectMenuComponent(permissionsSelect);

  const deleteInput = new TextInputBuilder()
    .setCustomId("delete")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder(`Type ${DELETE_CONFIRMATION_TEXT} to confirm`)
    .setValue("")
    .setRequired(false);
  const deleteLabel = new LabelBuilder()
    .setLabel("Delete User")
    .setDescription(
      `To delete this user, type ${DELETE_CONFIRMATION_TEXT} below. This action is irreversible!`
    )
    .setTextInputComponent(deleteInput);

  const expirationTimeSecs = Math.floor(
    (Date.now() + MAX_INTERACTION_AGE_MS) / 1000
  );
  const expirationDisclaimer = new TextDisplayBuilder().setContent(
    `_This modal will expire at:_ <t:${expirationTimeSecs}:t>`
  );

  return new ModalBuilder()
    .setTitle("Edit User Permissions")
    .setCustomId("edit:" + user.id)
    .setLabelComponents(usernameLabel, permissionsLabel, deleteLabel)
    .addTextDisplayComponents(expirationDisclaimer);
}

function buildHeader(totalShown: number, totalResultCount: number) {
  return new TextDisplayBuilder().setContent(
    `### Showing _${totalShown} of ${totalResultCount}_ users:`
  );
}

function truncateUserId(id: string) {
  return id.slice(0, 3) + ".." + id.slice(-3);
}

function buildPermissionString(permissions: Permissions) {
  const permissionMap: Record<keyof Permissions, string> = {
    addSticker: "A",
    editSticker: "E",
    deleteSticker: "D",
    addUser: "A",
    editUser: "E",
    deleteUser: "D",
  };

  return (
    Object.entries(permissionMap)
      .map(([key, value]) =>
        permissions[key as keyof Permissions] ? `**${value}**` : value
      )
      .join("")
      // Bolding individual characters breaks Discord markdown
      .replace(/(\*{4})/g, "")
  );
}

function buildUserSection(user: UserPermissions) {
  const permissionString = buildPermissionString(user);
  const paddedUsername =
    "\u200b" + padStringToWidth(user.username, 160, "left" as Align) + "\u200b";
  const paddedId =
    "\u200b" +
    padStringToWidth(`_(${truncateUserId(user.id)})_`, 90, "left" as Align) +
    "\u200b";

  return new SectionBuilder()
    .addTextDisplayComponents((tb) =>
      tb.setContent(`${paddedUsername} ${paddedId} [${permissionString}]`)
    )
    .setButtonAccessory(
      new BaseButton("edit:" + user.id, ButtonStyle.Secondary, {
        label: "Edit",
      })
    );
}

function buildMenu(
  users: UserPermissions[],
  offset: number,
  resultCount: number
) {
  const container = new ContainerBuilder();

  if (!users.length) {
    const emptyStateText = new TextDisplayBuilder().setContent(
      "_You have no users yet._"
    );
    container.addTextDisplayComponents(emptyStateText);
    return container;
  }

  const header = buildHeader(offset + users.length, resultCount);
  const userSections = users.map(buildUserSection);
  const navButtons = new NavButtonRow(offset, USER_PER_PAGE_LIMIT, resultCount);

  container
    .setAccentColor(0xff0000)
    .addTextDisplayComponents(header)
    .addSectionComponents(userSections)
    .addActionRowComponents(navButtons);

  return container;
}

async function onDeleteUser(
  interaction: ModalSubmitInteraction,
  id: string
): Promise<boolean> {
  const deleted = await deleteUserPermissions(id);

  if (deleted) {
    logger.info({ userId: interaction.user.id, targetId: id }, "deleted user");
    return true;
  }
  await interaction.reply({
    content: "Could not find user to delete.",
    flags: MessageFlags.Ephemeral,
  });
  return false;
}

async function onEditUser(
  interaction: ModalSubmitInteraction,
  userId: string
): Promise<boolean> {
  if (await invalidCharGuard(interaction)) return false;

  const username = interaction.fields.getTextInputValue("username");
  const permissionArray =
    interaction.fields.getStringSelectValues("permissions");
  if (!isValidPermissionArray(permissionArray)) {
    logger.error(
      { userId, targetId: userId, permissions: permissionArray },
      "malformed permission selection"
    );
    throw Error();
  }

  const info = { userId: interaction.user.id, targetId: userId };
  const permissions = permissionArrayToObj(permissionArray);
  const updated = await updatedUserPermissions(userId, {
    username,
    ...permissions,
  });
  if (updated) {
    logger.info(info, "updated user");
    return true;
  }

  logger.debug({ info }, "could not find target user");
  await interaction.reply({
    content: "Could not find user to edit. No changes were made.",
    flags: MessageFlags.Ephemeral,
  });
  return true;
}

async function handleModalSubmission(
  interaction: ModalSubmitInteraction
): Promise<boolean> {
  const [type, userId] = interaction.customId.split(":");
  if (type !== "edit" || !userId) {
    logger.error({ modal: interaction }, "Malformed modal customId");
    await interaction.reply({
      content: GENERIC_ERROR_MESSAGE,
      flags: MessageFlags.Ephemeral,
    });
    return false;
  }

  const deleteAnswer = interaction.fields.getTextInputValue("delete");
  if (deleteAnswer) {
    if (deleteAnswer === DELETE_CONFIRMATION_TEXT) {
      return onDeleteUser(interaction, userId);
    }
    await interaction.reply({
      content: `To delete a user, you must type ${DELETE_CONFIRMATION_TEXT} (all caps) in the confirmation field. Unsaved changes have not been applied.`,
      flags: MessageFlags.Ephemeral,
    });
    return false;
  }

  return onEditUser(interaction, userId);
}

async function onEditButtonClick(
  buttonInteraction: ButtonInteraction,
  commandInteraction: ChatInputCommandInteraction,
  userId: string,
  currentOffset: number
) {
  const user = await getUserPermissionsById(userId);
  if (!user) {
    logger.error({ userId }, "user in menu not found");
    return;
  }
  const modal = buildEditModal(user);
  await buttonInteraction.showModal(modal);
  const submitInteraction = await commandInteraction.awaitModalSubmit({
    time: MAX_INTERACTION_AGE_MS,
    filter: (i) => i.user.id === commandInteraction.user.id,
  });
  const refresh = await handleModalSubmission(submitInteraction);
  // Refresh menu to reflect changes
  if (submitInteraction.isFromMessage()) {
    if (refresh) await onPaginate(submitInteraction, currentOffset);
  } else {
    logger.warn({ submitInteraction }, "could not refresh menu");
  }
}

function handleMenuInteractions(
  interaction: ChatInputCommandInteraction<CacheType>,
  message: Message<boolean>,
  resultCount: number
) {
  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    filter: (i) => i.user.id === interaction.user.id,
  });

  return new Promise<void>((resolve) => {
    collector?.on("collect", async (i) => {
      // Keep track of latest offset to refresh page when changes are made
      let currentOffset = 0;

      const [type, value] = i.customId.split(":");

      switch (type) {
        case "offset": {
          currentOffset = +value!;
          await onPaginate(i, currentOffset);
          break;
        }
        case "first": {
          currentOffset = 0;
          onPaginate(i, currentOffset);
          break;
        }
        case "last": {
          currentOffset =
            resultCount -
            (resultCount % USER_PER_PAGE_LIMIT || USER_PER_PAGE_LIMIT);
          await onPaginate(i, currentOffset);
          break;
        }
        case "edit": {
          if (!value) {
            throw Error(`Malformed button customId: "${i.customId}"`);
          }
          await onEditButtonClick(i, interaction, value, currentOffset);
          break;
        }
        default: {
          // should never happen
          await i.reply({
            content: GENERIC_ERROR_MESSAGE,
            flags: MessageFlags.Ephemeral,
          });
        }
      }

      resolve();
    });
  });
}

export default commandData;
