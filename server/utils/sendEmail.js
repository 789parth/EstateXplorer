const nodemailer = require('nodemailer');

let cachedTransporter = null;

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
      // Use direct Gmail predefined service configuration - highest reliability on cloud providers
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
      // Fallback to explicit SSL port 465
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
