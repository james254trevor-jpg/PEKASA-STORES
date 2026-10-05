/// <reference types="node" />
import { handleSend } from '../server/otp';

// Vercel Function: served at /api/otp-send
export function POST(req: Request) {
  return handleSend(req, process.env);
}
