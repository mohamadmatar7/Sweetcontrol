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

  const subject = 'Bedankt voor je donatie aan SweetControl';

  const html = `
  <body style="margin:0; padding:0; background-color:#120b2b; font-family:Arial, Helvetica, sans-serif;">
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#120b2b; padding:40px 0;">
      <tr>
        <td align="center">
          <table width="520" cellpadding="0" cellspacing="0" style="background:#0b051d; border-radius:24px; box-shadow:0 12px 40px rgba(0,0,0,0.5); overflow:hidden; border:1px solid #4c37ff;">
            <!-- Header bar -->
            <tr>
              <td style="background:linear-gradient(135deg,#5a3ffb,#d946ef); padding:26px 24px; text-align:center;">
                <h1 style="color:#fef3c7; margin:0; font-size:26px; font-weight:900; letter-spacing:0.08em; text-transform:uppercase;">
                  Sweet Control
                </h1>
                <p style="color:#fdf2ff; margin:10px 0 0; font-size:14px; letter-spacing:0.16em; text-transform:uppercase;">
                  Bedankt voor je donatie
                </p>
              </td>
            </tr>

            <!-- Main content card -->
            <tr>
              <td style="padding:24px 20px 26px 20px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center">
                      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:460px; background:#ffffff; border-radius:24px; padding:22px 22px 24px 22px; border:1px solid #e5e7eb;">
                        <tr>
                          <td style="text-align:left;">
                            <h2 style="color:#111827; font-size:20px; margin:0 0 12px 0; font-weight:800;">
                              Hoi ${name || 'speler'},
                            </h2>

                            <p style="color:#374151; font-size:14px; margin:0 0 12px 0; line-height:1.6;">
                              We hebben je donatie van
                              <strong style="color:#5b21ff;">€${amount}</strong> goed ontvangen.
                            </p>

                            <p style="color:#374151; font-size:14px; margin:0 0 14px 0; line-height:1.6;">
                              Met deze donatie heb je
                              <strong>${credits}</strong> ${credits === 1 ? 'credit' : 'credits'} gekocht
                              voor de SweetControl-machine.
                            </p>

                            <p style="color:#374151; font-size:14px; margin:0 0 18px 0; line-height:1.6;">
                              Elke credit staat gelijk aan <strong>35 seconden</strong> speeltijd.
                              In totaal heb je dus <strong>${seconds}</strong> seconden om te spelen.
                            </p>

                            <table cellpadding="0" cellspacing="0" align="center" style="margin:8px auto 20px auto;">
                              <tr>
                                <td style="background:#f9fafb; border-radius:999px; padding:8px 18px; border:1px dashed #c4b5fd; font-size:12px; color:#4b5563; text-align:center;">
                                  🎟️ <strong style="color:#4c1d95;">${credits}</strong> ${credits === 1 ? 'credit' : 'credits'}
                                  &nbsp;·&nbsp; ⏱️ <strong style="color:#4c1d95;">${seconds}s</strong> speeltijd
                                </td>
                              </tr>
                            </table>

                            <p style="color:#6b7280; font-size:12px; margin:0 0 6px 0; line-height:1.6;">
                              Wanneer je bij de machine bent en de QR-code scant,
                              kom je automatisch in de wachtrij. Volg daarna gewoon de
                              instructies op het scherm om te spelen.
                            </p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <!-- Footer copy inside dark card -->
                  <tr>
                    <td style="padding-top:18px; text-align:center;">
                      <p style="color:#e5e7eb; font-size:12px; margin:0 0 6px 0; line-height:1.5;">
                        Veel speelplezier en succes met je grijppogingen!
                      </p>
                      <p style="color:#9ca3af; font-size:11px; margin:0; line-height:1.4;">
                        Dankjewel om SweetControl en De Warmste Week te steunen.<br>
                        Met vriendelijke groet,<br>
                        <span style="color:#e5e7eb;">het SweetControl-team</span>
                      </p>
                    </td>
                  </tr>
                </table>
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
