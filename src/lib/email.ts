import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// PËR TANI: onboarding@resend.dev (domain testi i Resend, punon menjëherë).
// PAS verifikimit të DNS-së për onlinemenu.al → ndrysho EMAIL_FROM te env në
// "OnlineMenu.al <noreply@onlinemenu.al>".
const EMAIL_FROM = process.env.EMAIL_FROM || "OnlineMenu.al <onboarding@resend.dev>";

export async function sendPasswordResetEmail(to: string, resetLink: string) {
  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;background:#fff8ee;color:#3a1035;border:1px solid #eedfd3;padding:32px 24px;border-radius:12px;max-width:520px;margin:0 auto;">
    <h1 style="font-size:22px;color:#4c1845;margin:0 0 16px;">Rivendos Password-in Tënd</h1>
    <p style="font-size:15px;line-height:1.6;color:#3a1035;margin:0 0 24px;">
      Ke kërkuar të rivendosësh password-in për llogarinë tënde te OnlineMenu.al.
      Kliko butonin më poshtë për të vendosur një password të ri.
    </p>
    <a href="${resetLink}"
       style="display:inline-block;background:#ffe16a;color:#4c1845;text-decoration:none;font-weight:bold;padding:14px 28px;border-radius:8px;font-size:15px;">
      Rivendos Password-in
    </a>
    <p style="font-size:13px;line-height:1.6;color:#6e4d68;margin:24px 0 0;">
      Ose kopjo këtë link:<br />
      <span style="color:#4c1845;word-break:break-all;">${resetLink}</span>
    </p>
    <p style="font-size:13px;line-height:1.6;color:#6e4d68;margin:24px 0 0;border-top:1px solid #eedfd3;padding-top:16px;">
      Ky link skadon pas <strong>1 ore</strong>. Nëse s'e keni kërkuar këtë, injoroni këtë email.
    </p>
  </div>`;

  const { data, error } = await resend.emails.send({
    from: EMAIL_FROM,
    to,
    subject: "Rivendos Password-in Tënd — OnlineMenu.al",
    html,
  });

  if (error) {
    // Kthe gabimin që thirrësi ta logojë (por s'ia zbulon përdoruesit).
    return { ok: false as const, error };
  }
  return { ok: true as const, id: data?.id };
}

// Verifikim email-i në regjistrim: butoni (link) DHE kodi 6-shifror te i njëjti email.
// Përdorimi i njërit çaktivizon tjetrin (i njëjti rekord). Verifikimi bëhet me POST
// pasi përdoruesi klikon butonin / fut kodin — hapja e thjeshtë e linkut nuk mjafton.
export async function sendVerificationEmail(to: string, verifyLink: string, code: string) {
  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;background:#fff8ee;color:#3a1035;border:1px solid #eedfd3;padding:32px 24px;border-radius:12px;max-width:520px;margin:0 auto;">
    <h1 style="font-size:22px;color:#4c1845;margin:0 0 16px;">Verifiko Email-in Tënd</h1>
    <p style="font-size:15px;line-height:1.6;color:#3a1035;margin:0 0 24px;">
      Mirë se erdhe te OnlineMenu.al! Për të aktivizuar llogarinë dhe provën falas,
      kliko butonin më poshtë dhe konfirmo verifikimin.
    </p>
    <a href="${verifyLink}"
       style="display:inline-block;background:#ffe16a;color:#4c1845;text-decoration:none;font-weight:bold;padding:14px 28px;border-radius:8px;font-size:15px;">
      Verifiko Email-in
    </a>
    <p style="font-size:14px;line-height:1.6;color:#3a1035;margin:28px 0 8px;">
      Ose vendos këtë kod 6-shifror në faqen e verifikimit:
    </p>
    <p style="font-size:30px;font-weight:bold;letter-spacing:8px;color:#4c1845;margin:0 0 24px;">
      ${code}
    </p>
    <p style="font-size:13px;line-height:1.6;color:#6e4d68;margin:8px 0 0;">
      Ose kopjo këtë link:<br />
      <span style="color:#4c1845;word-break:break-all;">${verifyLink}</span>
    </p>
    <p style="font-size:13px;line-height:1.6;color:#6e4d68;margin:24px 0 0;border-top:1px solid #eedfd3;padding-top:16px;">
      Linku dhe kodi skadojnë pas <strong>1 ore</strong> dhe përdoren vetëm një herë.
      Nëse s'e keni kërkuar këtë, injoroni këtë email.
    </p>
  </div>`;

  const { data, error } = await resend.emails.send({
    from: EMAIL_FROM,
    to,
    subject: "Verifiko email-in — OnlineMenu.al",
    html,
  });

  if (error) return { ok: false as const, error };
  return { ok: true as const, id: data?.id };
}
