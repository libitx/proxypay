const ProxyPayment = require('./proxy-payment')

module.exports = (opts) => {
  return new ProxyPayment(opts)
}
