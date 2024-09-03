import {PoeDiscordBot} from "./src/utills.js";
import axios from "axios";
import "dotenv/config";


const discordBot = new PoeDiscordBot(19);

discordBot.currencyOverview();
