const fetch = require('node-fetch')

const baseUrl = 'https://api.bitindex.network/api/v3/main',
      apiKey  = '3W8siQamFDrwY8VbgM8cX9RXKwcUGqAxhDMd4AyoaGGtTNQhDx25a4xsVFkKv4vkN7',
      headers = { api_key: apiKey };

const bitindex = {

  getUtxo(addr) {
    const url = baseUrl + `/addr/${ addr }/utxo`;

    return fetch(url, { headers })
      .then(r => r.json())
      // Sort UTXO by confirmations then vout index
      .then(data => {
        return data.sort((a, b) => {
          if (a.confirmations === b.confirmations) {
            return a.vout - b.vout;
          } else {
            return b.confirmations - a.confirmations;
          }
        })
      })
      .catch(err => {
        throw new Error(err.response.data.message)
      })
  },

  broadcastTx(tx) {
    const url   = baseUrl + '/tx/send',
          rawtx = tx.toString(),
          body  = JSON.stringify({ rawtx });

    return fetch(url, { body, headers })
      .then(r => r.json())
      .catch(err => {
        const error = err.response.data.message;
        const msg = error.message
          .split('\n')
          .slice(0, -1)
          .join(' ')
        throw new Error(msg)
      })
  }

}

module.exports = bitindex