const nodemailer = require('nodemailer');
const https = require('https');

let cachedTransporter = null;

/**
 * Sends transactional email via Brevo REST API over HTTPS (Port 443).
 * This completely bypasses cloud SMTP port blocks (25/465/587).
 */
const sendViaBrevo = async (options) => {
  const brevoApiKey = (process.env.BREVO_API_KEY || '').trim();

  // Brevo strictly requires sending from an active verified sender on the Brevo account
  const senderEmail = (process.env.BREVO_SENDER_EMAIL || 'parthadthakkar@gmail.com').trim();
  const senderName = (process.env.EMAIL_FROM_NAME || 'EstateXplorer').trim();

  const payload = JSON.stringify({
    sender: {
      name: senderName,
      email: senderEmail,
    },
    to: [
      {
        email: options.email,
        name: options.name || options.email.split('@')[0],
      },
    ],
    subject: options.subject,
    htmlContent: options.html || options.message,
    textContent: options.message,
  });

  return new Promise((resolve, reject) => {
    const req = https.request(
      'https://api.brevo.com/v3/smtp/email',
      {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': brevoApiKey,
          'content-type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
        timeout: 10000,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log('✅ Email dispatched successfully via Brevo HTTPS API (Port 443)');
            try {
              resolve(JSON.parse(data));
            } catch (e) {
              resolve({ success: true });
            }
          } else {
            console.error('Brevo API dispatch error:', res.statusCode, data);
            global.__lastSmtpError = { provider: 'brevo', statusCode: res.statusCode, response: data, time: new Date() };
            reject(new Error(`Brevo dispatch failed with status ${res.statusCode}: ${data}`));
          }
        });
      }
    );

    req.on('timeout', () => {
      req.destroy();
      const timeoutErr = new Error('Brevo HTTPS request timed out');
      global.__lastSmtpError = { provider: 'brevo', message: timeoutErr.message, time: new Date() };
      reject(timeoutErr);
    });

    req.on('error', (err) => {
      console.error('Brevo HTTPS network error:', err.message);
      global.__lastSmtpError = { provider: 'brevo', message: err.message, time: new Date() };
      reject(err);
    });

    req.write(payload);
    req.end();
  });
};

/**
 * Creates or reuses a resilient Nodemailer transport instance.
 * Automatically supports Gmail Service shortcut or standard SMTP hosts (465/587).
 * Cleans whitespace from user/password to prevent cloud copy-paste failures.
 */
const getTransporter = async () => {
  const rawUser = process.env.SMTP_USER ? process.env.SMTP_USER.trim() : '';
  const rawPass = process.env.SMTP_PASS ? process.env.SMTP_PASS.trim() : '';
  const rawHost = process.env.SMTP_HOST ? process.env.SMTP_HOST.trim() : '';
  const cleanPass = rawPass.replace(/\s+/g, '');

  const isMockCredential =
    !rawUser ||
    rawUser === 'mock_user@ethereal.email' ||
    rawUser === 'your-email@gmail.com' ||
    cleanPass === 'mock_pass' ||
    cleanPass === 'your-app-password-here';

  if (!isMockCredential && (rawHost || rawUser.endsWith('@gmail.com'))) {
    if (cachedTransporter) return { transporter: cachedTransporter, isTestAccount: false };

    const isGmail = rawHost.includes('gmail.com') || rawUser.endsWith('@gmail.com');
    const port = parseInt(process.env.SMTP_PORT, 10) || (isGmail ? 465 : 587);
    const isSecure = port === 465;

    let transportConfig;

    if (isGmail) {
      transportConfig = {
        service: 'gmail',
        auth: {
          user: rawUser,
          pass: cleanPass,
        },
        tls: {
          rejectUnauthorized: false,
        },
        connectionTimeout: 15000,
        greetingTimeout: 10000,
        socketTimeout: 20000,
      };
    } else {
      transportConfig = {
        host: rawHost,
        port: port,
        secure: isSecure,
        auth: {
          user: rawUser,
          pass: cleanPass,
        },
        tls: {
          rejectUnauthorized: false,
        },
        connectionTimeout: 15000,
        greetingTimeout: 10000,
        socketTimeout: 20000,
      };
    }

    try {
      cachedTransporter = nodemailer.createTransport(transportConfig);
      await cachedTransporter.verify();
      console.log('✅ Mail transport connected successfully via', isGmail ? 'Gmail Service' : `${rawHost}:${port}`);
      return { transporter: cachedTransporter, isTestAccount: false };
    } catch (verifyErr) {
      console.warn('Primary transport verification failed, falling back to direct host transport:', verifyErr.message);
      global.__lastSmtpError = { phase: 'verify', message: verifyErr.message, code: verifyErr.code, response: verifyErr.response };
      cachedTransporter = nodemailer.createTransport({
        host: rawHost || 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
          user: rawUser,
          pass: cleanPass,
        },
        tls: {
          rejectUnauthorized: false,
        },
        connectionTimeout: 15000,
        socketTimeout: 20000,
      });
      return { transporter: cachedTransporter, isTestAccount: false };
    }
  }

  // Development fallback: Ethereal test mail
  console.log('ℹ️ Using Ethereal test account for email delivery...');
  const testAccount = await nodemailer.createTestAccount();
  const testTransporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });

  return { transporter: testTransporter, isTestAccount: true };
};

const sendEmail = async (options) => {
  // 1. If BREVO_API_KEY is configured, dispatch via HTTPS Port 443 (firewall-proof)
  if (process.env.BREVO_API_KEY && process.env.BREVO_API_KEY.trim()) {
    return await sendViaBrevo(options);
  }

  // 2. Otherwise fall back to Nodemailer SMTP
  const { transporter, isTestAccount } = await getTransporter();
  const rawUser = process.env.SMTP_USER ? process.env.SMTP_USER.trim() : '';

  const message = {
    from: process.env.EMAIL_FROM || `EstateXplorer <${rawUser || 'noreply@estatexplorer.com'}>`,
    to: options.email,
    subject: options.subject,
    text: options.message,
    html: options.html,
  };

  const info = await transporter.sendMail(message);

  if (isTestAccount) {
    const previewUrl = nodemailer.getTestMessageUrl(info);
    console.log('✉️ Ethereal Email Preview URL:', previewUrl);
  }

  return info;
};

module.exports = sendEmail;
