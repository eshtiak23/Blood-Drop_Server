/**
 * email.js — Email notification service using Resend API
 *
 * Sends email alerts to donors when a blood request matches their blood group.
 * Requires RESEND_API_KEY in .env (from https://resend.com).
 *
 * Resend free tier: 100 emails/day, 3000/month, 10 req/sec rate limit.
 * Without a verified domain, can only send to the account owner's email.
 */

import { Resend } from "resend";

let resend;

function getResend() {
  if (!resend && process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isRealEmail(email) {
  if (!email) return false;
  const fakeDomains = ["blooddrop.com", "example.com", "test.com"];
  const domain = email.split("@")[1]?.toLowerCase();
  return domain && !fakeDomains.includes(domain);
}

export async function sendEmail({ to, subject, html }) {
  const client = getResend();
  if (!client) {
    console.log("[Email] RESEND_API_KEY not configured, skipping");
    return;
  }

  if (!isRealEmail(to)) {
    console.log("[Email] Skipping fake email:", to);
    return;
  }

  try {
    const { data, error } = await client.emails.send({
      from: "LifeDrop <onboarding@resend.dev>",
      to: [to],
      subject,
      html,
    });

    if (error) {
      console.error("[Email] Failed:", to, "-", error.message);
      return;
    }

    console.log("[Email] Sent:", to, "| ID:", data?.id);
  } catch (err) {
    console.error("[Email] Error:", to, "-", err.message);
  }
}

export async function sendBloodRequestEmails(donors, request) {
  const clientUrl = process.env.CLIENT_URL || "https://blood-drop-jade.vercel.app";

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: Arial, sans-serif; background: #f9fafb; padding: 20px;">
      <div style="max-width: 500px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
        <div style="background: linear-gradient(135deg, #EF4444, #DC2626); padding: 24px; text-align: center;">
          <div style="font-size: 32px;">\u{1FA78}</div>
          <h1 style="color: white; margin: 8px 0 4px; font-size: 20px;">Blood Request Alert</h1>
          <p style="color: rgba(255,255,255,0.85); margin: 0; font-size: 14px;">A patient needs your help</p>
        </div>
        <div style="padding: 24px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <span style="display: inline-block; padding: 8px 20px; border-radius: 20px; font-size: 18px; font-weight: 700; background: #FEE2E2; color: #DC2626;">
              ${request.patientBloodGroup} Blood Needed
            </span>
          </div>
          <table style="width: 100%; font-size: 14px; color: #374151;">
            <tr><td style="padding: 8px 0; color: #6B7280;">Patient</td><td style="padding: 8px 0; font-weight: 600;">${request.patientName}</td></tr>
            <tr><td style="padding: 8px 0; color: #6B7280;">Hospital</td><td style="padding: 8px 0; font-weight: 600;">${request.hospital}</td></tr>
            <tr><td style="padding: 8px 0; color: #6B7280;">Location</td><td style="padding: 8px 0; font-weight: 600;">${request.area}, ${request.district}</td></tr>
            <tr><td style="padding: 8px 0; color: #6B7280;">Units</td><td style="padding: 8px 0; font-weight: 600;">${request.unitsRequired}</td></tr>
            <tr><td style="padding: 8px 0; color: #6B7280;">Urgency</td><td style="padding: 8px 0; font-weight: 600;">${request.urgency}</td></tr>
            <tr><td style="padding: 8px 0; color: #6B7280;">Contact</td><td style="padding: 8px 0; font-weight: 600;">${request.contactNumber}</td></tr>
          </table>
          <div style="text-align: center; margin-top: 24px;">
            <a href="${clientUrl}/requests" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #EF4444, #DC2626); color: white; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 15px;">
              View Request
            </a>
          </div>
        </div>
        <div style="padding: 16px 24px; background: #f9fafb; text-align: center; font-size: 12px; color: #9CA3AF;">
          You received this because you have <strong>${request.patientBloodGroup}</strong> blood type.<br/>
          <a href="${clientUrl}/settings" style="color: #EF4444;">Update preferences</a>
        </div>
      </div>
    </body>
    </html>
  `;

  const realDonors = donors.filter((d) => isRealEmail(d.email));
  console.log(`[Email] ${realDonors.length} real emails out of ${donors.length} total donors`);

  let sent = 0;

  for (const donor of realDonors) {
    await sendEmail({
      to: donor.email,
      subject: `\u{1FA78} Urgent: ${request.patientBloodGroup} blood needed in ${request.district}`,
      html,
    });
    sent++;
    await delay(200);
  }

  console.log(`[Email] ${sent} attempted out of ${realDonors.length} real donors`);
}
