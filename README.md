StudLoop
========

Studapp backend using StrongLoop's LoopBack node framework


### Installation

1. Install dependencies: `npm install`

2. Duplicate *(NOT just rename for versionning purpose)* `google-config-example.json` into `google-config.json`

3. Fill `google-config.json`with your credentials (Get them at [Google Developer Console](https://console.developers.google.com/))

4. Do the same 2 steps above with `datasource-example.json`

5. Download the private key file `your-key.p12` *(still from google)*

6. Node does not support PKCS12 key-files so we must convert the key `openssl pkcs12 -in your-key.p12 -nodes -nocerts > key.pem`

7. Put the resulting `key.pem` file in `server/`or wherever you choose. Be sure to update `google-config.json` accordingly. **Don't forget to store the private key securely**


### Launch

Start the server with `slc run`
