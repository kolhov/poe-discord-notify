import {PoeDiscordBot} from "./src/poe-discord-bot.js";
import "dotenv/config";


const discordBot = new PoeDiscordBot(40);

discordBot.allItemOverview()
