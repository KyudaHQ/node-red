class PrivateGlobal {
    constructor() {
        this.access_token = 'N/A';
    }
    setAccessToken(accessToken) {
        console.log("Setting accessToken...")
        this.access_token = accessToken;
    }
}
class Global {
    constructor() {
        throw new Error('Use Singleton.getInstance()');
    }
    static getInstance() {
        if (!Global.instance) {
            Global.instance = new PrivateGlobal();
        }
        return Global.instance;
    }
}
module.exports = Global;