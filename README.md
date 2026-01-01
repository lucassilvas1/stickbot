# stickbot

## Usage

### Adding Stickers

![Adding new stickers](/docs/assets/commands/addsticker_file.webp)

You can add new stickers with the `/addsticker` command. You'll need to give it a unique title and a list of space-separated tags, as well as the file itself.

Most image/video formats are supported. E.g., jpeg, png, gif, webp, .mp4, .mkv, .ts, etc.

**Example**:
```
/addsticker title:apu spills his tendies tags:pepe sad crying floor tripped url:https://i.kym-cdn.com/entries/icons/original/000/037/319/cover1.jpg
```

**Availability**: Any Server, Any DM.

> [!NOTE]
> You're required to provide either a **direct link** to the file with the `url` option, or provide the file itself with the `file` option.

### Listing Stickers

![Listing stickers](/docs/assets/commands/liststickers.webp)

You can use the `/liststickers` command to view a list of all your stickers. The command allows you to narrow down the list with the `query` option. You can also change the order of the stickers with the `order` option. By default they are sorted from most to least recently used.

**Examples**:
```
/liststickers

/liststickers query:funny

/liststickers query:funny info:True

/liststickers query:cat order:Most Used
```

**Availability**: Any Server, Any DM.

> [!TIP]
> You can view sticker titles and tags by setting the `info` option to `True`. Now when you pick one of the stickers from the list, the BOT will also return its title and tags.

### Sending Stickers

![Sending a sticker directly](/docs/assets/commands/sticker.webp)

You don't have to use `/liststickers` unless you want to preview the sticker before you send it. If you already know the title of the sticker you want to send, the `/sticker` command is quicker to use.

The `/sticker` command only has one option, `query`, and it is required. The `query` option is what you'll use to narrow down the list of suggestions. Once the sticker you're looking for shows up on the list, click on it or navigate to it with your keyboard and press enter.

**Example**:
```
/sticker query:funny dog
```
The query in the example would narrow down the suggestions to stickers whose titles or tags contain both the words "funny" and "dog"

**Availability**: Any Server, Any DM.

> [!IMPORTANT]
> Even if you know the exact title of the sticker you're looking for, **you still need to pick it from the suggestion list**! That is because the BOT doesn't use the title to find the stickers, it uses unique IDs. When you choose one of the suggestions, what you're sending to the BOT is that sticker's ID, not its title.

> [!TIP]
> The `query` option works with tags as well, not just titles!

> [!TIP]
> The `query` option also works with prefixes, e.g., searching for "fun" will match both "fun" and "funny"!

### Editing Stickers

![Editing a sticker's tags](/docs/assets/commands/edit_tags.webp)

While you can't edit the stickers themselves, you can edit their title, tags, and description.

To edit a sticker you use the `/editsticker` command. The command only has one required option, `query`. [Read the Important alert in the previous section](#sending-stickers) if you don't know how the option works.

After selecting a sticker from the `query` dropdown, you can edit titles and/or tags with their respective options.

**Availability**: Any Server, Any DM.

> [!TIP]
> After selecting a sticker to edit with the `query` option, the `title` and `tags` options will suggest you their original values, so you don't have to type everything again.

> [!NOTE]
> If you need to replace a sticker's file, you can grab its title and tags with the help of `/liststickers info:True`, then delete the sticker and add a new one with the old title and tags.

### Deleting Stickers

![Deleting a sticker](/docs/assets/commands/delete.webp)

You can delete stickers with the `/deletesticker` command. Its only option is `query`, use it to find the sticker you want and delete it.

**Availability**: Any Server, Any DM.

### Adding Users

![Adding a user](/docs/assets/commands/adduser.webp)

Out of the box, only you, the owner, are allowed to use any command. If you wish to allow someone else to use the BOT, you need to use the `/adduser` command. The command only has two required options: `id` and `username`. You can find a user's ID by right-clicking their name on Discord[^discord_dev_mode]. The `username` option doesn't have to match their actual username.

There are also six other options that correspond to the user's permissions: `add-sticker`, `edit-sticker`, `delete-sticker`, `add-user`, `edit-user`, `delete-user`. The values for each of these options defaults to False, so you only need to set them to True if you wish to grant the user that permission.

**Example**:
```
/adduser id:315430983126210624 username:chris add-sticker:True edit-sticker:True
```

**Availability**: Your Server Only

> [!NOTE]
> If only wish to give the user permission to list/send stickers, you don't need to grant any permission. Adding them with all permissions set to False (default) will suffice.

> [!IMPORTANT]
> Users will still need to add the app to their account to be able to use any of the commands. They can do that from the BOT's profile on Discord.

> [!IMPORTANT]
> Users will only be able to use permission commands like this one if you invite them to your server[^bot_guild].

### Editing User Permissions

![Editing a user's permissions](/docs/assets/commands/edituser.webp)

You can edit an existing user's permission with the `/edituser` command. Its only required option is `id`, the user's ID. It's also got the same optional options as [the `/adduser` command](#adding-users), and it's those options you're gonna use to edit permissions. You only need to use the options you wish to edit, other permissions won't be affected.

**Example**:
```
/edituser id:315430983126210624 edit-sticker:False delete-sticker:False
```

**Availability**: Your Server Only

### Deleting Users

![Deleting a user](/docs/assets/commands/deleteuser.webp)

You can delete users from the app with the `/deleteuser` command. Like the `/edituser` command, its only option is `id`.

**Availability**: Your Server Only

> [!IMPORTANT]
> Deleting a user from the app is the only way to keep them from being able to list/send stickers, setting all their permissions to False will still allow them to send stickers!

> [!NOTE]
> While anyone might be able to add the BOT to their account, they won't be able to use any of the commands unless you explicitly let them with [/adduser](#adding-users).

## Requirements

- [NodeJS v16+](https://nodejs.org/en/download/).
- Recent version of [FFMPEG](https://github.com/BtbN/FFmpeg-Builds/releases). Download and extract the full GPL version (not `shared`) compatible with your setup. E.g., if you're running Windows on an Intel or AMD CPU, download the win64 GPL zip file.
- You'll need to be reachable. If you're not behind [CGNAT](https://en.wikipedia.org/wiki/Carrier-grade_NAT#:~:text=prevents%20the%20ISP%27s%20customers%20from%20using%20port%20forwarding) all you'll need to do is forward port `ASSETS_SERVER_PORT` in your router (read step 5.vi. of the installation section for more). If you can't do that, however, you'll need to use a service like [Cloudflare Tunnels](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/). You can check if port forwarding worked [here](https://portchecker.co/), just enter the value of `ASSETS_SERVER_PORT` in "Port Number" and click check. If you can't find a way of being reachable, users won't be able to see the stickers.


> [!NOTE]
> If you have a dynamic IP address, you'll want to look into DDNS services like the ones offered by [DuckDNS](https://www.duckdns.org/), [No-IP](https://www.noip.com/) or [Cloudflare](https://github.com/favonia/cloudflare-ddns). The app will not respond to IP changes on its own.

> [!CAUTION]
> If you don't set up a reverse proxy or use a service like [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/), your public IP will be exposed to anyone you send stickers to! This isn't necessarily a problem if you plan on using the app *only* with people you trust.

## Creating a Discord App

Before using the BOT, you'll need to create a Discord App to deploy the commands to.

To do this, go to the [Discord Developer Portal](https://discord.com/developers/applications), sign in, click "New Application" at the top right, give your app a name (this will be visible to other users), and create the app.

You can find the Application ID in the General Information tab, and the BOT token in the Bot tab. You'll need these values during [installation](#installation).


## Installation

1. Clone the repository or [download it as zip](https://github.com/lucassilvas1/stickbot/archive/refs/heads/main.zip) and extract it.
2. [Run](#running-commands) `npm run install` to install all necessary dependencies.
3. Rename the `.env.example` file to `.env`
4. [Enable Developer Mode on Discord](https://discord.com/developers/docs/activities/building-an-activity#step-0-enable-developer-mode). You'll need it to be able to grab your Server ID and User IDs in the future.
5. Open `.env` in any text editor and fill out every variable marked Required:
   1. Set `BOT_TOKEN` and `APPLICATION_ID` to [the values you found](#creating-a-discord-app) in the Developer Portal.
   2. Create a Discord server and copy its ID by right-clicking on it in the server list > Copy Server ID[^discord_dev_mode]. Paste the ID after `GUILD_ID=`. You may use an existing server for this[^bot_guild].
   3. Decide where you want the sticker database, the media files themselves, and the app's logs to be saved. Set the variables in the `Storage` section of to the absolute paths you decide on. For example, I have mine configured like this: `DB_DIR_PATH=C:/Users/Lucas/stickbot/db`, `ASSETS_DIR_PATH=C:/Users/Lucas/stickbot/assets`, `LOG_DIR_PATH=C:/Users/Lucas/stickbot/logs`[^storage_paths].
   4. Set the `FFMPEG_PATH` and `FFPROBE_PATH` variables to the absolute path to the `ffmpeg.exe` and `ffprobe.exe` executables that can be found in the `bin` folder after you extract the ffmpeg zip. For example: `FFMPEG_PATH=C:\Lucas\ffmpeg\bin\ffmpeg.exe`.
   5. `ASSETS_SERVER_PORT` is set to `4675` by default. You don't need to alter it unless that port is already in use for you.
   6. If you go the port forwarding route, set `ASSETS_SERVER_HOSTNAME` to `http://<YOUR PUBLIC IP>:<ASSETS_SERVER_PORT>`. E.g., `http://41.120.142.24:4675`[^server_address]. If you plan on using a custom domain for serving the stickers, `ASSETS_SERVER_HOSTNAME` should be set to your domain. E.g., `https://my-sticker-bot.net/`
6. [Run](#running-commands) `npm run deploy:prod` to deploy the commands to Discord. You may need to restart/reload Discord, and possibly wait up to an hour for the commands to become available for the first time. You **only** need to run this command during installation unless instructed otherwise!

> [!NOTE]
> Paths containing spaces need to be wrapped in double quotes (" ") both in the `.env` and in the terminal!

> [!TIP]
> If you wish to see the logs in the terminal as well, set `LOG_TO_CONSOLE` to `true` in `.env`.

## Adding the BOT

After installing, you'll need to add the BOT to the guild you created, otherwise you won't be able to allow other users to use the BOT.

Go to the Installation tab of the [Developer Portal](https://discord.com/developers/applications), copy the Install Link and follow it.

Choose "Add to Server", pick the server you created earlier from the list, and authorize it.

You can follow this same link again to add the BOT to your account, so you can use it in DMs or other servers. You can also add directly from Discord now by clicking "Add App" on the BOT's profile.


## Running

[Run](#running-commands) `npm run start:prod` 

If everything worked, your BOT should now be online and working on Discord.

## Running commands

You'll need to run some commands to setup and start the app. If you're unfamilar with running terminal commands:  
1. On **Windows**, open The Terminal, PowerShell, or Command Prompt from the Start Menu. On **Mac**, find the Terminal in the Launchpad and open it. You should know what you're doing if you're on Linux.
2. Navigate to the app's root folder with the `cd` command. E.g. `cd "C:\Lucas\stickbot"`. This is where all `npm` commands mentioned in the instructions **need** to be run in.

[^credentials]: After creating a new application, you can find your `APPLICATION_ID` in the `General Information` tab, and your `BOT_TOKEN` in the `Bot` tab, after clicking the `Reset Token` button.

[^discord_dev_mode]: You'll to enable Developer Mode in Discord to do this.

[^bot_guild]: Permission management commands (e.g. `/adduser`) will only be available in this guild.

[^storage_paths]: If your paths contain spaces you'll need to wrap them in double quotes like `"path/to/something"`!  
You don't need to create the folders, they'll be created for you, and they don't need to share parent folders, I just did that to keep things tidy.

[^ffmpeg]: The version you'll need will depend on your OS and architecture. Don't download the `shared` version!

[^server_address]: To be clear, you need to use your [**public** IP address](https://whatismyipaddress.com/), not your local one.  
**The IP address/hostname you set `ASSETS_SERVER_HOSTNAME` to will be visible to whoever you send stickers to!**  


