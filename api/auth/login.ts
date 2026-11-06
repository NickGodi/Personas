import { createApiHandler } from '../../server/vercelApi.ts';

const handler = createApiHandler('auth/login');

export default {
  fetch(request: Request) {
    return handler.fetch(request);
  },
};
