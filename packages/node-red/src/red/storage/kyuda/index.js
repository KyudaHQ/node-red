const logger = require('winston').loggers.get('storage');
const _ = require("lodash");
const fetch = require('node-fetch');

let token = null;

function stringify(data) {
    return JSON.stringify(data);
}
function parse(data) {
    return JSON.parse(data);
}

export async function init(settings, _runtime) {
    token = settings.storageModuleSettings.token;
    if (!token) {
        throw new Error("token is required");
    }
    logger.info(`token ${token}`);
    return await Promise.resolve();
}

export async function getFlows() {
    try {
        // const global = Global.getInstance();
        // const headers = { Authorization: `Bearer ${global.access_token}` };
        const headers = { Authorization: `Bearer ${token}` };
        const response = await fetch(`https://api.kyuda.io/v1/flows-api/get-flows`, { method: 'POST', headers });
        if (response.status === 200) {
            const data = await response.json();
            return data
        } else {
            return [];
        }
    } catch (err) {
        logger.error(err)
        return [];
    }
}

export async function saveFlows(flows) {
    try {
        // const global = Global.getInstance();
        // const headers = { Authorization: `Bearer ${global.access_token}`, "Content-Type": "application/json" };
        const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
        const response = await fetch(`https://api.kyuda.io/v1/flows-api/save-flows`, { method: 'POST', body: JSON.stringify(flows), headers });
        const data = await response.text();
        return data
    } catch (err) {
        logger.error(err)
    }
}

export async function getCredentials() {
    try {
        // const global = Global.getInstance();
        // const headers = { Authorization: `Bearer ${global.access_token}` };
        const headers = { Authorization: `Bearer ${token}` };
        const response = await fetch(`https://api.kyuda.io/v1/flows-api/get-credentials`, { method: 'POST', headers });
        if (response.status === 200) {
            const data = await response.json();
            return data
        } else {
            return {};
        }
    } catch (err) {
        logger.error(err)
        return {};
    }
}

export async function saveCredentials(credentials) {
    try {
        // const global = Global.getInstance();
        // const headers = { Authorization: `Bearer ${global.access_token}`, "Content-Type": "application/json" };
        const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
        const response = await fetch(`https://api.kyuda.io/v1/flows-api/save-credentials`, { method: 'POST', body: JSON.stringify(credentials), headers });
        const data = await response.json();
        return data
    } catch (err) {
        logger.error(err)
    }
}

export async function getSettings() {
    try {
        // const global = Global.getInstance();
        // const headers = { Authorization: `Bearer ${global.access_token}` };
        const headers = { Authorization: `Bearer ${token}` };
        const response = await fetch(`https://api.kyuda.io/v1/flows-api/get-settings`, { method: 'POST', headers });
        if (response.status === 200) {
            const data = await response.json();
            return data
        } else {
            return {};
        }
    } catch (err) {
        logger.error(err)
        return {};
    }
}

export async function saveSettings(settings) {
    try {
        // const global = Global.getInstance();
        // const headers = { Authorization: `Bearer ${global.access_token}`, "Content-Type": "application/json" };
        const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
        const response = await fetch(`https://api.kyuda.io/v1/flows-api/save-settings`, { method: 'POST', body: JSON.stringify(settings), headers });
        const data = await response.json();
        return data
    } catch (err) {
        logger.error(err)
    }
}

export async function getSessions() {
    try {
        // const global = Global.getInstance();
        // const headers = { Authorization: `Bearer ${global.access_token}` };
        const headers = { Authorization: `Bearer ${token}` };
        const response = await fetch(`https://api.kyuda.io/v1/flows-api/get-sessions`, { method: 'POST', headers });
        if (response.status === 200) {
            const data = await response.json();
            return data
        } else {
            return {};
        }
    } catch (err) {
        logger.error(err)
        return {};
    }
}

export async function saveSessions(sessions) {
    try {
        // const global = Global.getInstance();
        // const headers = { Authorization: `Bearer ${global.access_token}`, "Content-Type": "application/json" };
        const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
        const response = await fetch(`https://api.kyuda.io/v1/flows-api/save-sessions`, { method: 'POST', body: JSON.stringify(sessions), headers });
        const data = await response.json();
        return data
    } catch (err) {
        logger.error(err)
    }
}

export async function getLibraryEntry(type, name) {
    // let path = `${UID}/lib/${type}/${name}`;
    // if (name) {
    //     if (name.substr(-1) === '/') {
    //         try {
    //             const items = await streamToArray(await client.listObjects(BUCKET, path, false));
    //             let output = await Promise.all(_.map(items, async item => {
    //                 if (item.name) {
    //                     let file = await client.statObject(BUCKET, item.name);
    //                     let filename = file.metaData.filename;
    //                     let metadata = parse(file.metaData.metadata);
    //                     return {
    //                         fn: filename,
    //                         ...metadata
    //                     }
    //                 } else {
    //                     let folder = _.reverse(item.prefix.split('/'))[1]
    //                     return folder
    //                 }
    //             }))
    //             return output;
    //         } catch (err) {
    //             throw err;
    //         }
    //     } else {
    //         try {
    //             return streamToString(await client.getObject(BUCKET, path));
    //         } catch (err) {
    //             throw err;
    //         }
    //     }
    // } else {
    //     try {
    //         const items = await streamToArray(await client.listObjects(BUCKET, path, false));
    //         let output = await Promise.all(_.map(items, async item => {
    //             if (item.name) {
    //                 let file = await client.statObject(BUCKET, item.name);
    //                 let filename = file.metaData.filename;
    //                 let metadata = parse(file.metaData.metadata);
    //                 return {
    //                     fn: filename,
    //                     ...metadata
    //                 }
    //             } else {
    //                 let folder = _.reverse(item.prefix.split('/'))[1]
    //                 return folder
    //             }
    //         }))
    //         return output;
    //     } catch (err) {
    //         throw err;
    //     }
    // }
}

export async function saveLibraryEntry(type, name, meta, body) {
    // let path = `${UID}/lib/${type}/${name}`;
    // let filename = _.last(name.split('/'));
    // let metadata = stringify(meta);
    // const result = await client.putObject(BUCKET, path, body, null, {
    //     filename: filename,
    //     metadata: metadata
    // });
}