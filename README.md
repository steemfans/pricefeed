# Steem Witness Price Feed Publishing Tool

![image](https://user-images.githubusercontent.com/1764434/173547905-6366f5eb-22dc-4327-bbda-6a4cc4cd3b96.png)

This fork of [@justyy's version](https://github.com/DoctorLai/pricefeed) adds CoinMarketCap support, removes exchanges in favour of aggregators, and fixes a small retry bug.

## Install nodejs & npm (Ubuntu 20.04+)
If you already have nodejs & npm installed you can skip this section, but I wanted to include it here for thoroughness. Run the following commands to install nodejs and npm in order to run the pricefeed software:

```
$ sudo apt-get update
$ sudo apt-get install -y nodejs npm
```

## Setup & Installation
Clone the project repo into the "pricefeed" directory and install using NPM:

```
$ git clone https://github.com/rexthetech/pricefeed.git pricefeed
$ cd pricefeed
$ npm install
```

Update the config.json file with your witness account name and private active key as described in the Configuration section below. Alternative, you can set account and private key in environment variables. 

### Run in background with PM2
I suggest using the PM2 software to manage and run your nodejs programs in the background. Use the following commands to install PM2 and run the pricefeed program:

```
$ sudo npm install pm2 -g
$ pm2 start feed.js
$ pm2 logs feed
$ pm2 save
```

If everything worked you should not see any errors in the logs and a price feed transaction should have been published to your account.

### Run in Docker
If you prefer using Docker, use the following commands:

```
# build your own docker image
docker build -t pricefeed .

# edit config.json and run container
docker run -itd \
    --name pricefeed \
    -v $(pwd)/config.json:/app/config.json \
    pricefeed

# Check the status with docker logs
docker logs pricefeed
```

## Configuration
List of STEEM RPC nodes to use:
```
{
  "rpc_nodes": [
    "https://api.steemit.com",
    "https://steemapi.boylikegirl.club",
    "https://api.steemzzang.com",
    "https://steem.ecosynthesizer.com",
    "https://api.wherein.io",
    "https://api.dlike.io",
    "https://api.steem-fanbase.com",
    "https://api.steemitdev.com",
    "https://api.justyy.com"
  ],
  "feed_steem_account": "",                            // Name of your Steem witness account - if left empty, then should be set in env.
  "feed_steem_active_key": "",		                   // Private active key of your Steem witness account - if left empty, then should be set in env.
  "coinmarketcap_api_key": "",		                   // API key for CoinMarketCap; required if using "coinmarketcap" in exchange list below. Set in env if empty.
  "exchanges": ["cloudflare", "coingecko", "cryptocompare", "coinmarketcap"],  // List of exchanges to use. Will publish an average of all exchanges in the list.
  "interval": 60,									   // Number of minutes between feed publishes
  "feed_publish_interval": 30,                         // Feed published after 30 seconds of price feed
  "feed_publish_fail_retry": 5,                        // RPC node fail over to next after 5 retries
  "price_feed_max_retry": 5,                           // Max retry for Price Feed API
  "retry_interval": 10,                                // Retry interval 10 seconds
  "peg_multi": 1									   // Feed bias setting, quote will be set to 1 / peg_multi
}
```
