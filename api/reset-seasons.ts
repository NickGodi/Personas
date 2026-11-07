import { createApiHandler } from '../server/vercelApi.ts';

const handler = createApiHandler('reset-seasons');

export default {
  fetch(request: Request) {
    return handler.fetch(request);
  },
};
