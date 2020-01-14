const EventSource = require('eventsource') 

const bitsocket = {
  EventSource,
  url: 'https://txo.bitsocket.network/s/',

  listen(address, amount) {
    const query = {
      v: 3,
      q: {
        find: {
          "out.e.a": address
        }
      }
    }
    const url = this.url + this._encodeQuery(query);
    return new this.EventSource(url)
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

module.exports = bitsocket