/// <reference types="node" />
import { handleAuth } from '../../server/auth';

// Netlify Functions (v2): served at /api/auth/<action> (login, otp-send, otp-verify, staff-create, staff-reset-password)
export default (req: Request) => handleAuth(req, process.env);
export const config = { path: '/api/auth/*' };
