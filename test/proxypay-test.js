const fs = require('fs')
const bsv = require('bsv')
const nock = require('nock')
const EventMock = require('eventsourcemock')
const proxypay = require('../src/index')
const bitdb = require('../src/bitdb')

const key = 'L4JEtjzPy1uHdmDN4cV9K8WReWX2QaSYLEPzoZCmKRW6Hpe1zWgo'

describe('proxypay', () => {
  let payment;

  beforeEach(() => {
    payment = proxypay({
      key,
      outputs: [
        { data: ['foo', 'bar'] }
      ],
      onCreate() { null },
      onFunded() { null }
    })
  })

  it('must instantiate a transaction', () => {
    expect(payment.tx.constructor.name).toEqual('Transaction')
    expect(payment.tx.inputs.length).toEqual(0)
    expect(payment.tx.outputs.length).toEqual(1)
  })

  it('must have an address and BIP21 URI', () => {
    expect(payment.address).toEqual('1ML7LKjt3MMsZWVeuVbUZqoLCezqdAFW9e')
    expect(payment.bip21URI).toEqual('bitcoin:1ML7LKjt3MMsZWVeuVbUZqoLCezqdAFW9e?sv&amount=0.00000547')
  })

  it('must show total and required satoshis', () => {
    expect(payment.fee).toEqual(289)
    expect(payment.totalSatoshis).toEqual(289)
    expect(payment.requiredSatoshis).toEqual(547)
    expect(payment.isFunded).toEqual(false)
  })

  describe('with an exact input', () => {
    beforeEach(() => {
      payment.addInput({
        txId: '0000000000000000000000000000000000000000000000000000000000000000',
        outputIndex: 0,
        satoshis: 600,
        script: bsv.Script.fromASM('OP_DUP OP_HASH160 ac1c7026fcae37df56f09082ddb3b83de8dd169e OP_EQUALVERIFY OP_CHECKSIG')
      })
    })

    it('must have an input', () => {
      expect(payment.tx.inputs.length).toEqual(1)
      expect(payment.tx.outputs.length).toEqual(2)
    })

    it('must show total and required satoshis', () => {
      expect(payment.totalSatoshis).toEqual(289)
      expect(payment.requiredSatoshis).toEqual(0)
      expect(payment.isFunded).toEqual(true)
    })
  })

  describe('with an oversized input', () => {
    beforeEach(() => {
      payment.addInput({
        txId: '0000000000000000000000000000000000000000000000000000000000000000',
        outputIndex: 0,
        satoshis: 1500,
        script: bsv.Script.fromASM('OP_DUP OP_HASH160 ac1c7026fcae37df56f09082ddb3b83de8dd169e OP_EQUALVERIFY OP_CHECKSIG')
      })
    })

    it('must have an input', () => {
      expect(payment.tx.inputs.length).toEqual(1)
      expect(payment.tx.outputs.length).toEqual(2)
    })
  })

  describe('.getUtxo()', () => {
    beforeEach(() => {
      nock('https://api.bitindex.network')
        .get('/api/v3/main/addr/1ML7LKjt3MMsZWVeuVbUZqoLCezqdAFW9e/utxo')
        .replyWithFile(200, __dirname + '/mocks/getutxo1.json', { 'Content-Type': 'application/json' })
    })

    it('must fetch utxo from server', async next => {
      await payment.getUtxo()
      expect(payment.tx.inputs.length).toEqual(1)
      expect(payment.tx.outputs.length).toEqual(2)
      expect(payment.isFunded).toBe(true)
      next()
    })
  })

  describe('.listen()', () => {
    bitdb.EventSource = EventMock.default
    const sources = EventMock.sources
    const url = 'https://neongenesis.bitdb.network/s/1HcBPzWoKDL2FhCMbocQmLuFTYsiD73u1j/eyJ2IjozLCJxIjp7ImZpbmQiOnsib3V0LmUuYSI6IjFNTDdMS2p0M01Nc1pXVmV1VmJVWnFvTENlenFkQUZXOWUifX19'
    
    beforeEach(() => {
      payment.listen()
      sources[url].emitMessage({
        data: fs.readFileSync(__dirname + '/mocks/listen1.json', 'utf8')
      })
    })

    it('must fetch utxo from server', () => {
      expect(payment.tx.inputs.length).toEqual(1)
      expect(payment.tx._inputAmount).toEqual(1300)
      expect(payment.tx.outputs.length).toEqual(2)
      expect(payment.isFunded).toBe(true)
    })
  })
})
