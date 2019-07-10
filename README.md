# Proxypay

Proxypay is a library for building complex transaction types which can be broadcasted to the Bitcoin SV blockchain by sending a simple payment from **any** wallet.

* [View demo](https://libitx.github.io/proxypay)

### How is Proxypay different from Datapay?

Where the Datapay library requires the use of a private key already funded with a sufficient balance in order to broadcast the transaction, Proxypay excels when used with single-purpose, un-funded private keys.

Proxypay effectively creates an un-funded proxy transaction. Users can then fund the proxy transaction by sending a simple payment from their own wallet to the address of the private key, and as if by magic the proxy transaction will broadcast itself.

### Why send transactions this way?

Proxypay allows BSV app developers to offer their users ways to fund complex and exotic transaction types from **any wallet**. It completely negates the need for Fat URI schemes as BIP21 URIs and QR codes can be used for all use cases.

This approach allows funding wallets to be kept completely separate. As we begin building for the Metanet, Proxypay enables developers to create Metanet node structures and address chains, without having to worry about complex UTXO management.

## Getting started

Install Proxypay using `npm` or `yarn`:

```bash
npm install proxypay
# or
yarn add proxypay
```

 Include Proxypay into your NodeJS or HTML project:
 
 ```javascript
import proxypay from 'proxypay'
```

... or in a browser:

```html
<script src="https://unpkg.com/proxypay/dist/proxypay.min.js"></script>
```

Note that Proxypay has a peer dependency on the `bsv` library which must also be available in your project.

### Usage

Proxypay lets you build a transaction in a declarative manner. The config syntax is closer to Money Button's approach than Datapay's.

```javascript
const payment = proxypay({
  key: 'L4vbW6A87f6VUUzRSCmthSvrr2AcAYntBUqorm45358QcAVvMGRe',
  outputs: [
    { data: ['testing', 'proxypay'] }
  ]
})
console.log(`Please send ${ payment.fee } satoshis to ${ payment.address }`)
console.log(payment.bip21URI)
```

The above example will wait for the correct fee to be sent to the private key's corresponding address (`1PmbHb8d86FxaPmCtpHeFBCWebNimg8PcC`), and once received will automatically broadcast the transaction.

### Output syntax

The `outputs` configuration allows many outputs to be defined in a flexible manner:

```javascript
proxypay({
  key: 'L4vbW6A87f6VUUzRSCmthSvrr2AcAYntBUqorm45358QcAVvMGRe',
  outputs: [
      // Simple payment outputs
    { to: address1, satoshis: 5000 },
    { to: address2, satoshis: 12000 },
    // Data array automatically compiled to OP_RETURN script
    { data: ['foo', 'bar', 'baz'] },
    // Raw bsv.Script instance
    { script: bsv.Script('...') },
  ]
}
```

### Proxypay hooks

Each Proxypay instance runs a series of functions called lifecycle hooks. These functions can be overridden to customise the behaviour of Proxypay:

```javascript
proxypay({
  key: 'L4vbW6A87f6VUUzRSCmthSvrr2AcAYntBUqorm45358QcAVvMGRe',
  outputs: [
    { data: ['testing', 'proxypay'] }
  ],
  // Default lifecycle hooks
  onCreate() { this.listen() },
  onFunded() { this.broadcast() },
  onPayment(tx) { console.log('Success', tx) },
  onError(err) { console.error('Error', err) }
}
```

For example, if you know the private key is already funded with sufficient balance, you can make Proxypay behave like Datapay and instantly broadcast the transaction by overriding the `onCreate()` method:

```javascript
proxypay({
  key: 'L4vbW6A87f6VUUzRSCmthSvrr2AcAYntBUqorm45358QcAVvMGRe',
  outputs: [
    { data: ['testing', 'proxypay'] }
  ],
  onCreate() { this.getUtxo() }
}
```

### Proxypay instance attributes and methods

```javascript
const payment = proxypay(config)

// Attributes
payment.address   // Address to fund
payment.fee       // Satoshis needed to fund tx
payment.bip21URI  // Full bip21 URI
payment.isFunded  // Boolean

// Methods
payment.listen()        // Opens websocket and listens for incoming UTXO
payment.getUtxo()       // Fetch all UTXO for the address
                        // Both methods above fire `onFunded` when funded
payment.broadcast()     // Broadcast transaction
                        // Fires either `onPayment` or `onError`
payment.sweep(address)  // Sweep UTXO back to another address

payment.addInput(input)
payment.addOutput(output)
payment.estimateFee()
payment.closeSocket()
```

## Design defensively

As Proxypay is handling users' money, and as it relies on third party services, developers should design systems defensively so that if anything goes wrong, users have a way to recover any funds.

The `.getUtxo()` and `.sweep()` functions are there for your benefit.

## License

Proxypay is open source and released under the [MIT License](LICENSE.md).

Copyright (c) 2019 libitx.
