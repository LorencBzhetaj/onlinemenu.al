import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// PËR TANI: onboarding@resend.dev (domain testi i Resend, punon menjëherë).
// PAS verifikimit të DNS-së për onlinemenu.al → ndrysho EMAIL_FROM te env në
// "MenuDigjitale <noreply@onlinemenu.al>".
const EMAIL_FROM = process.env.EMAIL_FROM || "MenuDigjitale <onboarding@resend.dev>";

export async function sendPasswordResetEmail(to: string, resetLink: string) {
  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;background:#0f1720;color:#f5f0e6;padding:32px 24px;border-radius:12px;max-width:520px;margin:0 auto;">
    <h1 style="font-size:22px;color:#c9a24b;margin:0 0 16px;">Rivendos Password-in Tënd</h1>
    <p style="font-size:15px;line-height:1.6;color:#d8d2c4;margin:0 0 24px;">
      Ke kërkuar të rivendosësh password-in për llogarinë tënde te MenuDigjitale.
      Kliko butonin më poshtë për të vendosur një password të ri.
    </p>
    <a href="${resetLink}"
       style="display:inline-block;background:#c9a24b;color:#0f1720;text-decoration:none;font-weight:bold;padding:14px 28px;border-radius:8px;font-size:15px;">
      Rivendos Password-in
    </a>
    <p style="font-size:13px;line-height:1.6;color:#9aa0a6;margin:24px 0 0;">
      Ose kopjo këtë link:<br />
      <span style="color:#c9a24b;word-break:break-all;">${resetLink}</span>
    </p>
    <p style="font-size:13px;line-height:1.6;color:#9aa0a6;margin:24px 0 0;border-top:1px solid rgba(255,255,255,0.1);padding-top:16px;">
      Ky link skadon pas <strong>1 ore</strong>. Nëse s'e keni kërkuar këtë, injoroni këtë email.
    </p>
  </div>`;

  const { data, error } = await resend.emails.send({
    from: EMAIL_FROM,
    to,
    subject: "Rivendos Password-in Tënd — MenuDigjitale",
    html,
  });

  if (error) {
    // Kthe gabimin që thirrësi ta logojë (por s'ia zbulon përdoruesit).
    return { ok: false as const, error };
  }
  return { ok: true as const, id: data?.id };
}
