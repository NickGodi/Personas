import { createApiHandler } from '../../server/vercelApi';

const handler = createApiHandler('auth/login');

export default {
  fetch(request: Request) {
    return handler.fetch(request);
  },
};
