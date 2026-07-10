import cors from 'cors';
import { isAllowedOrigin } from '../config.js';

export const corsMiddleware = cors({
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`Origin not allowed: ${origin}`));
  },
  credentials: true,
});
