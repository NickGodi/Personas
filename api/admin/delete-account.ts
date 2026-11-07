import { createApiHandler } from '../../server/vercelApi.ts';

const handler = createApiHandler('admin/delete-account');

export default {
  fetch(request: Request) {
    return handler.fetch(request);
  },
};
