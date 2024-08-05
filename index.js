import { CronJob } from "cron";

import axios from "axios";

// const TelegramBot = require("node-telegram-bot-api");
import TelegramBot from "node-telegram-bot-api";
import "dotenv/config";

// Replace with your bot token
const token = process.env.TELEGRAM_BOT_TOKEN;

// Create a bot that uses 'polling' to fetch new updates
const bot = new TelegramBot(token, { polling: true });

// import getAwashbankExchangeRates from "./awashbank.js";
// import getBankofabyssiniaExchangeRates from "./bankofabyssinia.js";
// import getCombankethExchangeRates from "./combanketh.js";
// import getDashenbankscExchangeRates from "./dashenbanksc.js";

import { createClient } from "@supabase/supabase-js";

const supabase_url = process.env.SUPABASE_URL;
const service_role_key = process.env.SUPABASE_SERVICE_ROLE_KEY;

const service_key = process.env.SUPABASE_SERVICE_KEY;

export const supabaseClient = createClient(supabase_url, service_key);

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  // console.log("chatId", chatId);
  // bot.sendMessage(chatId, "Received your message" + msg.text);
  if (msg.text === "/start") {
    const { data, error } = await supabaseClient
      .from("telegram_chat")
      .upsert({ chat_id: msg.chat.id }, { onConflict: "chat_id" });
    bot.sendMessage(
      chatId,
      "Welcome to the Ethiopian Banks Exchange Rates Bot, @" +
        // user
        msg.chat.username
    );
  }
});

const job = new CronJob(
  // every 30 minutes
  "*/1 * * * *", // cronTime
  async function () {
    console.log("Running job");

    // const chatId = "1553400782";

    // Send a message to the chat
    // bot.sendMessage(chatId, "Trying to get the data");

    axios
      .get(
        "https://combanketh.et/cbeapi/daily-exchange-rates?_limit=1&_sort=Date%3ADESC"
      )
      .then(async (response) => {
        const combankethExchangeRates = response.data[0].ExchangeRate.map(
          (exchangeRate) => {
            return {
              currency: exchangeRate.currency.CurrencyCode,
              buying: exchangeRate.cashBuying,
              selling: exchangeRate.cashSelling,
            };
          }
        );
        console.log("combankethExchangeRates:: :: ", combankethExchangeRates);

        await notifyTelegramBotUsers(
          combankethExchangeRates.map((exchangeRate) => ({
            currency: exchangeRate.currency,
            buying_price: exchangeRate.buying,
            selling_price: exchangeRate.selling,
          }))
        );

        const { data: exchangeRatesData, error: exchangeRatesError } =
          await supabaseClient.from("exchange_rates_per_bank").select("*");
        if (exchangeRatesError) {
          console.error("error", exchangeRatesError);
        } else {
          //   console.log("exchangeRatesData", exchangeRatesData);
          const combankethExchangeRatesData = exchangeRatesData.filter(
            (exchangeRate) => exchangeRate.bank_title === "combanketh"
          );

          const decendingCombankethExchangeRatesData =
            combankethExchangeRatesData.sort((a, b) => b.id - a.id);

          let newCombankethExchangeRates = {
            bank_title: "combanketh",
            exchange: {
              exchange_rates: combankethExchangeRates.map((exchangeRate) => ({
                //   bank_title: "combanketh",
                currency: exchangeRate.currency,
                buying_price: exchangeRate.buying,
                selling_price: exchangeRate.selling,
              })),
            },
          };

          if (decendingCombankethExchangeRatesData.length === 0) {
            // console.log("No data found for combanketh");

            // insert combankethExchangeRates to exchangeRatesData
            const { data: newExchangeRatesData, error: newExchangeRatesError } =
              await supabaseClient
                .from("exchange_rates_per_bank")
                .insert([newCombankethExchangeRates]);

            const filteredNewCombankethExchangeRates =
              newCombankethExchangeRates.exchange.exchange_rates.filter(
                (exchangeRate) =>
                  exchangeRate.buying_price > 0 &&
                  exchangeRate.selling_price > 0
              );

            await notifyTelegramBotUsers(filteredNewCombankethExchangeRates);

            if (newExchangeRatesError) {
              console.error("error", newExchangeRatesError);
            } else {
              console.log("INSERTED NEW DATA .");
            }
          } else {
            // console.log(typeof decendingCombankethExchangeRatesData[0].exchange);
            // console.log(decendingCombankethExchangeRatesData[0].exchange);

            const lastCombankethExchangeRatesDatasPerBank =
              decendingCombankethExchangeRatesData[0].exchange.exchange_rates;

            const newCombankethExchangeRatesExchange =
              newCombankethExchangeRates.exchange.exchange_rates;

            // compare and find the difference between lastCombankethExchangeRatesDatasPerBank and newCombankethExchangeRatesExchange
            const filteredNewCombankethExchangeRates =
              newCombankethExchangeRatesExchange.filter(
                (exchangeRate) =>
                  !lastCombankethExchangeRatesDatasPerBank.some(
                    (lastExchangeRate) =>
                      lastExchangeRate.currency === exchangeRate.currency &&
                      lastExchangeRate.buying_price ===
                        exchangeRate.buying_price &&
                      lastExchangeRate.selling_price ===
                        exchangeRate.selling_price
                  )
              );

            if (
              filteredNewCombankethExchangeRates &&
              filteredNewCombankethExchangeRates.length > 0
            ) {
              //   console.log("No new data found for combanketh");

              // const { data: telegramChatData, error: telegramChatError } =
              //   await supabaseClient.from("telegram_chat").select("*");
              // if (telegramChatError) {
              //   console.error("error", telegramChatError);
              // } else {
              //   console.log("telegramChatData", telegramChatData);
              //   telegramChatData.forEach(async (chat) => {
              //     const chatId = chat.chat_id;
              //     console.log("chatId", chatId);

              //     let combankethExchangeRatesTable = `
              //     \n Commertial Bank of Ethiopia (CBE) Exchange Rates [Update]
              //     `;
              //     combankethExchangeRatesTable =
              //       combankethExchangeRatesTable +
              //       "\n" +
              //       filteredNewCombankethExchangeRates
              //         .filter(
              //           (exchangeRate) =>
              //             exchangeRate.buying_price > 0 &&
              //             exchangeRate.selling_price > 0
              //         )
              //         .map(
              //           (exchangeRate) =>
              //             `${exchangeRate.currency} \n - Buying: ${exchangeRate.buying_price} \n - Selling: ${exchangeRate.selling_price}`
              //         )
              //         .join("\n");

              //     console.log(
              //       "combankethExchangeRatesTable",
              //       combankethExchangeRatesTable
              //     );

              //     bot.sendMessage(chatId, combankethExchangeRatesTable);
              //   });
              // }

              await notifyTelegramBotUsers(filteredNewCombankethExchangeRates);

              const {
                data: newExchangeRatesData,
                error: newExchangeRatesError,
              } = await supabaseClient.from("exchange_rates_per_bank").insert([
                {
                  bank_title: "combanketh",
                  exchange: {
                    exchange_rates: filteredNewCombankethExchangeRates,
                  },
                },
              ]);

              if (newExchangeRatesError) {
                console.error("error", newExchangeRatesError);
              } else {
                console.log("INSERTED NEW DATA");
              }
            }
          }
        }

        // const { data: exchange_rates, error } = await supabaseClient
        //     .from("exchange_rates")
        //     .insert(data);
        // if (error) {
        //     console.log("Error inserting data", error);
        // } else {
        //     console.log("Data inserted", exchange_rates);
        // }
      })
      .catch((error) => {
        console.log("Error fetching data", error);
      });
  }, // onTick
  null, // onComplete
  true, // start
  "America/Los_Angeles" // timeZone
);

// job.start() is optional here because of the fourth parameter set to true.

async function notifyTelegramBotUsers(filteredNewCombankethExchangeRates) {
  console.log("notifying telegram bot users");
  const { data: telegramChatData, error: telegramChatError } =
    await supabaseClient.from("telegram_chat").select("*");
  if (telegramChatError) {
    console.error("error", telegramChatError);
  } else {
    console.log("telegramChatData", telegramChatData);
    telegramChatData.forEach(async (chat) => {
      const chatId = chat.chat_id;
      console.log("chatId", chatId);

      let combankethExchangeRatesTable = `
                  \n Commertial Bank of Ethiopia (CBE) Exchange Rates [Update]
                  `;
      combankethExchangeRatesTable =
        combankethExchangeRatesTable +
        "\n" +
        filteredNewCombankethExchangeRates
          .filter(
            (exchangeRate) =>
              exchangeRate.buying_price > 0 && exchangeRate.selling_price > 0
          )
          .map(
            (exchangeRate) =>
              `${exchangeRate.currency} \n - Buying: ${exchangeRate.buying_price} \n - Selling: ${exchangeRate.selling_price}`
          )
          .join("\n");

      console.log("combankethExchangeRatesTable", combankethExchangeRatesTable);

      bot.sendMessage(chatId, combankethExchangeRatesTable);
    });
  }
}
