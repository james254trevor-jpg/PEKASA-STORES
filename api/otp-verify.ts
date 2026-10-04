/// <reference types="node" />
import { handleVerify } from '../server/otp';

// Vercel Function: served at /api/otp-verify
export function POST(req: Request) {
  return handleVerify(req, process.env);
}
