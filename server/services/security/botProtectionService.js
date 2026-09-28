/**
 * Bot & Human Verification Service
 * 
 * Supports:
 * - Server-side Cloudflare Turnstile token verification
 * - Honeypot form field trap
 * - Human submission velocity timing (< 800ms indicates headless automation)
 * - User-Agent and automation headers evaluation
 */

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * Evaluates bot probability and human verification.
 *
 * @param {{
 *   botToken?: string,
 *   honeypot?: string,
 *   formTimeMs?: number,
 *   ip?: string,
 *   userAgent?: string
 * }} context
 * @returns {Promise<{
 *   botRisk: number, // 0 to 100
 *   isBot: boolean,
 *   turnstileVerified: boolean,
 *   reason: string
 * }>}
 */
async function evaluateBotSignals({
  botToken,
  honeypot,
  formTimeMs,
  ip,
  userAgent,
}) {
  let botRisk = 0;
  const reasons = [];
  let turnstileVerified = false;

  // 1. Honeypot check: If the hidden honeypot field is filled, it's 100% an automated bot
  if (honeypot && String(honeypot).trim() !== '') {
    botRisk += 100;
    reasons.push('honeypot_trap_triggered');
  }

  // 2. Submission timing check: Form completed in less than 800ms indicates automated script
  if (typeof formTimeMs === 'number' && formTimeMs > 0 && formTimeMs < 800) {
    botRisk += 45;
    reasons.push(`submission_too_fast_${formTimeMs}ms`);
  }

  // 3. User-Agent heuristics
  if (!userAgent || userAgent.trim() === '') {
    botRisk += 35;
    reasons.push('missing_user_agent');
  } else {
    const ua = userAgent.toLowerCase();
    if (
      ua.includes('headlesschrome') ||
      ua.includes('puppeteer') ||
      ua.includes('playwright') ||
      ua.includes('selenium') ||
      ua.includes('postmanruntime') ||
      ua.includes('curl/') ||
      ua.includes('python-requests')
    ) {
      botRisk += 80;
      reasons.push('automated_user_agent_signature');
    }
  }

  // 4. Cloudflare Turnstile server-side verification if token & secret configured
  const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
  if (turnstileSecret && botToken) {
    try {
      const formData = new URLSearchParams();
      formData.append('secret', turnstileSecret);
      formData.append('response', botToken);
      if (ip) formData.append('remoteip', ip);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const res = await fetch(TURNSTILE_VERIFY_URL, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const result = await res.json();
        if (result.success) {
          turnstileVerified = true;
          // Valid turnstile token reduces bot risk
          botRisk = Math.max(0, botRisk - 50);
          reasons.push('turnstile_passed');
        } else {
          botRisk += 60;
          reasons.push('turnstile_verification_failed');
        }
      }
    } catch (err) {
      console.warn('[BotProtection] Turnstile verification network error:', err.message);
    }
  }

  botRisk = Math.min(100, Math.max(0, botRisk));
  const isBot = botRisk >= 75;

  return {
    botRisk,
    isBot,
    turnstileVerified,
    reason: reasons.join('; ') || 'human_behavior_normal',
  };
}

module.exports = {
  evaluateBotSignals,
};
