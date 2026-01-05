import { type Align, padStringToWidth } from "discord-button-width";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

export class BaseButton extends ButtonBuilder {
  protected static defaults = { width: 0, disabled: false };

  constructor(
    id: string,
    style: ButtonStyle,
    options: {
      label?: string | number;
      emoji?: string;
      width?: number;
      disabled?: boolean;
    } = {}
  ) {
    super();
    const opts = { ...BaseButton.defaults, ...options };

    this.setCustomId(id).setStyle(style).setDisabled(opts.disabled);

    if (opts.label) {
      const label = opts.width
        ? "\u200b" +
          padStringToWidth(String(opts.label), opts.width, "center" as Align) +
          "\u200b"
        : String(opts.label);

      this.setLabel(label);
    }
    if (opts.emoji) {
      this.setEmoji(opts.emoji);
    }
  }
}

export class NavButtonRow extends ActionRowBuilder<ButtonBuilder> {
  constructor(offset: number, pageSize: number, total: number) {
    super();

    const prevOffset = offset - pageSize;
    const isFirstPage = prevOffset < 0;
    const nextOffset = offset + pageSize;
    const isLastPage = nextOffset >= total;
    const buttons = [
      new BaseButton("first", ButtonStyle.Primary, {
        emoji: "⏪",
        disabled: isFirstPage,
      }),
      new BaseButton("offset:" + prevOffset, ButtonStyle.Primary, {
        emoji: "⬅️",
        disabled: isFirstPage,
      }),
      new BaseButton("offset:" + nextOffset, ButtonStyle.Primary, {
        emoji: "➡️",
        disabled: isLastPage,
      }),
      new BaseButton("last", ButtonStyle.Primary, {
        emoji: "⏩",
        disabled: isLastPage,
      }),
    ];

    this.addComponents(buttons);
  }
}
