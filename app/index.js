const { logger } = require('@jobscale/logger');
const { decode } = require('./js-proxy');

const {
  ENV, DOMAIN, TOKEN, DNS_CONFIG,
  TYPE, R_DATA,
} = process.env;

const ZONE = 'is1a';
const API = `https://secure.sakura.ad.jp/cloud/zone/${ZONE}/api/cloud/1.1`;
class App {
  async allowInsecure(use) {
    if (use === false) delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    else process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  }

  fetchEnv() {
    const Host = 'https://partner.credentials.svc.cluster.local';
    const Cookie = 'X-AUTH=X0X0X0X0X0X0X0X';
    const request = [
      `${Host}/sakura-dns.env.json`,
      { method: 'GET', headers: { Cookie } },
    ];
    return this.allowInsecure()
    .then(() => fetch(...request))
    .then(res => this.allowInsecure(false) && res)
    .then(res => res.json())
    .catch(() => {
      const token = Number.parseInt(TOKEN, 10) || 0;
      const match = Math.floor(Date.now() / 1000);
      if (Math.abs(match - token) > 5) throw new Error('mismatch token');
      const config = JSON.parse(Buffer.from(
        decode(DNS_CONFIG).split('').reverse().join(''),
        'base64',
      ).toString());
      const env = {};
      Buffer.from(
        `${config.accessKeyId}${config.accessKey}${config.secretAccessKey}${config.accessKeyToken}`,
        'base64',
      ).toString().split('\n').map(item => item.split('='))
      .forEach(([key, value]) => {
        if (!key) return;
        env[key] = value;
      });
      return {
        accessToken: env.SAKURACLOUD_ACCESS_TOKEN,
        accessTokenSecret: env.SAKURACLOUD_ACCESS_TOKEN_SECRET,
        zone: env.SAKURACLOUD_ZONE,
      };
    });
  }

  fetchIP() {
    return fetch('https://inet-ip.info/ip')
    .then(res => res.text())
    .then(res => res.split('\n')[0]);
  }

  waiter(milliseconds) {
    return new Promise(
      resolve => { setTimeout(resolve, milliseconds); },
    );
  }

  async setAddress(ip, env) {
    if (TYPE && R_DATA) return this.setDomainValue(ip, env);
    const Type = 'A';
    logger.info(`Dynamic DNS polling. - [${ENV}] ${ip} (${DOMAIN})`);
    const zone = await this.getDNSRecords(env, 'jsx.jp');
    const host = DOMAIN;
    const records = zone.ResourceRecordSets.filter(
      item => item.Type !== Type || item.Name !== host,
    );
    const record = { Name: host, Type, RData: ip, TTL: 120 };
    records.push(record);
    const data = await this.putDNSRecords(env, { ...zone, ResourceRecordSets: records });
    logger.info({ ...record, Success: data.Success });
    return 'ok';
  }

  async setDomainValue(ip, env) {
    const Type = TYPE.toUpperCase();
    const RData = R_DATA;
    logger.info(`Dynamic DNS polling. - [${ENV}] ${ip} (${DOMAIN}) "${RData}"`);
    const zone = await this.getDNSRecords(env, 'jsx.jp');
    const host = DOMAIN;
    const records = zone.ResourceRecordSets.filter(
      item => item.Type !== Type || item.Name !== host,
    );
    const record = { Name: host, Type, RData, TTL: 120 };
    records.push(record);
    const data = await this.putDNSRecords(env, { ...zone, ResourceRecordSets: records });
    logger.info({ ...record, Success: data.Success });
    return 'ok';
  }

  async getDNSZones(env) {
    const url = `${API}/commonserviceitem`;
    const { accessToken, accessTokenSecret } = env;
    const Authorization = `Basic ${Buffer.from(`${accessToken}:${accessTokenSecret}`).toString('base64')}`;
    const response = await fetch(url, {
      headers: { Authorization },
    });
    if (!response.ok) {
      throw new Error(`fetching DNS zones: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    const zones = data.CommonServiceItems
    .filter(item => item.ServiceClass === 'cloud/dns')
    .map(item => ({
      ID: item.ID,
      Name: item.Name,
    }));
    return zones;
  }

  async getDNSRecords(env, zoneName) {
    const url = `${API}/commonserviceitem`;
    const { accessToken, accessTokenSecret } = env;
    const Authorization = `Basic ${Buffer.from(`${accessToken}:${accessTokenSecret}`).toString('base64')}`;
    const response = await fetch(url, {
      headers: { Authorization },
    });
    if (!response.ok) {
      throw new Error(`fetching DNS records: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    const [zone] = data.CommonServiceItems
    .filter(item => item.ServiceClass === 'cloud/dns' && item.Name === zoneName)
    .map(item => ({
      ID: item.ID,
      Name: item.Name,
      ResourceRecordSets: item.Settings.DNS.ResourceRecordSets,
    }));
    return zone;
  }

  async putDNSRecords(env, zone) {
    const url = `${API}/commonserviceitem/${zone.ID}`;
    const { accessToken, accessTokenSecret } = env;
    const Authorization = `Basic ${Buffer.from(`${accessToken}:${accessTokenSecret}`).toString('base64')}`;
    const payload = {
      CommonServiceItem: {
        Settings: {
          DNS: {
            ResourceRecordSets: zone.ResourceRecordSets,
          },
        },
      },
    };
    const response = await fetch(url, {
      method: 'PUT',
      headers: { Authorization, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(`update DNS records: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    return data;
  }

  main() {
    return Promise.all([this.fetchIP(), this.fetchEnv()])
    .then(data => this.setAddress(...data));
  }

  start() {
    const ts = new Date();
    logger.info({ ts: ts.getTime(), now: ts.toISOString() });
    this.main()
    .then(message => logger.info({ message }))
    .catch(e => logger.error(e));
  }
}

new App().start();
