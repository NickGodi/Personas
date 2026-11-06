import { createApiHandler } from '../server/vercelApi';

const handler = createApiHandler('health');

export default {
  fetch(request: Request) {
    return handler.fetch(request);
  },
};
