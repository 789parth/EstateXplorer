const nodemailer = require('nodemailer');

let cachedTransporter = null;

/**
 * Creates or reuses a Nodemailer transport instance.
 * Optimized with connection pooling to eliminate cold-start TLS latency on Vercel.
 */
const getTransporter = async () => {
  const isMockCredential =
    !process.env.SMTP_USER ||
    process.env.SMTP_USER === 'mock_user@ethereal.email' ||
    process.env.SMTP_USER === 'your-email@gmail.com' ||
    process.env.SMTP_PASS === 'mock_pass' ||
    process.env.SMTP_PASS === 'your-app-password-here';

  if (process.env.SMTP_HOST && !isMockCredential) {
    if (cachedTransporter) return { transporter: cachedTransporter, isTestAccount: false };

    const port = parseInt(process.env.SMTP_PORT, 10) || 587;
    const isSecure = port === 465;

    cachedTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: port,
      secure: isSecure,
      pool: true, // Use pooled connections for high-speed dispatch
      maxConnections: 5,
      maxMessages: 100,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: {
        rejectUnauthorized: false,
      },
      connectionTimeout: 10000,
      greetingTimeout: 5000,
      socketTimeout: 15000,
    });

    return { transporter: cachedTransporter, isTestAccount: false };
  }

  // Development fallback: Ethereal test mail
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

  const message = {
    from: process.env.EMAIL_FROM || `EstateXplorer <${process.env.SMTP_USER || 'noreply@estatexplorer.com'}>`,
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
