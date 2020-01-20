const fs = require('fs')
const bsv = require('bsv')
const { assert } = require('chai')
const nock = require('nock')
const EventMock = require('eventsourcemock')
const proxypay = require('../src/index')
const bitsocket = require('../src/bitsocket')

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
    assert.equal(payment.tx.constructor.name, 'Transaction')
    assert.equal(payment.tx.inputs.length, 0)
    assert.equal(payment.tx.outputs.length, 1)
  })

  it('must have an address and BIP21 URI', () => {
    assert.equal(payment.address, '1ML7LKjt3MMsZWVeuVbUZqoLCezqdAFW9e')
    assert.equal(payment.bip21URI, 'bitcoin:1ML7LKjt3MMsZWVeuVbUZqoLCezqdAFW9e?sv&amount=0.00000547')
  })

  it('must show total and required satoshis', () => {
    assert.equal(payment.fee, 210)
    assert.equal(payment.totalSatoshis, 547)
    assert.equal(payment.requiredSatoshis, 547)
    assert.equal(payment.isFunded, false)
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
      assert.equal(payment.tx.inputs.length, 1)
      assert.equal(payment.tx.outputs.length, 1)
    })

    it('must show total and required satoshis', () => {
      assert.equal(payment.fee, 176)
      assert.equal(payment.totalSatoshis, 547)
      assert.equal(payment.requiredSatoshis, 0)
      assert.equal(payment.isFunded, true)
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
      assert.equal(payment.tx.inputs.length, 1)
      assert.equal(payment.tx.outputs.length, 2)
    })

    it('must show total and required satoshis', () => {
      assert.equal(payment.fee, 210)
      assert.equal(payment.totalSatoshis, 1500)
      assert.equal(payment.requiredSatoshis, 0)
      assert.equal(payment.isFunded, true)
    })
  })

  describe('with additional payment', () => {
    beforeEach(() => {
      payment.addOutput({ to: '1NbL18PU1r3kjVzLzh44Hkuj6nc36RBZ8Z', satoshis: 5000 })
    })

    it('must have an input', () => {
      assert.equal(payment.tx.inputs.length, 0)
      assert.equal(payment.tx.outputs.length, 2)
    })

    it('must show total and required satoshis', () => {
      assert.equal(payment.fee, 244)
      assert.equal(payment.totalSatoshis, 5244)
      assert.equal(payment.requiredSatoshis, 5244)
      assert.equal(payment.isFunded, false)
    })
  })

  describe('.getUtxo()', () => {
    beforeEach(() => {
      nock('https://api.mattercloud.net')
        .get('/api/v3/main/addr/1ML7LKjt3MMsZWVeuVbUZqoLCezqdAFW9e/utxo')
        .replyWithFile(200, __dirname + '/mocks/getutxo1.json', { 'Content-Type': 'application/json' })
    })

    it('must fetch utxo from server', async () => {
      await payment.getUtxo()
      assert.equal(payment.tx.inputs.length, 1)
      assert.equal(payment.tx.outputs.length, 2)
      assert.isTrue(payment.isFunded)
    })
  })

  describe('.listen()', () => {
    bitsocket.EventSource = EventMock.default
    const sources = EventMock.sources
    const url = 'https://txo.bitsocket.network/s/eyJ2IjozLCJxIjp7ImZpbmQiOnsib3V0LmUuYSI6IjFNTDdMS2p0M01Nc1pXVmV1VmJVWnFvTENlenFkQUZXOWUifX19'
    
    beforeEach(() => {
      payment.listen()
      sources[url].emitMessage({
        data: fs.readFileSync(__dirname + '/mocks/listen1.json', 'utf8')
      })
    })

    it('must fetch utxo from server', () => {
      assert.equal(payment.tx.inputs.length, 1)
      assert.equal(payment.tx._inputAmount, 1300)
      assert.equal(payment.tx.outputs.length, 2)
      assert.isTrue(payment.isFunded)
    })
  })
})
