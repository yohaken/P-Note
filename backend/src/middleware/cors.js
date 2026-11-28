import cors from 'cors';
import { isAllowedOrigin } from '../config.js';

function makeCors({ allowNoOrigin }) {
  return cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin, { allowNoOrigin })) {
        callback(null, true);
        return;
      }
      const err = new Error('origin_not_allowed');
      err.status = 403;
      callback(err);
    },
    credentials: true,
  });
}

/** Health / PIN — allow curl and same-origin probes with no Origin. */
export const corsPublic = makeCors({ allowNoOrigin: true });

/** Authenticated API — Bearer ID token; allow same-origin GETs with no Origin. */
export const corsMiddleware = makeCors({ allowNoOrigin: true });
