const _ = require('lodash');
const express = require('express');
const router = express.Router();
const logger = require('winston').loggers.get('server');

function Profile(data, raw) {
    this.displayName = data.name;
    this.id = data.user_id || data.sub;
    this.user_id = this.id;

    if (data.identities) {
        this.provider = data.identities[0].provider;
    } else if (typeof this.id === 'string' && this.id.indexOf('|') > -1) {
        this.provider = this.id.split('|')[0];
    }

    this.name = {
        familyName: data.family_name,
        givenName: data.given_name
    };

    if (data.emails) {
        this.emails = data.emails.map(function (email) {
            return { value: email };
        });
    } else if (data.email) {
        this.emails = [{
            value: data.email
        }];
    }

    ['picture',
        'locale',
        'nickname',
        'gender',
        'identities'].filter(function (k) {
            return k in data;
        }).forEach(function (k) {
            this[k] = data[k];
        }.bind(this));

    this._json = data;
    this._raw = raw;
}

const Strategy = require("./auth/oauth2").Strategy;
Strategy.prototype.authorizationParams = function (options) {
    return {
        audience: "https://kyuda.io/jwt/claims"
    }
};
Strategy.prototype.userProfile = function (accessToken, done) {
    this._oauth2.get(this._userInfoURL, accessToken, function (err, body, res) {
        if (err) { return done(new Error('failed to fetch user profile', err)); }
        try {
            var json = JSON.parse(body);
            var profile = new Profile(json, body);

            done(null, profile);
        } catch (e) {
            done(e);
        }
    });
};

const settings = {
    httpAdminRoot: "/editor/",
    httpNodeRoot: "/api/",
    flowFile: 'flows.json',
    userDir: "./",
    credentialSecret: 'secret',
    functionGlobalContext: {},
    contextStorage: {
        default: {
            module: 'memory'
        },
        // shared: {
        //     module: require("./context/redis"),
        //     config: {
        //         url: process.env.REDIS_URL,
        //         prefix: process.env.REDIS_PREFIX,
        //         tls: true
        //     }
        // }
    },
    // storageModule: require("./storage/minio"),
    // storageModuleSettings: {
    //     endpoint: process.env.MINIO_ENDPOINT,
    //     bucket: process.env.MINIO_BUCKET,
    //     region: process.env.MINIO_REGION,
    //     accessKey: process.env.MINIO_ACCESS_KEY,
    //     secretKey: process.env.MINIO_SECRET_KEY,
    //     prefix: process.env.MINIO_PREFIX
    // },
    storageModule: require("./storage/kyuda"),
    storageModuleSettings: {
        KYUDA_FLOW_TOKEN: process.env.KYUDA_FLOW_TOKEN
    },
    logging: {
        console: {
            // Level of logging to be recorded. Options are:
            // fatal - only those errors which make the application unusable should be recorded
            // error - record errors which are deemed fatal for a particular request + fatal errors
            // warn - record problems which are non fatal + errors + fatal errors
            // info - record information about the general running of the application + warn + error + fatal errors
            // debug - record information which is more verbose than info + info + warn + error + fatal errors
            // trace - record very detailed logging + debug + info + warn + error + fatal errors
            // off - turn off all logging (doesn't affect metrics or audit)
            level: "info",
            metrics: false,
            audit: false
        }
    },
    swagger: {
        template: {
            swagger: "2.0",
            info: {
                title: "Kyuda Flow",
                version: "0.0.1"
            }
        }
    },
    editorTheme: {
        page: {
            title: "Kyuda Flow",
            favicon: __dirname + "/assets/logo.svg",
            css: [
                __dirname + "/assets/camphor.css",
                __dirname + "/assets/style.css"
            ],
            scripts: [
                __dirname + "/assets/script.js"
            ]
        },
        header: {
            title: " ",
            image: __dirname + "/assets/logo.svg",
            url: "hhttps://www.kyuda.io"
        },
        deployButton: {
            type: "simple",
            label: "Deploy",
            icon: __dirname + "/assets/deploy-full-o.svg",
        },
        menu: {
            "menu-item-import-library": process.env.NODE_RED_IMPORT_EXPORT === 'yes',
            "menu-item-export-library": process.env.NODE_RED_IMPORT_EXPORT === 'yes',
            "menu-item-keyboard-shortcuts": false,
            "menu-item-help": {
                label: "Kyuda",
                url: "https://www.kyuda.io"
            }
        },
        userMenu: true,
        login: {
            image: __dirname + "/assets/logo.svg",
        },
        logout: {
            redirect: "http://localhost:1880"
        },
        palette: {
            allowInstall: process.env.NODE_RED_EDITOR_PALETTE === 'yes',
            catalogues: [
                'https://catalogue.nodered.org/catalogue.json'
            ],
            theme: [
                { category: "common", type: "complete|catch|status|link in|link out", color: "rgb(233, 233, 235)" },
                { category: "common", type: "inject", color: "#909399" },
                { category: "common", type: "debug", color: "#909399" },
                { category: "function", type: ".*", color: "rgb(253, 226, 226)" },
                { category: "network", type: ".*", color: "rgb(250, 236, 216)" },
                { category: "sequence", type: ".*", color: "rgb(225, 243, 216)" },
                { category: "parser", type: ".*", color: "rgb(217, 236, 255)" },
                { category: "storage", type: ".*", color: "rgb(217, 236, 255)" },
                { category: "dashboard", type: ".*", color: "rgb(233, 233, 235)" },
            ]
        },
        projects: {
            enabled: false,
        },
    },
    ui: {
        path: 'dashboard', middleware: function (req, res, next) {
            next()
        }
    }
};

if (process.env.AUTH0_ENABLED === 'true') {
    settings.adminAuth = {
        type: "strategy",
        strategy: {
            name: "oauth2",
            label: 'Sign in with Auth0',
            icon: "fa-user",
            strategy: Strategy,
            options: {
                authorizationURL: process.env.AUTH0_DOMAIN ? `https://${process.env.AUTH0_DOMAIN}/authorize` : `https://kyuda.eu.auth0.com/authorize`,
                tokenURL: process.env.AUTH0_DOMAIN ? `https://${process.env.AUTH0_DOMAIN}/oauth/token` : `https://kyuda.eu.auth0.com/oauth/token`,
                userInfoURL: process.env.AUTH0_DOMAIN ? `https://${process.env.AUTH0_DOMAIN}/userinfo` : `https://kyuda.eu.auth0.com/userinfo`,
                clientID: process.env.AUTH0_CLIENT_ID ? process.env.AUTH0_CLIENT_ID : "rQEYMY5y2JIp9prmJ9tj5pqH40H3yeMx",
                callbackURL: process.env.AUTH0_CALLBACK_URL ? process.env.AUTH0_CALLBACK_URL : "http://localhost:1880/editor/auth/strategy/callback",
                scope: "openid email profile offline_access",
                state: true,
                pkce: true,
                verify: function (accessToken, refreshToken, extraParams, profile, done) {
                    const user = {
                        username: _.get(_.first(profile.emails), 'value', profile.id)
                    }
                    done(null, user);
                }
            },
        },
        users: function (user) {
            if (process.env.AUTH0_ALLOWED_USERS) {
                const allowedUsers = process.env.AUTH0_ALLOWED_USERS.split(',');
                if (allowedUsers.includes(user)) {
                    return Promise.resolve({ username: user, permissions: "*" });
                } else {
                    return Promise.resolve(null);
                }
            } else {
                return Promise.resolve({ username: user, permissions: "*" });
            }
        },
    }
}

var RED = require("node-red");

// RED.events.on('runtime-event', async (event) => {
//     logger.debug(event.id)
// })

var secured = require('../app/middleware/secured');
//router.use(secured());

module.exports = {
    router,
    start: function (server) {
        RED.init(server, settings);
        router.use(settings.httpAdminRoot, RED.httpAdmin);
        router.use(settings.httpNodeRoot, RED.httpNode);
        RED.start();
    }
};