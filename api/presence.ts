import { createApiHandler } from '../server/vercelApi.ts';

const handler = createApiHandler('presence');

export default {
  fetch(request: Request) {
    return handler.fetch(request);
  },
};
