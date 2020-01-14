const fetch = require('node-fetch')

const baseUrl = 'https://api.mattercloud.net/api/v3/main',
      headers = { 'Content-Type': 'application/json' };

const api = {

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

    return fetch(url, { method: 'POST', headers, body })
      .then(r => {
        const data = r.json()
        if (!r.ok) {
          return data.then(err => {
            const msg = err.message.message
              .split('\n')
              .slice(0, -1)
              .join(' ')
            throw new Error(msg)
          })
        }
        return data
      })
  }

}

module.exports = api