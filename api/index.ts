import { handle } from 'hono/vercel';
import { createApp } from '../server/app.js';

const app = createApp();

export default handle(app);
