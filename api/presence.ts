import { createApiHandler } from '../server/vercelApi';

const handler = createApiHandler('presence');

export default {
  fetch(request: Request) {
    return handler.fetch(request);
  },
};
