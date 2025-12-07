const nodemailer = require('nodemailer');

// Reusable transporter (Combell SMTP)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 465,
  secure: true, // SSL/TLS
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  logger: process.env.NODEMAILER_DEBUG === 'true',
  debug: process.env.NODEMAILER_DEBUG === 'true',
});

// ✅ Check SMTP connection on startup
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ SMTP connection failed:', error.message);
  } else {
    console.log('✅ SMTP server ready to send mail');
  }
});

// ----------------------------------------------------
//  Main function to send the thank-you email
// ----------------------------------------------------
async function sendThankYouEmail(to, name, amount, credits, seconds) {
  if (!to) {
    console.warn('⚠️ No email provided — skipping sendThankYouEmail()');
    return;
  }

  const subject = 'Bedankt voor je donatie aan SweetControl 🎮';

  const html = `
  <body style="margin:0; padding:0; background-color:#f4f7f6; font-family:Arial, Helvetica, sans-serif;">
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#f4f7f6; padding:40px 0;">
      <tr>
        <td align="center">
          <table width="500" cellpadding="0" cellspacing="0" style="background:white; border-radius:12px; box-shadow:0 4px 15px rgba(0,0,0,0.08); overflow:hidden;">
            <tr>
              <td style="background:linear-gradient(135deg,#16a34a,#10b981); padding:30px; text-align:center;">
                <h1 style="color:white; margin:0; font-size:26px; font-weight:800;">🎮 SweetControl</h1>
                <p style="color:#d1fae5; margin:8px 0 0; font-size:14px;">Bedankt voor je steun!</p>
              </td>
            </tr>
            <tr>
              <td style="padding:30px;">
                <h2 style="color:#111827; font-size:20px; margin-bottom:10px;">Hoi ${name || 'speler'} 👋</h2>
                <p style="color:#374151; font-size:15px; margin:0 0 15px;">
                  We hebben je donatie van <strong style="color:#16a34a;">€${amount}</strong> goed ontvangen.
                </p>
                <p style="color:#374151; font-size:15px; margin:0 0 20px;">
                  Je hebt <strong>${credits}</strong> ${credits === 1 ? 'credit' : 'credits'} gekregen —
                  dat betekent <strong>${seconds}</strong> seconden speeltijd 🎮
                </p>
                <div style="text-align:center; margin-top:30px;">
                  <div style="display:inline-block; background-color:#10b981; color:white; padding:10px 25px; border-radius:25px; font-weight:bold; font-size:14px;">
                    Klaar om te spelen!
                  </div>
                </div>
              </td>
            </tr>
            <tr>
              <td style="background-color:#f9fafb; padding:20px; text-align:center; border-top:1px solid #e5e7eb;">
                <p style="color:#6b7280; font-size:12px; margin:0;">
                  Veel plezier met spelen!<br>
                  — Het SweetControl Team
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  `;

  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to,
      subject,
      html,
    });
    console.log(`📧 Email sent to ${to}: ${info.response || 'queued'}`);
  } catch (err) {
    console.error('❌ Email sending failed:', err);
  }
}

module.exports = {
  sendThankYouEmail,
};
