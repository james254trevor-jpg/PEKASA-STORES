/**
 * Browser client for the server-side OTP functions (see /server/otp.ts).
 * The one-time code is texted to the cashier's phone by the server and is never sent to the browser.
 */

export interface SendOtpResult {
  ok: boolean;
  token?: string;
  maskedPhone?: string;
  error?: string;
}

export interface VerifyOtpResult {
  ok: boolean;
  userId?: string;
  error?: string;
}

const post = async <T extends { ok: boolean; error?: string }>(path: string, body: unknown): Promise<T> => {
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => null);
    if (data && typeof data.ok === 'boolean') return data as T;
    return { ok: false, error: 'The verification service is unavailable. Please try again shortly.' } as T;
  } catch {
    return { ok: false, error: 'Could not reach the verification service. Check your internet connection.' } as T;
  }
};

export const sendOtp = (userId: string, phone: string, name?: string): Promise<SendOtpResult> =>
  post<SendOtpResult>('/api/otp-send', { userId, phone, name });

export const verifyOtp = (token: string, code: string): Promise<VerifyOtpResult> =>
  post<VerifyOtpResult>('/api/otp-verify', { token, code });
