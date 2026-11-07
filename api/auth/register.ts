import { createApiHandler } from '../../server/vercelApi.ts';

const handler = createApiHandler('auth/register');

export default {
  fetch(request: Request) {
    return handler.fetch(request);
  },
};
