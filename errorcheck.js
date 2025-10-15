const fs = require("fs");
const request = require("request");

var config = JSON.parse(fs.readFileSync("config.json"));

function log(msg) { 
  console.log(new Date().toString() + ' - ' + msg); 
}

function startProcess() {
  log("Grabbing prices...");

  let exchangePrices = [];
  let aggregatorPrices = [];

  // Exchanges
  loadPriceBinance(function (price) {
    exchangePrices.push(price);
  }, 0);

  loadPricePoloniex(function (price) {
    exchangePrices.push(price);
  }, 0);

  loadPriceBittrex(function (price) {
    exchangePrices.push(price);
  }, 0);

  // Aggregators
  loadPriceCoingecko(function (price) {
    aggregatorPrices.push(price);
  }, 0);

  loadPriceCryptocompare(function (price) {
    aggregatorPrices.push(price);
  }, 0);

  // Wait for prices
  setTimeout(function() {
    // Show results
    aggregatorPrice = aggregatorPrices.reduce((t, v) => t + v, 0) / aggregatorPrices.length;
    log("  Aggregator-only ('correct') average: " + aggregatorPrice);

    exchangePrice = exchangePrices.reduce((t, v) => t + v, 0) / exchangePrices.length;
    exchangePriceError = percentageDiff(exchangePrice, aggregatorPrice).toFixed(3);
    log("               Exchanges-only average: " + exchangePrice + " (" + exchangePriceError + "% error)");
    
    combinedPrices = aggregatorPrices.concat(exchangePrices);
    combinedPrice = combinedPrices.reduce((t, v) => t + v, 0) / combinedPrices.length;
    combinedPriceError = percentageDiff(combinedPrice, aggregatorPrice).toFixed(3);;
    
    log("               Default config average: " + combinedPrice + " (" + combinedPriceError + "% error)");

    log("=============================================================================");  
  }, 2000);
}

function percentageDiff(v1, v2) {
    return ((v1 - v2) / ((v1 + v2) / 2)) * 100;
}

function loadPriceCryptocompare(callback, retries) {
  // Load STEEM price in BTC from Cryptocompare and convert that to USD using BTC price
  request.get('https://min-api.cryptocompare.com/data/price?fsym=STEEM&tsyms=USDT', function (e, r, data) {    
    try {
      const steem_price = parseFloat(JSON.parse(data).USDT);
      log('Loaded STEEM Price from Cryptocompare: ' + steem_price);

      if (callback) {
        callback(steem_price);
      }
    } catch (err) {
      log('Error loading STEEM price from Cryptocompare: ' + err);

      if(retries <= config.price_feed_max_retry) {
        setTimeout(function () { 
          loadPriceCryptocompare(callback, retries + 1); 
        }, config.retry_interval * 1000);
      }
    }
  });
}

function loadPriceCoingecko(callback, retries) {
  // Load STEEM price in BTC from Coingecko and convert that to USD using BTC price
  request.get('https://api.coingecko.com/api/v3/simple/price?ids=steem&vs_currencies=usd', function (e, r, data) {
    try {
      const steem_price = parseFloat(JSON.parse(data).steem.usd);
      log('Loaded STEEM Price from Coingecko: ' + steem_price);

      if (callback) {
        callback(steem_price);
      }
    } catch (err) {
      log('Error loading STEEM price from Coingecko: ' + err);

      if(retries <= config.price_feed_max_retry) {
        setTimeout(function () { 
          loadPriceCoingecko(callback, retries + 1); 
        }, config.retry_interval * 1000);
      }
    }
  });
}

function loadPriceBittrex(callback, retries) {
  // Load STEEM price in BTC from bittrex and convert that to USD using BTC price
  request.get('https://api.bittrex.com/v3/markets/BTC-USD/ticker', function (e, r, data) {
    request.get('https://api.bittrex.com/v3/markets/STEEM-BTC/ticker', function (e, r, btc_data) {
      try {
        const steem_price = parseFloat(JSON.parse(data).lastTradeRate) * parseFloat(JSON.parse(btc_data).lastTradeRate);
        log('Loaded STEEM Price from Bittrex: ' + steem_price);

        if (callback) {
          callback(steem_price);
        }
      } catch (err) {
        log('Error loading STEEM price from Bittrex: ' + err);

        if(retries <= config.price_feed_max_retry) {
          setTimeout(function () { 
            loadPriceBittrex(callback, retries + 1); 
          }, config.retry_interval * 1000);
        }
      }
    });
  });
}

function loadPriceBinance(callback, retries) {
  // Load STEEM price in BTC and convert that to USD using BTC price
  request.get('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT', function (e, r, data) {
    request.get('https://api.binance.com/api/v3/ticker/price?symbol=STEEMBTC', function (e, r, btc_data) {
      try {
        const steem_price = parseFloat(JSON.parse(data).price) * parseFloat(JSON.parse(btc_data).price);
        log('Loaded STEEM Price from Binance: ' + steem_price);

        if (callback) {
          callback(steem_price);
        }
      } catch (err) {
        log('Error loading STEEM price from Binance: ' + err);

        if (retries <= config.price_feed_max_retry) {
          setTimeout(function () { 
            loadPriceBinance(callback, retries + 1); 
          }, config.retry_interval * 1000);
        }
      }
    });
  });
}

function loadPricePoloniex(callback, retries) {
  request.get('https://api.poloniex.com/markets/price', function (e, r, data) {
    if (e) {
        log(e);
        log(r.statusCode);
        return;
    }    
    try {
      let jdata = JSON.parse(data);
      let json_data = {};
      jdata.forEach(x => {
        json_data[x["symbol"]] = x;
      });
      let steem_price = -1;
      if (json_data['STEEM_USDT']) {
        steem_price = parseFloat(json_data['STEEM_USDT'].price);
        console.log(1);
      }
      if (json_data['STEEM_BTC'] && json_data['BTC_USDT']) {
        console.log(2);
        steem_price = parseFloat(json_data['STEEM_BTC'].price) * parseFloat(json_data['BTC_USDT'].price);
      }
      if (json_data['STEEM_TRX'] && json_data['TRX_USDT']) {
        console.log(3);
        steem_price = parseFloat(json_data['STEEM_TRX'].price) * parseFloat(json_data['TRX_USDT'].price);
      }
      if (steem_price > 0) {
        log('Loaded STEEM Price from Poloniex: ' + steem_price);
        if (callback) {
          callback(steem_price);
        }
      } else {
        throw "Poloniex API Error!";
      }
    } catch (err) {
      log('Error loading STEEM price from Poloniex: ' + err);

      if (retries <= config.price_feed_max_retry) {
        setTimeout(function () { 
          loadPriceBinance(loadPricePoloniex, retries + 1); 
        }, config.retry_interval * 1000);
      }
    }
  });
}

setInterval(startProcess, 60000);
startProcess();
