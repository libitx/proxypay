const EventSource = require('eventsource') 

const bitdb = {
  url: 'https://neongenesis.bitdb.network/s/1HcBPzWoKDL2FhCMbocQmLuFTYsiD73u1j/',

  listen(address, amount) {
    const query = {
      v: 3,
      q: {
        find: {
          "out.e.a": address,
          "out.e.v": amount
        }
      }
    }
    const url = this.url + this._encodeQuery(query);
    return new EventSource(url)
  },

  _encodeQuery(query) {
    const str = JSON.stringify(query);
    if (typeof btoa == 'function') {
      return btoa(str);
    } else {
      return Buffer.from(str).toString('base64');
    }
  }
}

module.exports = bitdb