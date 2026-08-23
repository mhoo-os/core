import { getPayload } from 'payload';

import config from '../test/payload-feasibility.config';

const payload = await getPayload({ config });
console.log(JSON.stringify({
  adminUser: payload.config.admin.user,
  authCollections: payload.config.collections.filter((collection) => Boolean(collection.auth)).map((collection) => collection.slug),
  collections: payload.config.collections.map((collection) => collection.slug),
}, null, 2));
await payload.destroy();
process.exit(0);
