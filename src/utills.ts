import axios from "axios";
import {ECurrency} from "./currency.js";
import {EItem} from "./item.js";
import {IDiscordMessage} from "./i-discord-message.js";
import "dotenv/config"

const discordBot = process.env["DISCORD_TOKEN"];
const priceHike = 10;

export function getLeague() {
  // noinspection TypeScriptValidateTypes
  return axios.request({
    url: "https://www.pathofexile.com/api/leagues",
    method: 'get',
    headers: {
      'user-agent': 'my-app/0.0.1'
    }
  })
    .then(function (response) {
      return response.data[8]['id'];                //0-7 standard leagues
    })
    .catch((err) => console.log(err))
}

export async function getDivPrice() {
  return await axios.get("https://poe.ninja/api/data/currencyoverview", {
    params: {
      league: await getLeague(),
      type: ECurrency.CURRENCY
    }
  })
    .then(function (response) {
      return Math.round(response.data['lines'].find(item => item['currencyTypeName'] === "Divine Orb")['receive']['value']
      )
    })
    .catch((err) => {
      console.log(err);
      return 1;
    })
}

function sendToDiscord(webhookToken: string, item: IDiscordMessage) {
  if (!item) return;
  let message = `> *Прирост +${item.sparkLine}* ${item.name} ${item.chaosCost} <:chaosorb:1280152529866457179> (${item.divCost} <:divineorb:1280152866253836288>)\n`

  axios.post(webhookToken, {
    //content: message,
    embeds: [
      {
        title: item.name,
        color: 16777215,
        thumbnail: {
          url: item.icon
        },
        fields: [
          {
            name: `<:chaosorb:1280152529866457179>`,
            value: item.chaosCost.toString(),
            inline: true
          },
          {
            name: `<:divineorb:1280152866253836288>`,
            value: item.divCost.toString(),
            inline: true
          },
          {
            name: `Прирост`,
            value: `*+${item.sparkLine}%*`,
            inline: true
          },
        ]
      }
    ]
  })
    .then((response) => console.log("Successfully posted on discord"))
    .catch((err) => console.log(`Error content ${message} \n ###################### \n ${JSON.stringify(err.response.data)}`))
}

export async function processCurrency() {
  const divPrice = await getDivPrice();
  axios.get("https://poe.ninja/api/data/currencyoverview", {
    params: {
      league: await getLeague(),
      type: ECurrency.FRAGMENT
    }
  })
    .then(async function (response) {
      let filteredArray = response.data['lines'].filter((item) =>
        item["receiveSparkLine"]["totalChange"] > priceHike && item['chaosEquivalent'] > 20);

      for (const x of filteredArray) {
        let risingItem = {
          name: x['currencyTypeName'],
          icon: response.data['currencyDetails'].find(y => y['name'] == x['currencyTypeName'])['icon'],
          sparkLine: Math.round(x['receiveSparkLine']['totalChange']),
          divCost: Math.round((x['chaosEquivalent'] / divPrice) * 10) / 10,
          chaosCost: Math.round(x['chaosEquivalent'])
        } as IDiscordMessage

        sendToDiscord(discordBot, risingItem);

        // Timeout to prevent discord rate limits
        await new Promise(resolve => setTimeout(resolve, 400));
      }
    })
    .catch((err) => console.log(err));
}

