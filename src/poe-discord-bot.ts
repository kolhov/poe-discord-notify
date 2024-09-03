import axios from "axios";
import {ECurrency} from "./currency.js";
import {IDiscordMessage} from "./i-discord-message.js";
import "dotenv/config"
import {EItem} from "./item.js";

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

  sendToDiscord(webhookToken: string, item: IDiscordMessage | IDiscordMessage[], category?) {
    if (!item) {
     console.log('No item for send')
    }
    let embeds;
    let fields;

    if (Array.isArray(item)){
      fields = item.map((x) => {
        return {
          name: `${x.name}`,
          value: `*Прирост +${x.sparkLine}%*  |  ${x.chaosCost} <:chaosorb:1280152529866457179>  |  ${x.divCost} <:divineorb:1280152866253836288>\n`,
          inline: false
        }
      })
      embeds = [
        {
          title: category,
          color: 14447215,
          thumbnail: {
            url: item[0].icon
          },
          fields: fields,
          footer: {
            text: `Current divine: ${this._divinePrice}`
          }
        }
      ]
    } else {
      embeds = [
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
            text: `Current divine: ${this._divinePrice}`
          }
        }
      ]
    }

    axios.post(webhookToken, {
      embeds: embeds
    })
      .then((response) => console.log("Successfully posted on discord"))
      .catch((err) => console.log(`\nError content ${JSON.stringify(embeds)} ###################### \n ${JSON.stringify(err.response.data)}`))
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

  async allCurrencyOverview(){
    for (const x of Object.values(ECurrency) as ECurrency[]){
      console.log(`\n${x} overview`);
      await this.currencyOverview(x);
    }
  }

  async itemOverview(itemType: EItem = EItem.SCARAB) {
    const divPrice = await this.getDivPrice();
    axios.get("https://poe.ninja/api/data/itemoverview", {
      params: {
        league: await this.getLeague(),
        type: itemType
      }
    })
      .then(async (response) => {
        let filteredArray = response.data['lines'].filter((item) =>
          item["sparkline"]["totalChange"] > this.priceHike && item['chaosValue'] > 20);

        let itemArray: IDiscordMessage[] = [];
        for (const x of filteredArray) {
          if (x?.['links'] && x['links'] > 4) {
            continue;                                                   // Skip 5-6 link armour/weapon duplicates
          }
          let risingItem = {
            name: x['name'],
            icon: x['icon'],
            sparkLine: Math.round(x['sparkline']['totalChange']),
            divCost: x['divineValue'],
            chaosCost: Math.round(x['chaosValue'])
          } as IDiscordMessage
          itemArray.push(risingItem);

          // Discord have limit to 25 item per message
          if (itemArray.length == 25){
            this.sendToDiscord(this.discordBot, itemArray, itemType);
            itemArray = [];

            // Timeout to prevent discord rate limits
            await new Promise(resolve => setTimeout(resolve, 400));
          }
        }
        if (itemArray.length > 0){
          this.sendToDiscord(this.discordBot, itemArray, itemType);
        }
      })
      .catch((err) => console.log(err));
  }

  async allItemOverview(){
    for (const x of Object.values(EItem) as EItem[]){
      console.log(`\n${x} overview`);
      await this.itemOverview(x);

      // Timeout to prevent poe.ninja/Discord rate limits
      await new Promise(resolve => setTimeout(resolve, 400));
    }
  }
}
