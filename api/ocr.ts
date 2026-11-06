import { createApiHandler } from '../server/vercelApi';

const handler = createApiHandler('ocr');

export default {
  fetch(request: Request) {
    return handler.fetch(request);
  },
};
