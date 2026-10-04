/// <reference types="node" />
import { handleVerify } from '../../server/otp';

// Netlify Functions (v2): served at /api/otp-verify
export default (req: Request) => handleVerify(req, process.env);
export const config = { path: '/api/otp-verify' };
