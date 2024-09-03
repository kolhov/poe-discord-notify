import axios from "axios";
import {ECurrency} from "./currency.js";
import {IDiscordMessage} from "./i-discord-message.js";
import "dotenv/config"


export class PoeDiscordBot {

  discordBot: string;
  priceHike: number;
  private _currentLeague: string;
  private _divinePrice: number;

  constructor(priceHike: number = 20) {
    this.priceHike = priceHike;
    this.discordBot = process.env["DISCORD_TOKEN"];
  }

  setPriceHike(priceHike: number){
    this.priceHike = priceHike;
  }

  setLeague(name: string | null) {
    this._currentLeague = name;
  }

  async getLeague(){
    if (!this._currentLeague){
      this._currentLeague = await this.fetchLeague();
    }

    return this._currentLeague;
  }

  fetchLeague() {
    // noinspection TypeScriptValidateTypes
    return axios.request({
      url: "https://www.pathofexile.com/api/leagues",
      method: 'get',
      headers: {
        'user-agent': 'my-app/0.0.1'
      }
    })
      .then(function (response) {
        return response.data[8]['id'] as string;                //0-7 standard leagues
      })
      .catch((err) => {
        console.log(err + '\n Current league set to standard');
        return 'Standard';
      })
  }

  async getDivPrice(){
    if (!this._divinePrice){
      this._divinePrice = await this.fetchDivPrice();
    }

    return this._divinePrice;
  }

  async refreshDivPrice(){
    this._divinePrice = await this.fetchDivPrice();
  }

  async fetchDivPrice() {
    return await axios.get("https://poe.ninja/api/data/currencyoverview", {
      params: {
        league: await this.getLeague(),
        type: ECurrency.CURRENCY
      }
    })
      .then(function (response) {
        const divPrice =  Math.round(response.data['lines']
          .find(item => item['currencyTypeName'] === "Divine Orb")['receive']['value']);

        console.log(`Divine fetched: ${divPrice} chaos orb`);
        return divPrice;
      })
      .catch((err) => {
        console.log(err);
        return 1;
      })
  }

  sendToDiscord(webhookToken: string, item: IDiscordMessage) {
    if (!item) {
     console.log('No item for send')
    }
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
          ],
          footer: {
            text: `${this._divinePrice} <:divineorb:1280152866253836288>`
          }
        }
      ]
    })
      .then((response) => console.log("Successfully posted on discord"))
      .catch((err) => console.log(`Error content ${message} \n ###################### \n ${JSON.stringify(err.response.data)}`))
  }

  async currencyOverview(currencyType: ECurrency = ECurrency.CURRENCY) {
    const divPrice = await this.getDivPrice();
    axios.get("https://poe.ninja/api/data/currencyoverview", {
      params: {
        league: await this.getLeague(),
        type: currencyType
      }
    })
      .then(async (response) => {
        let filteredArray = response.data['lines'].filter((item) =>
          item["receiveSparkLine"]["totalChange"] > this.priceHike && item['chaosEquivalent'] > 20);

        for (const x of filteredArray) {
          let risingItem = {
            name: x['currencyTypeName'],
            icon: response.data['currencyDetails'].find(y => y['name'] == x['currencyTypeName'])['icon'],
            sparkLine: Math.round(x['receiveSparkLine']['totalChange']),
            divCost: Math.round((x['chaosEquivalent'] / divPrice) * 10) / 10,
            chaosCost: Math.round(x['chaosEquivalent'])
          } as IDiscordMessage

          console.log(`Item ${x['currencyTypeName']} prepared to send`)
          this.sendToDiscord(this.discordBot, risingItem);

          // Timeout to prevent discord rate limits
          await new Promise(resolve => setTimeout(resolve, 400));
        }
      })
      .catch((err) => console.log(err));
  }
}
