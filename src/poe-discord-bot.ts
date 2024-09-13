import axios from "axios";
import {ECurrency} from "./currency.js";
import {IDiscordMessage} from "./i-discord-message.js";
import "dotenv/config"
import {EItem} from "./item.js";

export class PoeDiscordBot {

  priceHike: number;
  private _discordBot: string;
  private _currentLeague: string;
  private _divinePrice: number;
  private _floorChaosPrice: number;

  constructor(webhookToken: string, priceHike: number = 20, floorChaosPrice: number = 20) {
    this.priceHike = priceHike;
    this._floorChaosPrice = floorChaosPrice;
    this._discordBot = webhookToken;
  }

  setPriceHike(priceHike: number) {
    this.priceHike = priceHike;
  }

  setLeague(name: string | null) {
    this._currentLeague = name;
  }

  async getLeague() {
    if (!this._currentLeague) {
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

  async getDivPrice() {
    if (!this._divinePrice) {
      this._divinePrice = await this.fetchDivPrice();
    }

    return this._divinePrice;
  }

  async refreshDivPrice() {
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
        const divPrice = Math.round(response.data['lines']
          .find(item => item['currencyTypeName'] === "Divine Orb")['receive']['value']);

        console.log(`Divine fetched: ${divPrice} chaos orb`);
        return divPrice;
      })
      .catch((err) => {
        console.log(err);
        return 1;
      })
  }

  async sendToDiscord(item: IDiscordMessage | IDiscordMessage[], category?) {
    if (!item) {
      console.log('No item for send')
    }
    let embeds;
    let fields;

    if (Array.isArray(item)) {
      fields = item.map((x) => {
        return {
          name: `${x.name}`,
          value: `*Прирост ${x.sparkLine}%* \u200B\u200B\u200B\u200B\u200B\u200B ${x.chaosCost} <:chaosorb:1280152529866457179> \u200B\u200B\u200B ${x.divCost} <:divineorb:1280152866253836288>\n`,
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
              value: `*${item.sparkLine}%*`,
              inline: true
            },
          ],
          footer: {
            text: `Current divine: ${this._divinePrice}`
          }
        }
      ]
    }

    const maxRetries = 5
    let attempts = 0;

    while (attempts < maxRetries) {
      try {
        await axios.post(this._discordBot, {
          embeds: embeds
        })
          .then(() => {
            console.log("Successfully posted on discord");
            attempts = 10;
          })
          .catch((err) => {
            throw err;
          })
      } catch (err) {
        attempts++;
        console.log(`${err.response.data?.message}, attempt [${attempts} : ${maxRetries}]`)
        await new Promise(resolve => setTimeout(resolve, err.response.data?.['retry_after'] + 100 ?? 500))
      }
    }
  }

  async currencyOverview(currencyType: ECurrency = ECurrency.CURRENCY) {
    const divPrice = await this.getDivPrice();
    const response = await axios.get("https://poe.ninja/api/data/currencyoverview", {
      params: {
        league: await this.getLeague(),
        type: currencyType
      }
    })

    let filteredArray = response.data['lines'].filter((item) =>
      item["receiveSparkLine"]["totalChange"] > this.priceHike && item['chaosEquivalent'] > this._floorChaosPrice);

    for (const x of filteredArray) {
      let risingItem = {
        name: x['currencyTypeName'],
        icon: response.data['currencyDetails'].find(y => y['name'] == x['currencyTypeName'])['icon'],
        sparkLine: Math.round(x['receiveSparkLine']['totalChange']),
        divCost: Math.round((x['chaosEquivalent'] / divPrice) * 10) / 10,
        chaosCost: Math.round(x['chaosEquivalent'])
      } as IDiscordMessage

      console.log(`Item ${x['currencyTypeName']} prepared to send`)
      await this.sendToDiscord(risingItem);

      // Timeout to prevent discord rate limits
      await new Promise(resolve => setTimeout(resolve, 500));
      console.log(`Item ${x['currencyTypeName']} posted \n`)
    }
  }

  async allCurrencyOverview() {
    for (const x of Object.values(ECurrency) as ECurrency[]) {
      console.log(`\n${x} overview`);
      await this.currencyOverview(x);
    }
  }

  async itemOverview(itemType: EItem = EItem.SCARAB) {
    axios.get("https://poe.ninja/api/data/itemoverview", {
      params: {
        league: await this.getLeague(),
        type: itemType
      }
    })
      .then(async (response) => {
        let filteredArray = response.data['lines'].filter((item) =>
          item["sparkline"]["totalChange"] > this.priceHike && item['chaosValue'] > this._floorChaosPrice);

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
          if (itemArray.length == 25) {
            console.log(`${itemType} ready to send`)
            await this.sendToDiscord(itemArray, itemType);
            itemArray = [];

            // Timeout to prevent discord rate limits
            await new Promise(resolve => setTimeout(resolve, 400));
          }
        }
        if (itemArray.length > 0) {
          await this.sendToDiscord(itemArray, itemType);
        }
      })
      .catch((err) => console.log(err));
  }

  async allItemOverview() {
    for (const x of Object.values(EItem) as EItem[]) {
      console.log(`\n${x} overview`);
      await this.itemOverview(x);

      // Timeout to prevent poe.ninja/Discord rate limits
      await new Promise(resolve => setTimeout(resolve, 400));
    }
  }

  async beastOverview() {
    axios.get("https://poe.ninja/api/data/itemoverview", {
      params: {
        league: await this.getLeague(),
        type: 'Beast'
      }
    })
      .then(async (response) => {
        let filteredArray = response.data['lines'].filter((item) =>
          item['chaosValue'] > this._floorChaosPrice &&
          // Ignore scammers, probably will skip all rare red beasts on start of the league, but whatever
          item['listingCount'] > 80 &&
          // In player based economy cant be 0 price change
          item['sparkline']['totalChange'] != 0);

        let beastArray: IDiscordMessage[] = [];
        for (const x of filteredArray) {
          let beast = {
            name: x['name'],
            icon: x['icon'],
            sparkLine: Math.round(x['sparkline']['totalChange']),
            divCost: x['divineValue'],
            chaosCost: Math.round(x['chaosValue'])
          } as IDiscordMessage
          beastArray.push(beast);

          // Discord have limit to 25 item per message
          if (beastArray.length == 25) {
            await this.sendToDiscord(beastArray, 'Beasts');
            beastArray = [];

            // Timeout to prevent discord rate limits
            await new Promise(resolve => setTimeout(resolve, 400));
          }
        }
        if (beastArray.length > 0) {
          await this.sendToDiscord(beastArray, 'Beasts');
        }
      })
      .catch((err) => console.log(err));
  }
}
