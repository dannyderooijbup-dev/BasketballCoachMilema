import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import { Resend } from "resend";

admin.initializeApp();

// Defining the secret RESEND_API_KEY for Firebase Cloud Functions
const resendApiKey = defineSecret("RESEND_API_KEY");

/**
 * Cloud Function die automatisch wordt geactiveerd bij een nieuw document in 'mail_queue'.
 * Verwerkt uitsluitend berichten met status "queued" en verstuurt deze via Resend API.
 */
export const processMailQueue = onDocumentCreated(
  {
    document: "mail_queue/{mailId}",
    secrets: [resendApiKey],
  },
  async (event) => {
    const snap = event.data;
    if (!snap) {
      console.log("[processMailQueue] Geen documentdata aanwezig in Firestore event.");
      return;
    }

    const mailData = snap.data();

    // Controleer of de status "queued" is
    if (!mailData || mailData.status !== "queued") {
      console.log(`[processMailQueue] Document status is '${mailData?.status}' (geen 'queued'). Verwerking overgeslagen.`);
      return;
    }

    const docRef = snap.ref;
    const apiKey = resendApiKey.value() || process.env.RESEND_API_KEY;

    if (!apiKey) {
      const errorMsg = "RESEND_API_KEY secret of omgevingsvariabele is niet ingesteld in Firebase Cloud Functions.";
      console.error(`[processMailQueue] ${errorMsg}`);
      await docRef.update({
        status: "failed",
        error: errorMsg,
        lastAttempt: Date.now(),
        attempts: admin.firestore.FieldValue.increment(1),
      });
      return;
    }

    const resend = new Resend(apiKey);
    const { to, subject, html, text } = mailData;

    try {
      const recipient = Array.isArray(to) ? to : [to];
      const sender = "Basketball Coach GameStats <onboarding@resend.dev>";

      console.log("[processMailQueue] LIVE SENDER:", sender);

      const response = await resend.emails.send({
        from: sender,
        to: recipient,
        subject: subject || "Notificatie vanuit Basketball Coach GameStats",
        html: html || undefined,
        text: text || (!html ? subject : undefined),
      });

      if (response.error) {
        const errorDetail = response.error.message || JSON.stringify(response.error);
        console.error(`[processMailQueue] Resend API fout voor ${to}:`, errorDetail);
        await docRef.update({
          status: "failed",
          error: errorDetail,
          lastAttempt: Date.now(),
          attempts: admin.firestore.FieldValue.increment(1),
        });
      } else {
        console.log(`[processMailQueue] E-mail succesvol verzonden naar ${to} (Resend ID: ${response.data?.id})`);
        await docRef.update({
          status: "sent",
          sentAt: Date.now(),
          resendId: response.data?.id || null,
        });
      }
    } catch (err: any) {
      const errorMsg = err?.message || "Onbekende fout tijdens aanroepen van Resend API";
      console.error(`[processMailQueue] Exception bij e-mailverzending naar ${to}:`, err);
      await docRef.update({
        status: "failed",
        error: errorMsg,
        lastAttempt: Date.now(),
        attempts: admin.firestore.FieldValue.increment(1),
      });
    }
  }
);
