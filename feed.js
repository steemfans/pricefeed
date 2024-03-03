const fs = require("fs");
const steem = require('steem');
const request = require("request");

var config = JSON.parse(fs.readFileSync("config.json"));

// Connect to the specified RPC node
var rpc_node = config.rpc_nodes ? config.rpc_nodes[0] : (config.rpc_node ? config.rpc_node : 'https://api.steemit.com');
steem.api.setOptions({ 
    transport: 'http', 
    uri: rpc_node, 
    url: rpc_node 
});

// if feed_steem_active_key is not set in config.json
// then look for it in environment variables
function get_active_key() {
    const key = config.feed_steem_active_key;
    if (key) return key;
    return process.env.feed_steem_active_key;
}

// if feed_steem_account is not set in config.json
// then look for it in environment variables
function get_account_name() {
    const key = config.feed_steem_account;
    if (key) return key;
    return process.env.feed_steem_account;
}

// if coinmarketcap_api_key is not set in config.json
// then look for it in environment variables
function get_coinmarketcap_api_key() {
    const key = config.coinmarketcap_api_key;
    if (key) return key;
    return process.env.coinmarketcap_api_key;
}

if (!get_account_name()) {
    console.log("feed_steem_account not set in config.json or environment");
    process.exit(1);
}

if (!get_active_key()) {
    console.log("feed_steem_active_key not set in config.json or environment");
    process.exit(1);
}

if (!config.exchanges || config.exchanges.length == 0) {
    console.log("no exchanges are specified.");
    process.exit(1);
}

function log(msg) { 
    console.log(new Date().toString() + ' - ' + msg); 
}

function startProcess() {  
  let prices = [];
  
  if (config.exchanges.indexOf('cloudflare') >= 0) {
    loadPriceCloudflare(function (price) {
      prices.push(price);
    }, 0);
  }

  if (config.exchanges.indexOf('slowapi') >= 0) {
    loadPriceSlowApi(function (price) {
      prices.push(price);
    }, 0);
  }

  if (config.exchanges.indexOf('coingecko') >= 0) {
    loadPriceCoingecko(function (price) {
      prices.push(price);
    }, 0);
  }  
  
  if (config.exchanges.indexOf('cryptocompare') >= 0) {
    loadPriceCryptocompare(function (price) {
      prices.push(price);
    }, 0);
  }           

  if (config.exchanges.indexOf('coinmarketcap') >= 0) {
    loadPriceCoinMarketCap(function (price) {
      prices.push(price);
    }, 0);
  }

  // Publish the average of all markets that were loaded
  setTimeout(function() {
    if (prices.length == 0) {
      log("no prices found.");
      return;
    }   
    // avoid NaN messes up the result
    const price = prices.filter(v => !isNaN(v)).reduce((t, v) => t + v, 0) / prices.length;
    console.log(prices);
    log("Price = " + price);
    publishFeed(price, 0); 
  }, config.feed_publish_interval * 1000);
}

function publishFeed(price, retries) {
  const peg_multi = config.peg_multi ? config.peg_multi : 1;
  const exchange_rate = { 
    base: price.toFixed(3) + ' SBD', 
    quote: (1 / peg_multi).toFixed(3) + ' STEEM' 
  };

  log('Broadcasting feed_publish transaction: ' + JSON.stringify(exchange_rate));

  steem.broadcast.feedPublish(get_active_key(), get_account_name(), exchange_rate, function (err, result) {
    if (result && !err) {
      log('Broadcast successful!');
    } else {
      log('Error broadcasting feed_publish transaction: ' + err);

      if (retries % config.feed_publish_fail_retry == 0) {
        failover();
      }

      setTimeout(function () { 
        publishFeed(price, retries + 1);
      }, config.retry_interval * 1000);
    }
  });
}

function loadPriceCoinMarketCap(callback, retries) {
  // Load STEEM price in USD directly from CoinMarketCap

  api_key = get_coinmarketcap_api_key();
  if (!api_key) {
    console.log("coinmarketcap_api_key not set in config.json or environment");
    process.exit(1);
  }

  request.get('https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest?symbol=STEEM&CMC_PRO_API_KEY=' + api_key, function (e, r, data) {
    if (e) {
        log(e);
        log(r.statusCode);
        return;
    }
    try {
      const steem_price = parseFloat(JSON.parse(data).data.STEEM[0].quote.USD.price);
      log('Loaded STEEM Price from CoinMarketCap: ' + steem_price);

      if (callback) {
        callback(steem_price);
      }
    } catch (err) {
      log('Error loading STEEM price from CoinMarketCap: ' + err);

      if(retries <= config.price_feed_max_retry) {
        setTimeout(function () { 
          loadPriceCoinMarketCap(callback, retries + 1); 
        }, config.retry_interval * 1000);
      }
    }
  });
}

function loadPriceCryptocompare(callback, retries) {
  // Load STEEM price in USD directly from CryptoCompare
  request.get('https://min-api.cryptocompare.com/data/price?fsym=STEEM&tsyms=USDT', function (e, r, data) {
    if (e) {
        log(e);
        log(r.statusCode);
        return;
    }      
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
  // Load STEEM price in USD directly from CoinGecko
  request.get('https://api.coingecko.com/api/v3/simple/price?ids=steem&vs_currencies=usd', function (e, r, data) {
    if (e) {
        log(e);
        log(r.statusCode);
        return;
    }
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

function loadPriceCloudflare(callback, retries) {
  // Load STEEM price
  request.get('https://ticker.justyy.com/query/?s=STEEM+USDT', function (e, r, data) {
    if (e) {
        log(e);
        log(r.statusCode);
        return;
    }      
    try {
      const json_data = JSON.parse(data);
      const arr = json_data.result[0].split(' ')
      const steem_price = parseFloat(arr[3]); 
      log('Loaded STEEM Price from Cloudflare: ' + steem_price);

      if (callback) {
        callback(steem_price);
      }
    } catch (err) {
      log('Error loading STEEM price from Cloudflare: ' + err);

      if (retries <= config.price_feed_max_retry) {
        setTimeout(function () { 
          loadPriceCloudflare(callback, retries + 1);
        }, config.retry_interval * 1000);
      }
    }
  });
}

function loadPriceSlowApi(callback, retries) {
  // Load STEEM price
  request.get('https://slowapi.com/api/yf/', function (e, r, data) {
    if (e) {
        log(e);
        log(r.statusCode);
        return;
    }
    try {
      const json_data = JSON.parse(data);
      const steem_price = json_data.data["STEEM-USD"]["regularMarketPrice"];
      log('Loaded STEEM Price from SlowAPI: ' + steem_price);

      if (callback) {
        callback(steem_price);
      }
    } catch (err) {
      log('Error loading STEEM price from SlowAPI: ' + err);

      if (retries <= config.price_feed_max_retry) {
        setTimeout(function () { 
          loadPriceSlowApi(callback, retries + 1); 
        }, config.retry_interval * 1000);
      }
    }
  });
}

function failover() {
  if (config.rpc_nodes && config.rpc_nodes.length > 1) {
    let cur_node_index = config.rpc_nodes.indexOf(steem.api.options.url) + 1;

    if (cur_node_index == config.rpc_nodes.length) {
      cur_node_index = 0;
    }

    const rpc_node = config.rpc_nodes[cur_node_index];

    steem.api.setOptions({ transport: 'http', uri: rpc_node, url: rpc_node });
    log('***********************************************');
    log('Failing over to: ' + rpc_node);
    log('***********************************************');
  }
}

setInterval(startProcess, config.interval * 60 * 1000);
startProcess();
