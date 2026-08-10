"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.processMailQueue = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const params_1 = require("firebase-functions/params");
const admin = __importStar(require("firebase-admin"));
const resend_1 = require("resend");
admin.initializeApp();
// Defining the secret RESEND_API_KEY for Firebase Cloud Functions
const resendApiKey = (0, params_1.defineSecret)("RESEND_API_KEY");
/**
 * Cloud Function die automatisch wordt geactiveerd bij een nieuw document in 'mail_queue'.
 * Verwerkt uitsluitend berichten met status "queued" en verstuurt deze via Resend API.
 */
exports.processMailQueue = (0, firestore_1.onDocumentCreated)({
    document: "mail_queue/{mailId}",
    secrets: [resendApiKey],
}, async (event) => {
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
    const resend = new resend_1.Resend(apiKey);
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
        }
        else {
            console.log(`[processMailQueue] E-mail succesvol verzonden naar ${to} (Resend ID: ${response.data?.id})`);
            await docRef.update({
                status: "sent",
                sentAt: Date.now(),
                resendId: response.data?.id || null,
            });
        }
    }
    catch (err) {
        const errorMsg = err?.message || "Onbekende fout tijdens aanroepen van Resend API";
        console.error(`[processMailQueue] Exception bij e-mailverzending naar ${to}:`, err);
        await docRef.update({
            status: "failed",
            error: errorMsg,
            lastAttempt: Date.now(),
            attempts: admin.firestore.FieldValue.increment(1),
        });
    }
});
//# sourceMappingURL=index.js.map