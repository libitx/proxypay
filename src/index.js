import bsv from 'bsv'
import axios from 'axios'
import energy from 'energy'

import embed from './ui/embed'


// Constants
const DUST_LIMIT = 546 + 1;


// Define client
const api = axios.create({
  baseURL: 'http://localhost:4000/api/',
  headers: {
    'accept': 'application/json',
    'content-type': 'application/json; charset=utf-8'
  }
})


// Proxypay default options
const defaults = {
  inputs: [],
  outputs: [],
  debug: false
}


/**
 * TODO
 */
class Proxypay {
  /**
   * TODO
   */
  constructor(options) {
    // Build options
    this.options = {
      ...defaults,
      ...options
    }

    // Set private key
    if (typeof this.options.key === 'string') {
      this.privKey = new bsv.PrivateKey(options.key)
    } else {
      this.privKey = options.key
    }

    // Validate private key
    if (this.privKey.constructor !== bsv.PrivateKey) {
      throw new Error('Must initiate ProxyPayment with valid private key')
    }

    // Setup
    this.$events = energy()
    this.invoice = null
    this.fee = 0

    // Build the tx
    this.tx = new bsv.Transaction()
    this.tx.change(this.options.changeAddress || this.address)
    this.addOutput(this.options.outputs)
    this.addInput(this.options.inputs)

    this._debug('Proxypay', this.address, { inputs: this.inputs, outputs: this.outputs })
  }

  /**
   * TODO
   */
  static create(options) {
    const payment = new this(options)
    payment.createInvoice()
    return payment
  }

  /**
   * TODO
   */
  static load(id, options) {
    const payment = new this(options)
    payment.loadInvoice(id)
    return payment
  }

  /**
   * TODO
   */
  get address() {
    return this.privKey.toAddress().toString()
  }

  /**
   * TODO
   */
  get satoshis() {
    this.tx._getOutputAmount()
    const amount = this.fee + (this.tx._outputAmount || 0)
    return Math.max(amount, DUST_LIMIT)
  }

  /**
   * TODO
   */
  get remainingSatoshis() {
    this.tx._getInputAmount()
    const amount = this.satoshis - (this.tx._inputAmount || 0)
    return amount > 0 ? Math.max(amount, DUST_LIMIT) : 0
  }

  /**
   * TODO
   */
  get script() {
    // TODO - support additional script types
    return bsv.Script.fromAddress(this.address).toHex()
  }

  /**
   * TODO
   */
  addInput(input) {
    if (Array.isArray(input)) {
      return input.forEach(i => this.addInput(i));
    } else if (input.constructor.name !== 'UnspentOutput') {
      input = bsv.Transaction.UnspentOutput(input)
    }
    this.tx.from(input)
    this.estimateFee()
    return this
  }

  /**
   * TODO
   */
  addOutput(output) {
    if (Array.isArray(output)) {
      return output.forEach(o => this.addOutput(o));
    } else if (output.constructor.name !== 'Output') {
      output = buildOutput(output)
    }
    this.tx.addOutput(output)
    this.estimateFee()
    return this
  }

  /**
   * TODO
   */
  estimateFee() {
    if (this.tx.inputs.length === 0) {
      // Templorarily add input to calculate fee
      this.addInput({
        txId: '0000000000000000000000000000000000000000000000000000000000000000',
        outputIndex: 0,
        satoshis: 100000000,
        script: bsv.Script.fromASM('OP_DUP OP_HASH160 0000000000000000000000000000000000000000 OP_EQUALVERIFY OP_CHECKSIG')
      })
      this.fee = this.tx._estimateFee()
      this.tx.inputs = []
      this.tx._inputAmount = undefined
      this.tx._updateChangeOutput()
    } else {
      this.fee = this.tx._estimateFee()
    }
    this.tx.fee(this.fee)
    return this
  }

  /**
   * TODO
   */
  createInvoice() {
    const invoice = {
      satoshis: this.remainingSatoshis,
      script: this.script,
      description: this.options.description
    }

    this._debug('Creating invoice', invoice)
    api.post('/invoices', { invoice })
      .then(({ data }) => {
        this._debug('Created invoice', data.data)
        this.invoice = data.data
        this.$events.emit('invoice', this.invoice)
      })
      .catch(err => {
        this.$events.emit('error', err)
      })
    
    return this
  }


  /**
   * TODO
   */
  loadInvoice(invoiceId) {
    this._debug('Loading invoice', invoiceId)
    api.get(`/invoices/${ invoiceId }`)
      .then(({ data }) => {
        this._debug('Loaded invoice', data.data)
        this.invoice = data.data
        this.$events.emit('invoice', this.invoice)
      })
      .catch(err => {
        this.$events.emit('error', err)
      })
    
    return this
  }

  /**
   * TODO
   */
  mount(el) {
    window.addEventListener('message', event => {
      if (event.origin === 'http://82.71.13.158:4000' && !!event.data.payload) {
        this.handleMessage(event.data)
      }
    }, false)

    el.mount(this)
      .then(ui => {
        this._debug('Proxypay mounted', ui)
        this.$ui = ui
        this.postMessage('handshake')
        this.postMessage('configure', this.$ui.options)
      })
      .catch(err => {
        this.$events.emit('error', err)
      })

    return this
  }

  postMessage(event, payload) {
    if (!this.$ui) return;
    this.$ui.$iframe.contentWindow.postMessage({
      event,
      payload
    }, 'http://82.71.13.158:4000')
  }

  handleMessage({event, payload}) {
    this._debug('Iframe msg', event, payload)
    switch(event) {
      case 'resize':
        const { height } = payload
        this.$ui.$iframe.style.height = height + 'px'
        break
    }
  }

  /**
   * TODO
   */
  on(event, callback) {
    this.$events.on(event, callback)
    return this
  }

  /**
   * TODO
   */
  once(event, callback) {
    this.$events.once(event, callback)
    return this
  }
 
  /**
   * TODO
   */
  _debug(...args) {
    if (this.options.debug) {
      console.log(...args)
    }
  }
}


/**
 * TODO
 */
const buildOutput = function(attrs) {
  let script;
  if (attrs.script) {
    script = attrs.script
  } else if (attrs.data) {
    script = buildScript(attrs.data)
  } else {
    script = bsv.Script(bsv.Address(attrs.to))
  }

  return new bsv.Transaction.Output({
    script,
    satoshis: attrs.satoshis || 0
  })
}

/**
 * TODO
 */
const buildScript = function(data) {
  const script = new bsv.Script()
  script.add(bsv.Opcode.OP_RETURN)
  data.forEach(item => {
    // Hex string
    if (typeof item === 'string' && /^0x/i.test(item)) {
      script.add(_Buffer.from(item.slice(2), 'hex'))
    // Opcode number
    } else if (typeof item === 'number' || item === null) {
      script.add(item || 0)
    // Opcode
    } else if (typeof item === 'object' && item.hasOwnProperty('op')) {
      script.add({ opcodenum: item.op })
    // All else
    } else {
      script.add(_Buffer.from(item))
    }
  })
  return script
}

/**
 * TODO
 */
export { Proxypay, embed }