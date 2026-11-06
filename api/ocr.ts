import { createApiHandler } from '../server/vercelApi.ts';

const handler = createApiHandler('ocr');

export default {
  fetch(request: Request) {
    return handler.fetch(request);
  },
};
