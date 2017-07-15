const rp = require('request-promise')
const crypto = require('crypto')
const BASE_TIMEOUT = 15000

function passThrough (d) { return d }

class Rest2 {
  constructor (key, secret, opts = {}) {
    this.url = 'https://api.bitfinex.com/'
    this.version = 'v2'
    this.key = key
    this.secret = secret
    this.nonce = new Date().getTime()
    this.generateNonce = (typeof opts.nonceGenerator === 'function')
      ? opts.nonceGenerator
      : function () {
        // noinspection JSPotentiallyInvalidUsageOfThis
        return Date.now()//++this.nonce
      }

    this.transformer = opts.transformer || passThrough
  }

  genericCallback (err, result) {
    console.log(err, result)
  }

  makeAuthRequest (path, payload = {}, cb = this.genericCallback) {
    if (!this.key || !this.secret) {
      return cb(new Error('missing api key or secret'))
    }
    const url = `${this.url}${this.version}/${path}`
    const nonce = JSON.stringify(this.generateNonce())
    const rawBody = JSON.stringify(payload)

    const signature = crypto
      .createHmac('sha384', this.secret)
      .update(`/api/${url}${nonce}${rawBody}`)
      .digest('hex')

    return rp({
      url,
      method: 'POST',
      headers: {
        'bfx-nonce': nonce,
        'bfx-apikey': this.key,
        'bfx-signature': signature
      },
      json: true,
      body: payload
    })
    .then((result) => {
      if (result[0] === 'error') {
        throw new Error(JSON.stringify(result));
      }
      if (cb) {
        cb(null, result)
      }
      return result
    })
    .catch((error) => {
      if (cb) {
        cb(error)
      }
      throw error
    })
  }

  makePublicRequest (name, cb = this.genericCallback.bind(this)) {
    const url = `${this.url}${this.version}/${name}`
    return rp({
      url,
      method: 'GET',
      timeout: BASE_TIMEOUT,
      json: true
    })
    .then((response) => {
      if (response[0] === 'error') {
        throw new Error(JSON.stringify(response));
      }
      return this.transform(response, name)
    })
    .then((result) => {
      if (cb) {
        cb(null, result)
      }
      return result
    })
    .catch((error) => {
      if (cb) {
        cb(error)
      }
      throw error
    })
  }

  transform (result, name) {
    let n = {}

    if (this.transformer.normalize) {
      n = this.transformer.normalize(name)
    }

    return this.transformer(result, n.type, n.symbol)
  }

  // Public endpoints

  ticker (symbol = 'tBTCUSD', cb) {
    return this.makePublicRequest(`ticker/${symbol}`, cb)
  }

  tickers (symbols = '', cb) {
    return this.makePublicRequest(`tickers?symbols=${symbols}`, cb)
  }

  orderBook (symbol = '', precision = 'P0', limit = 25, cb) {
    return this.makePublicRequest(`book/${symbol}/${precision}?len=${limit}`, cb)
  }

  trades (symbol = 'tBTCUSD', limit = 120, cb) {
    return this.makePublicRequest(`trades/${symbol}/hist?limit=${limit}`, cb)
  }

  stats (key = 'pos.size:1m:tBTCUSD:long', context = 'hist', cb) {
    return this.makePublicRequest(`stats1/${key}/${context}`, cb)
  }

  // timeframes: '1m', '5m', '15m', '30m', '1h', '3h', '6h', '12h', '1D', '7D', '14D', '1M'
  // sections: 'last', 'hist'
  // note: query params can be added: see
  // http://docs.bitfinex.com/v2/reference#rest-public-candles
  candles ({timeframe = '1m', symbol = 'tBTCUSD', section = 'hist'}, cb) {
    return this.makePublicRequest(`stats1/trade:${timeframe}:${symbol}/${section}`, cb)
  }

  // TODO
  // - Trades
  // - Books

  // Auth endpoints

  alertList (type = 'price', cb) {
    return this.makeAuthRequest(`auth/r/alerts?type=${type}`, null, cb)
  }

  alertSet (type = 'price', symbol = 'tBTCUSD', price = 0) {
    return this.makeAuthRequest(`auth/w/alert/set`, {type, symbol, price})
  }

  alertDelete (symbol = 'tBTCUSD', price = 0) {
    return this.makeAuthRequest(`auth/w/alert/set`, {symbol, price})
  }

  orders (cb) {
    return this.makeAuthRequest(`auth/r/orders`, null, cb)
  }

  wallets (cb) {
    return this.makeAuthRequest(`auth/r/wallets`, null, cb)
  }

  // TODO
  // - Wallets
  // - Orders
  // - Order Trades
  // - Positions
  // - Offers
  // - Margin Info
  // - Funding Info
  // - Performance
  // - Calc Available Balance
}

module.exports = Rest2
