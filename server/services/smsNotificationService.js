const https = require('https');
const http = require('http');
const NotificationLog = require('../models/NotificationLog');
const User = require('../models/User');

/**
 * Normalizes phone numbers to standard 10-digit Indian mobile format
 * or E.164 standard (+91XXXXXXXXXX)
 */
function normalizePhoneNumber(rawPhone) {
  if (!rawPhone || typeof rawPhone !== 'string') return '';
  const digits = rawPhone.replace(/\D/g, '');
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length > 10) return digits.slice(-10);
  return digits;
}

/**
 * Dispatches an SMS via configured gateway (Fast2SMS / Twilio)
 * or records a simulated delivery in development/test environment.
 */
async function sendSmsGateway({ phone, message, type = 'LEAD_ALERT', recipient = null, metadata = {} }) {
  const cleanPhone = normalizePhoneNumber(phone);
  if (!cleanPhone || cleanPhone.length < 10) {
    return {
      success: false,
      reason: 'INVALID_PHONE_NUMBER',
      message: 'Invalid recipient phone number',
    };
  }

  const fast2smsApiKey = process.env.FAST2SMS_API_KEY;
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioAuth = process.env.TWILIO_AUTH_TOKEN;
  const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

  let gateway = 'simulated';
  let gatewayMessageId = `SIM_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  let status = 'DELIVERED';
  let errorDetails = '';

  // 1. Fast2SMS Gateway integration (India SMS Provider)
  if (fast2smsApiKey && fast2smsApiKey !== 'mock_fast2sms_key') {
    gateway = 'fast2sms';
    try {
      // Allow FAST2SMS_ROUTE override ('q' for Quick SMS without DLT requirement, 'otp', or 'dlt'/'v3')
      // Default to Quick SMS route 'q' which is reliable for instant SMS alerts in India without pre-approved DLT templates
      const fast2smsRoute = process.env.FAST2SMS_ROUTE || 'q';

      const payloadObj = {
        route: fast2smsRoute,
        message: message,
        language: 'english',
        flash: 0,
        numbers: cleanPhone,
      };

      // sender_id is only valid for DLT routes, omit if using Quick SMS 'q' or 'otp'
      if (fast2smsRoute === 'dlt' || fast2smsRoute === 'v3') {
        payloadObj.sender_id = process.env.FAST2SMS_SENDER_ID || 'ESTATX';
      }

      const payload = JSON.stringify(payloadObj);

      const response = await new Promise((resolve, reject) => {
        const req = https.request(
          'https://www.fast2sms.com/dev/bulkV2',
          {
            method: 'POST',
            headers: {
              authorization: fast2smsApiKey,
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(payload),
            },
            timeout: 7000,
          },
          (res) => {
            let data = '';
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
          }
        );

        req.on('error', reject);
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('Fast2SMS Gateway Timeout'));
        });

        req.write(payload);
        req.end();
      });

      let parsed = {};
      try {
        parsed = JSON.parse(response.body);
      } catch (e) {
        parsed = { raw: response.body };
      }

      if (response.statusCode === 200 && (parsed.return === true || parsed.status_code === 200)) {
        status = 'DELIVERED';
        gatewayMessageId = parsed.request_id || (Array.isArray(parsed.message) ? parsed.message[0] : gatewayMessageId);
      } else {
        status = 'FAILED';
        errorDetails = Array.isArray(parsed.message)
          ? parsed.message.join(', ')
          : (parsed.message || JSON.stringify(parsed));
      }
    } catch (err) {
      status = 'FAILED';
      errorDetails = err.message;
    }
  }
  // 2. Twilio Gateway integration (International, US/UK, or Twilio Verify Service)
  else if (twilioSid && twilioAuth && !twilioSid.startsWith('mock_')) {
    gateway = 'twilio';
    try {
      const authHeader = 'Basic ' + Buffer.from(`${twilioSid}:${twilioAuth}`).toString('base64');
      const formattedTo = cleanPhone.startsWith('91') ? `+${cleanPhone}` : `+91${cleanPhone}`;
      const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID || process.env.VERIFY_SERVICE_SID;

      // If Twilio Verify Service is provided (and no dedicated twilioPhone number is configured),
      // dispatch OTP/alert via Twilio Verify Service API (supports trial accounts & verified phone numbers)
      if (verifyServiceSid && (!twilioPhone || verifyServiceSid.startsWith('VA'))) {
        const postData = new URLSearchParams({
          To: formattedTo,
          Channel: 'sms',
        }).toString();

        const response = await new Promise((resolve, reject) => {
          const req = https.request(
            `https://verify.twilio.com/v2/Services/${verifyServiceSid}/Verifications`,
            {
              method: 'POST',
              headers: {
                Authorization: authHeader,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData),
              },
              timeout: 7000,
            },
            (res) => {
              let data = '';
              res.on('data', (chunk) => (data += chunk));
              res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
            }
          );

          req.on('error', reject);
          req.on('timeout', () => {
            req.destroy();
            reject(new Error('Twilio Verify Gateway Timeout'));
          });

          req.write(postData);
          req.end();
        });

        let parsed = {};
        try {
          parsed = JSON.parse(response.body);
        } catch (e) {
          parsed = { raw: response.body };
        }

        if (response.statusCode >= 200 && response.statusCode < 300) {
          status = 'DELIVERED';
          gatewayMessageId = parsed.sid || gatewayMessageId;
        } else {
          status = 'FAILED';
          errorDetails = parsed.message || JSON.stringify(parsed);
        }
      } else if (twilioPhone) {
        // Standard Twilio SMS Programmable Messaging endpoint
        const postData = new URLSearchParams({
          To: formattedTo,
          From: twilioPhone,
          Body: message,
        }).toString();

        const response = await new Promise((resolve, reject) => {
          const req = https.request(
            `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
            {
              method: 'POST',
              headers: {
                Authorization: authHeader,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData),
              },
              timeout: 7000,
            },
            (res) => {
              let data = '';
              res.on('data', (chunk) => (data += chunk));
              res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
            }
          );

          req.on('error', reject);
          req.on('timeout', () => {
            req.destroy();
            reject(new Error('Twilio Gateway Timeout'));
          });

          req.write(postData);
          req.end();
        });

        let parsed = {};
        try {
          parsed = JSON.parse(response.body);
        } catch (e) {
          parsed = { raw: response.body };
        }

        if (response.statusCode >= 200 && response.statusCode < 300) {
          status = 'DELIVERED';
          gatewayMessageId = parsed.sid || gatewayMessageId;
        } else {
          status = 'FAILED';
          errorDetails = parsed.message || JSON.stringify(parsed);
        }
      } else {
        // Neither Verify SID nor phone number available
        gateway = 'simulated';
        status = 'SIMULATED';
        console.log(`[SMS Gateway Simulated] To: +91-${cleanPhone} | Type: ${type} | Msg: "${message}"`);
      }
    } catch (err) {
      status = 'FAILED';
      errorDetails = err.message;
    }
  } else {
    // 3. Simulated Gateway for Development & Test Environments
    gateway = 'simulated';
    status = 'SIMULATED';
    console.log(`[SMS Gateway Simulated] To: +91-${cleanPhone} | Type: ${type} | Msg: "${message}"`);
  }

  // Record audit log entry in MongoDB
  try {
    const mongoose = require('mongoose');
    // If running in test or if mongoose is connected, persist log
    if (process.env.NODE_ENV === 'test' || !mongoose.connection || mongoose.connection.readyState === 1 || NotificationLog.create.name === 'create' || NotificationLog.create.length > 0) {
      await Promise.race([
        NotificationLog.create({
          recipient: recipient?._id || recipient?.id || recipient || null,
          recipientPhone: cleanPhone,
          recipientName: recipient?.name || metadata.recipientName || '',
          channel: 'sms',
          type,
          message,
          gateway,
          gatewayMessageId,
          status,
          errorDetails,
          metadata,
        }),
        new Promise((resolve) => setTimeout(resolve, 800)),
      ]);
    }
  } catch (logErr) {
    console.warn('[NotificationLog] Failed to persist log:', logErr.message);
  }

  const isSuccess = status === 'DELIVERED' || status === 'SIMULATED';

  return {
    success: isSuccess,
    status,
    gateway,
    gatewayMessageId,
    phone: cleanPhone,
    isLive: gateway !== 'simulated' && status === 'DELIVERED',
    isSimulated: gateway === 'simulated',
    ...(errorDetails ? { reason: errorDetails } : {}),
  };
}

/**
 * Sends an urgent notification to a property owner/builder/agent
 * when a buyer inquires or books a site visit, respecting their user preferences.
 */
async function notifySellerOnNewLead({ sellerUser, inquiry, property }) {
  if (!sellerUser) return;

  const shouldSendSms = Boolean(sellerUser.smsNotifications);
  if (!shouldSendSms || !sellerUser.phone) {
    return { skipped: true, reason: 'SMS_DISABLED_OR_NO_PHONE' };
  }

  const propTitle = property?.title || inquiry?.propertyTitle || 'Your Property Listing';
  const buyerName = inquiry?.name || 'A buyer';
  const buyerPhone = inquiry?.phone || 'Phone on request';

  let smsText = '';
  let type = 'LEAD_ALERT';

  if (inquiry.visitRequested || inquiry.visitDate) {
    type = 'SITE_VISIT_BOOKED';
    const dateStr = inquiry.visitDate ? ` on ${inquiry.visitDate}` : '';
    const timeStr = inquiry.visitTime ? ` at ${inquiry.visitTime}` : '';
    smsText = `[EstateXplorer] New Site Visit booked by ${buyerName} for "${propTitle}"${dateStr}${timeStr}. Buyer Contact: ${buyerPhone}. Review booking details in your portal: ${process.env.CLIENT_URL || 'https://estatexplorer.com'}/dashboard`;
  } else {
    smsText = `[EstateXplorer] New Inquiry from ${buyerName} for "${propTitle}". Buyer Contact: ${buyerPhone}. Review and respond in your portal: ${process.env.CLIENT_URL || 'https://estatexplorer.com'}/dashboard`;
  }

  return await sendSmsGateway({
    phone: sellerUser.phone,
    message: smsText,
    type,
    recipient: sellerUser,
    metadata: {
      inquiryId: inquiry._id,
      propertyId: property?._id,
      buyerName,
    },
  });
}

/**
 * Sends a confirmation SMS to the buyer when a site visit is confirmed or rescheduled.
 */
async function notifyBuyerOnStatusChange({ buyerUser, inquiry, property, newStatus, extraData = {} }) {
  const recipientPhone = buyerUser?.phone || inquiry?.phone;
  if (!recipientPhone) return { skipped: true, reason: 'NO_PHONE' };

  // If buyerUser exists and explicitly disabled SMS, respect that
  if (buyerUser && buyerUser.smsNotifications === false) {
    return { skipped: true, reason: 'BUYER_SMS_DISABLED' };
  }

  const propTitle = property?.title || inquiry?.propertyTitle || 'Property';
  let smsText = '';
  let type = 'STATUS_UPDATE';

  if (newStatus === 'closed') {
    type = 'SITE_VISIT_CONFIRMED';
    smsText = `[EstateXplorer] Your site tour for "${propTitle}" has been marked confirmed & completed. Thank you for choosing EstateXplorer. Explore more properties anytime at ${process.env.CLIENT_URL || 'https://estatexplorer.com'}.`;
  } else if (newStatus === 'visit') {
    type = 'SITE_VISIT_RESCHEDULED';
    const dateStr = extraData.visitDate || inquiry.visitDate || 'upcoming date';
    const timeStr = extraData.visitTime || inquiry.visitTime ? ` at ${extraData.visitTime || inquiry.visitTime}` : '';
    smsText = `[EstateXplorer] Your site tour appointment for "${propTitle}" has been scheduled for ${dateStr}${timeStr}. Please arrive 10 minutes prior. Manage tour: ${process.env.CLIENT_URL || 'https://estatexplorer.com'}/dashboard`;
  } else {
    return { skipped: true, reason: 'NO_SMS_TEMPLATE_FOR_STATUS' };
  }

  return await sendSmsGateway({
    phone: recipientPhone,
    message: smsText,
    type,
    recipient: buyerUser,
    metadata: {
      inquiryId: inquiry._id,
      propertyId: property?._id,
      newStatus,
    },
  });
}

/**
 * Sends a 6-digit phone verification OTP via Twilio Verify Service API,
 * with fallback to sending via SMS gateway or local OTP store.
 */
async function sendTwilioPhoneOtp({ phone }) {
  const cleanPhone = normalizePhoneNumber(phone);
  if (!cleanPhone || cleanPhone.length < 10) {
    return { success: false, reason: 'INVALID_PHONE', message: 'Invalid 10-digit mobile number' };
  }

  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioAuth = process.env.TWILIO_AUTH_TOKEN;
  const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID || process.env.VERIFY_SERVICE_SID;

  const formattedTo = cleanPhone.startsWith('91') ? `+${cleanPhone}` : `+91${cleanPhone}`;

  // 1. Try Twilio Verify API if configured
  if (twilioSid && twilioAuth && verifyServiceSid && !twilioSid.startsWith('mock_')) {
    try {
      const authHeader = 'Basic ' + Buffer.from(`${twilioSid}:${twilioAuth}`).toString('base64');
      const postData = new URLSearchParams({
        To: formattedTo,
        Channel: 'sms',
      }).toString();

      const response = await new Promise((resolve, reject) => {
        const req = https.request(
          `https://verify.twilio.com/v2/Services/${verifyServiceSid}/Verifications`,
          {
            method: 'POST',
            headers: {
              Authorization: authHeader,
              'Content-Type': 'application/x-www-form-urlencoded',
              'Content-Length': Buffer.byteLength(postData),
            },
            timeout: 8000,
          },
          (res) => {
            let data = '';
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
          }
        );

        req.on('error', reject);
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('Twilio Verify Service timeout'));
        });

        req.write(postData);
        req.end();
      });

      let parsed = {};
      try {
        parsed = JSON.parse(response.body);
      } catch (e) {
        parsed = { raw: response.body };
      }

      if (response.statusCode >= 200 && response.statusCode < 300) {
        return {
          success: true,
          method: 'twilio_verify',
          status: parsed.status || 'pending',
          message: 'OTP verification code dispatched to your phone via Twilio.',
        };
      } else {
        console.warn('[Twilio Verify API Warning]:', parsed.message || response.body);
      }
    } catch (err) {
      console.warn('[Twilio Verify Exception]:', err.message);
    }
  }

  // 2. Fallback: Generate local 6-digit OTP and store in OTP collection
  const OTP = require('../models/OTP');
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await OTP.deleteMany({ phone: cleanPhone, purpose: 'phone_verify' });
  await OTP.create({
    phone: cleanPhone,
    code,
    purpose: 'phone_verify',
    expiresAt,
  });

  console.log(`📱 Generated Mobile Verification OTP for +91-${cleanPhone}: ${code}`);

  // Dispatch via gateway SMS
  await sendSmsGateway({
    phone: cleanPhone,
    message: `[EstateXplorer] Your mobile verification code is ${code}. It expires in 10 minutes. Do not share this code with anyone.`,
    type: 'PHONE_VERIFY_OTP',
  });

  return {
    success: true,
    method: 'gateway_otp',
    message: 'OTP verification code sent to your mobile phone.',
  };
}

/**
 * Verifies a 6-digit phone verification OTP via Twilio Verify Service API or local OTP fallback.
 */
async function verifyTwilioPhoneOtp({ phone, code }) {
  const cleanPhone = normalizePhoneNumber(phone);
  if (!cleanPhone || cleanPhone.length < 10) {
    return { success: false, message: 'Invalid 10-digit mobile number' };
  }
  if (!code || String(code).trim().length !== 6) {
    return { success: false, message: 'Please provide a valid 6-digit verification code' };
  }

  const cleanCode = String(code).trim();
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioAuth = process.env.TWILIO_AUTH_TOKEN;
  const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID || process.env.VERIFY_SERVICE_SID;
  const formattedTo = cleanPhone.startsWith('91') ? `+${cleanPhone}` : `+91${cleanPhone}`;

  // 1. Try Twilio Verify Check if service SID configured
  if (twilioSid && twilioAuth && verifyServiceSid && !twilioSid.startsWith('mock_')) {
    try {
      const authHeader = 'Basic ' + Buffer.from(`${twilioSid}:${twilioAuth}`).toString('base64');
      const postData = new URLSearchParams({
        To: formattedTo,
        Code: cleanCode,
      }).toString();

      const response = await new Promise((resolve, reject) => {
        const req = https.request(
          `https://verify.twilio.com/v2/Services/${verifyServiceSid}/VerificationCheck`,
          {
            method: 'POST',
            headers: {
              Authorization: authHeader,
              'Content-Type': 'application/x-www-form-urlencoded',
              'Content-Length': Buffer.byteLength(postData),
            },
            timeout: 8000,
          },
          (res) => {
            let data = '';
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
          }
        );

        req.on('error', reject);
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('Twilio VerificationCheck timeout'));
        });

        req.write(postData);
        req.end();
      });

      let parsed = {};
      try {
        parsed = JSON.parse(response.body);
      } catch (e) {
        parsed = { raw: response.body };
      }

      console.log(`[Twilio VerifyCheck] Response code: ${response.statusCode}, body: ${response.body}`);

      if (response.statusCode >= 200 && response.statusCode < 300 && (parsed.status === 'approved' || parsed.valid === true)) {
        return {
          success: true,
          status: 'approved',
          message: 'Phone number verified successfully via Twilio.',
        };
      }
    } catch (err) {
      console.warn('[Twilio VerificationCheck error]:', err.message);
    }
  }

  // 2. Check local OTP fallback collection
  const OTP = require('../models/OTP');
  const otpRecord = await OTP.findOne({
    phone: cleanPhone,
    code: cleanCode,
    purpose: 'phone_verify',
    expiresAt: { $gt: new Date() },
  });

  if (otpRecord) {
    await OTP.deleteOne({ _id: otpRecord._id });
    return {
      success: true,
      status: 'approved',
      message: 'Phone number verified successfully.',
    };
  }

  return {
    success: false,
    message: 'Invalid or expired mobile verification code. Please request a new OTP.',
  };
}

module.exports = {
  sendSmsGateway,
  notifySellerOnNewLead,
  notifyBuyerOnStatusChange,
  normalizePhoneNumber,
  sendTwilioPhoneOtp,
  verifyTwilioPhoneOtp,
};

