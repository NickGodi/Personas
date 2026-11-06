import { createApiHandler } from '../server/vercelApi.ts';

const handler = createApiHandler('tournament-state');

export default {
  fetch(request: Request) {
    return handler.fetch(request);
  },
};
