const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  let transporter;
  let isTestAccount = false;

  const isMockCredential = 
    !process.env.SMTP_USER || 
    process.env.SMTP_USER === 'mock_user@ethereal.email' || 
    process.env.SMTP_USER === 'your-email@gmail.com' ||
    process.env.SMTP_PASS === 'mock_pass' ||
    process.env.SMTP_PASS === 'your-app-password-here';

  if (process.env.SMTP_HOST && !isMockCredential) {
    const port = parseInt(process.env.SMTP_PORT, 10) || 587;
    const isSecure = port === 465;
    
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: port,
      secure: isSecure, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: {
        rejectUnauthorized: false // Avoid blockages due to unauthorized SSL certs
      }
    });
  } else {
    // Development fallback using Ethereal test account if SMTP not fully configured or mock
    isTestAccount = true;
    console.log('Using Ethereal development mail service...');
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
  }

  const message = {
    from: process.env.EMAIL_FROM || `EstateXplorer <${process.env.SMTP_USER || 'noreply@estatexplorer.com'}>`,
    to: options.email,
    subject: options.subject,
    text: options.message,
    html: options.html,
  };

  const info = await transporter.sendMail(message);
  console.log('Message sent: %s', info.messageId);

  if (isTestAccount) {
    const previewUrl = nodemailer.getTestMessageUrl(info);
    console.log('✉️ Ethereal Email Preview URL: %s', previewUrl);
  }
};

module.exports = sendEmail;
