import cors from 'cors';
import { isAllowedOrigin } from '../config.js';

function makeCors({ allowNoOrigin }) {
  return cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin, { allowNoOrigin })) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origin not allowed: ${origin}`));
    },
    credentials: true,
  });
}

/** Health / PIN — allow curl and same-origin probes with no Origin. */
export const corsPublic = makeCors({ allowNoOrigin: true });

/** Authenticated API routes — require a real allowed Origin. */
export const corsMiddleware = makeCors({ allowNoOrigin: false });
