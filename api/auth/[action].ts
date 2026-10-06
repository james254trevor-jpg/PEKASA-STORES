/// <reference types="node" />
import { handleAuth } from '../../server/auth';

// Vercel Function: served at /api/auth/<action>
export function POST(req: Request) {
  return handleAuth(req, process.env);
}
