import axios from "axios";
import {ECurrency} from "./currency.js";
import {EItem} from "./item.js";
import {IDiscordMessage} from "./i-discord-message.js";

const discordBot = process.env["DISCORD_TOKEN"];
const priceHike = 19;

export function getLeague() {
  // noinspection TypeScriptValidateTypes
  return axios.request({
    url: "https://www.pathofexile.com/api/leagues",
    method: 'get',
    headers: {
      'user-agent': 'my-app/0.0.1'
    }
  }).then(
    function (response) {
      return response.data[8]['id'];         //0-7 standard leagues
    }
  )
}

export async function getDivPrice(){
  return await axios.get("https://poe.ninja/api/data/currencyoverview", {
    params: {
      league: await getLeague(),
      type: ECurrency.CURRENCY
    }
  }).then((response){
    return response
  }
  )
}

export async function processCurrency(){
  axios.get("https://poe.ninja/api/data/currencyoverview", {
    params: {
      league: await getLeague(),
      type: ECurrency.CURRENCY
    }
  }).then(function (response){
    let risingItem: IDiscordMessage[] = response['lines'].filter((item) => item["receiveSparkLine"] > priceHike)
      .map(function (item) {
        return {
          name: item['currencyTypeName'],
          icon: item,
          sparkLine: Math.round(item['receiveSparkLine']['totalChange']),
          divCost: number,
          chaosCost: Math.round(item['chaosEquivalent'])
        } as IDiscordMessage
      })

    }
  );
}

