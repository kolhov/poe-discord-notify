import {PoeDiscordBot} from "./src/poe-discord-bot.js";
import "dotenv/config";


const discordBot = new PoeDiscordBot(process.env["DISCORD_TOKEN"], 30);

// All economy overview
discordBot.allItemOverview().then(() =>
  discordBot.allCurrencyOverview()).then(() =>
    discordBot.beastOverview())

// discordBot.beastOverview()