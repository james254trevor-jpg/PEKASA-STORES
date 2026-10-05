/// <reference types="node" />
import { handleSend } from '../../server/otp';

// Netlify Functions (v2): served at /api/otp-send
export default (req: Request) => handleSend(req, process.env);
export const config = { path: '/api/otp-send' };
