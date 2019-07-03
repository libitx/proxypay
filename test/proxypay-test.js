const proxypay = require('../src/index')

const key = 'L4JEtjzPy1uHdmDN4cV9K8WReWX2QaSYLEPzoZCmKRW6Hpe1zWgo'

describe('proxypay', () => {
  const config = {
    key,
    outputs: [
      { data: ['foo', 'bar'] }
    ],
    onCreate() { null }
  }

  const payment = proxypay(config)

  it('must instantiate a transaction', () => {
    expect(payment.tx.constructor.name).toEqual('Transaction')
    expect(payment.tx.inputs.length).toEqual(0)
    expect(payment.tx.outputs.length).toEqual(2)
  })
})