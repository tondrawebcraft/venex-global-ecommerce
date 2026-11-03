import nodemailer from 'nodemailer';

export async function sendPasswordReset(user, url) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) return false;
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT || 587) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
  });
  await transport.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to: user.email,
    subject: 'Reset your VENEX GLOBAL password',
    text: `Use this secure link within 30 minutes to reset your password:\n\n${url}\n\nIf you did not request this, you can ignore this email.`,
    html: `<p>Use this secure link within 30 minutes to reset your password.</p><p><a href="${url}">Reset your password</a></p><p>If you did not request this, you can ignore this email.</p>`
  });
  return true;
}

