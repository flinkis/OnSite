import { handle } from 'hono/vercel';
import { createApp } from '../server/app.js';

const app = createApp();
const honoHandler = handle(app);

export default {
  fetch(request: Request) {
    return honoHandler(request);
  },
};
