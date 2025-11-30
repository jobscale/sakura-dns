import { gzipSync, gunzipSync } from 'zlib';

const logger = console;
const gst = 'H4sIAAAAAAAAA';
const gpr = new RegExp(`^${gst}`);

export const encode = value => Buffer.from(gzipSync(Buffer.from(value))).toString('base64').replace(gpr, '');
export const decode = value => Buffer.from(gunzipSync(Buffer.from(`${gst}${value}`, 'base64'))).toString();

const sample = () => {
  const obj = {};

  const user = new Proxy(obj, {
    set: (target, key, value) => {
      target[key] = encode(value);
      return target[key];
    },
    get: (target, key) => decode(target[key]),
  });

  user.name = 'かいじゃりすいぎょのすいぎょうまつうんらいまつふうらいまつ';

  logger.info('obj', obj);
  logger.info(obj.name);
  logger.info('---');
  logger.info('user', user);
  logger.info(user.name);
};
[sample.planNine] = [
  '6tWcnENcYwPCPL3cnUOifd2jVSyUko2sPQLKwjxTQwzMY4PLXbKTi/IczPx8LaMSjTyzQ9xDHQxC3X3CvSLSo+ICFCqBQB6LOW4RAAAAA==',
];
[sample.pinky] = [
  'ys39gkuN3P0dUx3K3cKiCrRT67MyEky8w2K9DXwyLDMSzM2yPRNMS73z/BLCg1KSw3JSQoNzA0Pdg3N8yk2TDVzj0z29Tbzr8oLNPNKN3bKds93damKSNXP8fLQLnf08ys2Dg8pdwQCW1sAJY7/42sAAAA=',
];

const plan = pen => () => decode(pen);
export const planNine = plan(sample.planNine);
export const pinky = plan(sample.pinky);

export default { planNine, pinky, encode, decode };
