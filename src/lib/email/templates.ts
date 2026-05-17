/** Returns the full HTML for the Sondar welcome e-mail. */
export function welcomeEmail(opts: {
  firstName: string
  ctaUrl: string
}): { subject: string; html: string } {
  const { firstName, ctaUrl } = opts

  const subject = `Welcome to Sondar, ${firstName} — find your people 🎸`

  const html = /* html */`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Welcome to Sondar</title>
  <style>
    @media only screen and (max-width: 600px) {
      .wrapper { padding: 24px 16px !important; }
      .card    { padding: 32px 24px !important; }
      .h1      { font-size: 36px !important; }
      .cta     { width: 100% !important; text-align: center !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#0D0D0D;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">

  <!-- Outer wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"
         style="background:#0D0D0D;min-height:100vh;">
    <tr>
      <td align="center" class="wrapper" style="padding:48px 24px;">

        <!-- Card -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"
               style="max-width:520px;margin:0 auto;">
          <tr>
            <td class="card"
                style="background:#141414;border-radius:20px;padding:48px 40px;
                       border:1px solid rgba(255,255,255,0.08);
                       box-shadow:0 0 80px rgba(255,85,0,0.08);">

              <!-- Logo row -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
                <tr>
                  <td>
                    <!-- Orange ping dot + wordmark -->
                    <table cellpadding="0" cellspacing="0" border="0" role="presentation">
                      <tr>
                        <td style="vertical-align:middle;padding-right:10px;">
                          <div style="width:10px;height:10px;border-radius:50%;background:#FF5500;
                                      box-shadow:0 0 12px rgba(255,85,0,0.9);"></div>
                        </td>
                        <td style="vertical-align:middle;">
                          <span style="font-size:22px;font-weight:900;letter-spacing:0.12em;
                                       color:#F0EFEB;text-transform:uppercase;
                                       font-family:Georgia,'Times New Roman',serif;">SONDAR</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <div style="height:1px;background:rgba(255,255,255,0.06);margin:28px 0;"></div>

              <!-- Headline -->
              <h1 class="h1"
                  style="margin:0 0 12px;font-size:44px;font-weight:900;
                         letter-spacing:0.03em;line-height:1;color:#F0EFEB;
                         text-transform:uppercase;">
                Find your people.<br/>Make noise.
              </h1>

              <!-- Subline -->
              <p style="margin:0 0 32px;font-size:16px;line-height:1.6;
                        color:rgba(240,239,235,0.55);">
                Hey ${firstName}, you're in. Sondar connects musicians in the same city —
                drop your profile, find your bandmates, and make it happen.
              </p>

              <!-- CTA button -->
              <table cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin-bottom:32px;">
                <tr>
                  <td class="cta" align="center"
                      style="background:#FF5500;border-radius:999px;
                             box-shadow:0 0 32px rgba(255,85,0,0.45);">
                    <a href="${ctaUrl}"
                       style="display:inline-block;padding:14px 32px;
                              font-size:15px;font-weight:700;color:#000000;
                              text-decoration:none;letter-spacing:0.02em;
                              white-space:nowrap;">
                      Open Sondar →
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Feature list -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"
                     style="margin-bottom:36px;">
                ${[
                  ['🎸', 'Build your profile', 'Set your instrument, genre, and vibe in under 2 minutes.'],
                  ['📍', 'Find musicians nearby', 'See who\'s within walking distance and what they play.'],
                  ['🎵', 'Book a rehearsal space', 'Rent a room by the hour — no long-term commitment.'],
                ].map(([icon, title, desc]) => `
                <tr>
                  <td style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
                    <table cellpadding="0" cellspacing="0" border="0" role="presentation">
                      <tr>
                        <td style="font-size:20px;padding-right:14px;vertical-align:top;
                                   padding-top:2px;">${icon}</td>
                        <td>
                          <p style="margin:0 0 3px;font-size:14px;font-weight:700;
                                    color:#F0EFEB;">${title}</p>
                          <p style="margin:0;font-size:13px;color:rgba(240,239,235,0.45);
                                    line-height:1.5;">${desc}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>`).join('')}
              </table>

              <!-- Divider -->
              <div style="height:1px;background:rgba(255,255,255,0.06);margin:0 0 28px;"></div>

              <!-- Footer -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
                <tr>
                  <td>
                    <p style="margin:0 0 8px;font-size:12px;color:rgba(240,239,235,0.25);
                               letter-spacing:0.08em;text-transform:uppercase;">
                      Sondar · Sound Est. Berlin 26
                    </p>
                    <p style="margin:0;font-size:11px;color:rgba(240,239,235,0.18);
                               line-height:1.6;">
                      You received this because you signed up at sondar.app.
                      If that wasn't you, you can safely ignore this email.
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
</html>`

  return { subject, html }
}

/** Returns the HTML for the Supabase email confirmation template.
 *  Paste this into: Supabase Dashboard → Auth → Email Templates → Confirm signup
 */
export function confirmationEmailTemplate(): string {
  return /* html */`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Confirm your Sondar account</title>
</head>
<body style="margin:0;padding:0;background:#0D0D0D;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"
         style="background:#0D0D0D;padding:48px 24px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation"
               style="max-width:500px;margin:0 auto;background:#141414;border-radius:20px;
                      padding:40px;border:1px solid rgba(255,255,255,0.08);">
          <tr>
            <td>
              <p style="margin:0 0 24px;font-size:22px;font-weight:900;
                         letter-spacing:0.12em;color:#F0EFEB;text-transform:uppercase;">
                ● SONDAR
              </p>
              <h1 style="margin:0 0 12px;font-size:28px;font-weight:900;
                          color:#F0EFEB;text-transform:uppercase;letter-spacing:0.02em;">
                Confirm your email
              </h1>
              <p style="margin:0 0 28px;font-size:15px;line-height:1.6;
                        color:rgba(240,239,235,0.55);">
                One click and you're in. Tap the button below to confirm your
                Sondar account and start finding your people.
              </p>
              <table cellpadding="0" cellspacing="0" border="0" role="presentation"
                     style="margin-bottom:28px;">
                <tr>
                  <td style="background:#FF5500;border-radius:999px;
                             box-shadow:0 0 28px rgba(255,85,0,0.4);">
                    <a href="{{ .ConfirmationURL }}"
                       style="display:inline-block;padding:14px 32px;
                              font-size:15px;font-weight:700;color:#000;
                              text-decoration:none;">
                      Confirm my account →
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:11px;color:rgba(240,239,235,0.20);
                        line-height:1.6;">
                If you didn't create a Sondar account, ignore this email.
                This link expires in 24 hours.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
