const bsv = require('bsv')
const api = require('./api')
const bitsocket = require('./bitsocket')

// Use built-in all fallback to bsv Buffer
const _Buffer = typeof Buffer === 'function' ? Buffer : bsv.deps.Buffer;

const DUST_LIMIT = 547;

const defaults = {
  inputs: [],
  outpus: [],
  onCreate() { this.listen() },
  onFunded() { this.broadcast() },
  onPayment(tx) { console.log('Success', tx) },
  onError(err) { console.error('Error', err) },
  debug: false
}

class ProxyPayment {
  constructor(options) {
    this.options = {
      ...defaults,
      ...options
    }

    if (typeof this.options.key === 'string') {
      this.privKey = new bsv.PrivateKey(this.options.key)
    } else {
      this.privKey = this.options.key
    }

    if (typeof this.privKey !== 'object' || !Object.keys(this.privKey).includes('publicKey') ) {
      throw new Error('Must initiate ProxyPayment with valid private key')
    }

    this.tx = new bsv.Transaction()
    this.tx.change(this.options.changeAddress || this.address)
    this.fee = 0;

    this.addOutput(this.options.outputs);
    this.addInput(this.options.inputs);
    this.estimateFee()

    this.onCreate   = this.options.onCreate;
    this.onFunded   = this.options.onFunded;
    this.onPayment  = this.options.onPayment;
    this.onError    = this.options.onError;

    this.onCreate()
  }

  get address() {
    return this.privKey.toAddress().toString()
  }

  get bip21URI() {
    const amount = this.requiredSatoshis / 100000000;
    return `bitcoin:${ this.address }?sv&amount=${ amount }`;
  }

  get totalSatoshis() {
    this.tx._getOutputAmount()
    const amount = this.fee + (this.tx._outputAmount || 0)
    return Math.max(amount, DUST_LIMIT)
  }

  get requiredSatoshis() {
    this.tx._getInputAmount()
    const amount = this.totalSatoshis - (this.tx._inputAmount || 0)
    return amount > 0 ? Math.max(amount, DUST_LIMIT) : 0
  }

  get fundedSatoshis() {
    this.tx._getInputAmount()
    return this.tx._outputAmount
  }

  get isFunded() {
    return this.requiredSatoshis <= 0;
  }

  listen() {
    this.openSocket()
    this.socket.onmessage = e => {
      const msg = JSON.parse(e.data)
      msg.data.forEach(tx => {
        if (this.options.debug) console.log('Tx:', tx);

        tx.out.filter(o => o.e.a === this.address)
          .map(o => {
            const str = `OP_DUP OP_HASH160 ${ o.h2 } OP_EQUALVERIFY OP_CHECKSIG`
            return {
              txId: tx.tx.h,
              outputIndex: o.i,
              satoshis: o.e.v,
              script: bsv.Script.fromASM(str)
            }
          })
          .some(o => {
            this.addInput(o)
            this.estimateFee()
            return this.isFunded;
          })
        if (this.isFunded) {
          this.onFunded()
        }
      })
    }
  }

  openSocket() {
    if (!this.socket || this.socket.readyState === 2) {
      this.socket = bitsocket.listen(this.address, this.fee)
    }
    if (this.options.debug) console.log('Open:', this.socket.url);
    return this;
  }

  closeSocket() {
    if (this.socket) {
      this.socket.close()
      if (this.options.debug) console.log('Close:', this.socket.url);
    }
    return this;
  }

  getUtxo() {
    return api.getUtxo(this.address)
      .then(utxos => {
        if (this.options.debug) console.log('Utxos:', utxos);

        utxos.some(utxo => {
          this.addInput(utxo)
          this.estimateFee()
          return this.isFunded;
        })
        if (this.isFunded) {
          return this.onFunded()
        } else {
          return this;
        }
      })
      .catch(err => {
        this.onError(err)
      })
  }

  broadcast() {
    if (this.options.debug) console.log('Broadcasting');

    this.tx.sign(this.privKey)

    return api.broadcastTx(this.tx)
      .then(tx => {
        this.closeSocket()
        this.onPayment(tx)
        return tx;
      })
      .catch(err => {
        this.closeSocket()
        this.onError(err)
      })
  }

  addInput(input) {
    if (Array.isArray(input)) {
      return input.forEach(i => this.addInput(i));
    } else if (input.constructor.name !== 'UnspentOutput') {
      input = bsv.Transaction.UnspentOutput(input)
    }
    this.tx.from(input)
    this.estimateFee()
  }

  addOutput(output) {
    if (Array.isArray(output)) {
      return output.forEach(o => this.addOutput(o));
    } else if (output.constructor.name !== 'Output') {
      output = this._buildOutput(output)
    }
    this.tx.addOutput(output)
    this.estimateFee()
  }

  estimateFee() {
    if (this.tx.inputs.length === 0) {
      // Templorarily add input to calculate fee
      this.addInput({
        txId: '0000000000000000000000000000000000000000000000000000000000000000',
        outputIndex: 0,
        satoshis: 1000000,
        script: bsv.Script.fromASM('OP_DUP OP_HASH160 ac1c7026fcae37df56f09082ddb3b83de8dd169e OP_EQUALVERIFY OP_CHECKSIG')
      })
      this.fee = this.tx._estimateFee()
      this.tx.inputs = []
      this.tx._inputAmount = undefined
      this.tx._updateChangeOutput()
    } else {
      this.fee = this.tx._estimateFee()
    }
    this.tx.fee(this.fee)
    return this.fee
  }

  sweep(address) {
    const changeAddress = address || this.options.changeAddress;
    if (!changeAddress) throw new Error('Must provide an address to sweep to');
    
    return api.getUtxo(this.address)
      .then(utxos => {
        const tx = new bsv.Transaction()
          .from(utxos)
          .change(changeAddress)

        const fee = tx._estimateFee()
        tx.fee(fee).sign(this.privKey)
        return api.broadcastTx(tx)
      })
      .then(tx => {
        this.closeSocket()
        this.onPayment(tx)
        return tx;
      })
      .catch(err => {
        this.closeSocket()
        this.onError(err)
      })
  }

  _buildOutput(attrs) {
    let script;
    if (attrs.script) {
      script = attrs.script
    } else if (attrs.data) {
      script = this._buildScript(attrs.data)
    } else {
      script = bsv.Script(bsv.Address(attrs.to))
    }

    return new bsv.Transaction.Output({
      script,
      satoshis: attrs.satoshis || 0
    })
  }

  _buildScript(data) {
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
    return script;
  }
}

module.exports = ProxyPayment