const fetch = require('node-fetch');
const crypto = require("crypto")

const base64Encode = (str) => {
  return str.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

const sha256 = (buffer) => {
  return crypto.createHash('sha256').update(buffer).digest();
}

function parseJwt(token) {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
}

module.exports = function (RED) {
  function KyudaConfig(config) {
    RED.nodes.createNode(this, config);
    var node = this;

    node.triggerSource = async function (source_uid, payload) {
      var credentials = RED.nodes.getCredentials(node.id);

      const now = Date.now() / 1000;
      if (now < credentials.expirationDate) {
        await node.refreshToken();
        var credentials = RED.nodes.getCredentials(node.id);
      }

      return fetch(`https://api.kyuda.io/v1/flows-api/trigger-source`, {
        method: 'post',
        body: JSON.stringify({
          source_uid,
          event: payload,
          control: {}
        }),
        headers: { 'Authorization': `Bearer ${credentials.accessToken}` }
      })
        .then(response => response.json());
    }
    node.triggerPipeline = async function (pipeline_uid, payload) {
      var credentials = RED.nodes.getCredentials(node.id);

      const now = Date.now() / 1000;
      console.log(now)
      console.log(credentials.expirationDate)
      if (now < credentials.expirationDate) {
        await node.refreshToken();
        var credentials = RED.nodes.getCredentials(node.id);
      }

      return fetch(`https://api.kyuda.io/v1/flows-api/trigger-pipeline`, {
        method: 'post',
        body: JSON.stringify({
          pipeline_uid,
          source_uid: node.id,
          event: payload,
          control: {}
        }),
        headers: { 'Authorization': `Bearer ${credentials.accessToken}` }
      })
        .then(response => response.json());
    }
  }

  RED.nodes.registerType('kyuda-config', KyudaConfig, {
    credentials: {
      id: { type: 'text' },
      loginType: { type: 'text' },
      clientId: { type: 'password' },
      codeVerifier: { type: 'password' },
      codeChallenge: { type: 'password' },
      redirectUri: { type: 'password' },
      accessToken: { type: 'password' },
      refreshToken: { type: 'password' },
      userId: { type: 'text' }
    }
  });

  /////////////////////////////

  RED.httpAdmin.get('/kyuda/credentials/:id', function (req, res) {
    var id = req.params.id;
    var credentials = RED.nodes.getCredentials(id);
    return res.json({
      userId: credentials.userId
    })
  })

  RED.httpAdmin.post('/kyuda/credentials/:id/reset', function (req, res) {
    var id = req.params.id;
    var credentials = RED.nodes.getCredentials(id);
    credentials.userId = null;
    RED.nodes.addCredentials(id, credentials);
    return res.json({
      userId: credentials.userId
    })
  })

  RED.httpAdmin.get('/kyuda/auth', function (req, res) {
    const id = req.query.id;
    const kyudaConfig = RED.nodes.getNode(id);

    const codeVerifier = base64Encode(crypto.randomBytes(32));
    const codeChallenge = base64Encode(sha256(codeVerifier));
    const clientId = "rQEYMY5y2JIp9prmJ9tj5pqH40H3yeMx"

    const credentials = {
      id: id,
      loginType: 'oauth',
      clientId: clientId,
      codeVerifier,
      codeChallenge,
      redirectUri: req.query.callback
    };

    RED.nodes.addCredentials(id, credentials);

    const authUrl = `https://kyuda.eu.auth0.com/authorize?audience=https://kyuda.io/jwt/claims&response_type=code&code_challenge=${credentials.codeChallenge}&code_challenge_method=S256&client_id=${credentials.clientId}&redirect_uri=${credentials.redirectUri}&state=${credentials.id}&scope=openid%20profile%20email%20offline_access`;

    return res.redirect(authUrl);
  });

  RED.httpAdmin.get('/kyuda/auth/callback', function (req, res) {
    const id = req.query.state;

    if (!id) {
      return res.send("ERROR: missing state");
    }

    if (!req.query.code) {
      return res.send("ERROR: missing authorization code");
    }

    const credentials = RED.nodes.getCredentials(id);

    if (!credentials) {
      return res.send("ERROR: missing credentials");
    }

    const form = new URLSearchParams();
    form.append('grant_type', 'authorization_code');
    form.append('client_id', credentials.clientId);
    form.append('code_verifier', credentials.codeVerifier);
    form.append('code', req.query.code);
    form.append('redirect_uri', credentials.redirectUri);

    fetch(`https://kyuda.eu.auth0.com/oauth/token`, {
      method: 'post',
      body: form,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    })
      .then((response) => {
        return response.json();
      })
      .then((json) => {
        console.log(json)
        const jwt = parseJwt(json.id_token);
        const finalCredentials = {
          id: id,
          loginType: 'oauth',
          clientId: credentials.clientId,
          accessToken: json.access_token,
          refreshToken: json.refresh_token,
          expirationDate: Date.now() / 1000 + json.expires_in, // seconds
          userId: jwt.email,
        };

        RED.nodes.addCredentials(id, finalCredentials);

        return res.json({
          message: "Authorised. You can now close this window and go back to Node-RED.",
          credentials: finalCredentials
        });
      });
  });

  /////////////////////////////

  RED.httpAdmin.get('/kyuda/credentials/:id/organisations', async function (req, res) {
    const id = req.params.id;
    const credentials = RED.nodes.getCredentials(id);
    return fetch("https://api.kyuda.io/v1/flows-api/get-organisations", {
      method: 'get',
      headers: { 'Authorization': `Bearer ${credentials.accessToken}` }
    })
      .then(response => response.json())
      .then(json => {
        return res.json(json)
      })
  })

  RED.httpAdmin.get('/kyuda/credentials/:id/sources', async function (req, res) {
    const id = req.params.id;
    const organisation = req.query.organisation;
    const credentials = RED.nodes.getCredentials(id);
    return fetch(`https://api.kyuda.io/v1/flows-api/organisations/${organisation}/sources`, {
      method: 'get',
      headers: { 'Authorization': `Bearer ${credentials.accessToken}` }
    })
      .then(response => response.json())
      .then(json => {
        return res.json(json)
      })
  })

  RED.httpAdmin.get('/kyuda/credentials/:id/pipelines', async function (req, res) {
    const id = req.params.id;
    const organisation = req.query.organisation;
    const credentials = RED.nodes.getCredentials(id);
    return fetch(`https://api.kyuda.io/v1/flows-api/organisations/${organisation}/pipelines`, {
      method: 'get',
      headers: { 'Authorization': `Bearer ${credentials.accessToken}` }
    })
      .then(response => response.json())
      .then(json => {
        return res.json(json)
      })
  })
}
