import { createLogger } from '@jobscale/logger';
import { decode } from './js-proxy.js';

const {
  ENV, LOG_LEVEL, DOMAIN, TOKEN, DNS_CONFIG,
  TYPE, R_DATA, MULTIPLE, DELETE,
} = process.env;

const logger = createLogger(LOG_LEVEL);

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
      const token = TOKEN === 'test' && ENV === 'dev'
        ? Math.floor(Date.now() / 1000)
        : Number.parseInt(TOKEN, 10) || 0;
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

  sort(records) {
    return records.sort((a, b) => {
      const [aName, bName] = [
        a.Name.split('.').reverse().join('.'),
        b.Name.split('.').reverse().join('.'),
      ];
      if (aName > bName) return 1;
      if (aName < bName) return -1;
      if (a.Type > b.Type) return 1;
      if (a.Type < b.Type) return -1;
      return 0;
    });
  }

  async setDomainValue(ip, env) {
    const Type = (TYPE || 'A').toUpperCase();
    const RData = R_DATA || ip;
    const host = DOMAIN;
    const record = { Name: host, Type, RData, TTL: 120 };
    logger.info(`Dynamic DNS polling. - [${ENV}]`, JSON.stringify(record, null, 2));
    const zone = await this.getDNSRecords(env, 'jsx.jp');
    const records = zone.ResourceRecordSets.filter(item => {
      if (MULTIPLE || item.Name !== host) return true;
      if (DELETE || item.Type === Type) return false;
      const diff = ['A', 'CNAME'];
      return !(diff.includes(item.Type) && diff.includes(Type));
    });
    if (!DELETE) records.push(record);
    const sorted = this.sort(records);
    logger.debug(JSON.stringify(sorted));
    const data = await this.putDNSRecords(env, { ...zone, ResourceRecordSets: sorted });
    logger.info(JSON.stringify({ ...data, CommonServiceItem: undefined }, null, 2));
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
    .then(data => this.setDomainValue(...data));
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
