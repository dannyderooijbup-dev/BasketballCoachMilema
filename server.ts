import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

// Body parser
app.use(express.json());

// Helper function to send email via SMTP or Resend HTTP API
async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM || smtpUser || "noreply@basketballcoach.nl";
  const resendApiKey = process.env.RESEND_API_KEY;
  const resendFrom = process.env.RESEND_FROM || "onboarding@resend.dev";

  // Option 1: Use Nodemailer with SMTP if configured
  if (smtpHost && smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465, // true for 465, false for other ports
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      const info = await transporter.sendMail({
        from: smtpFrom,
        to,
        subject,
        text,
        html,
      });

      console.log(`[SMTP] Email successfully sent to ${to}: ${info.messageId}`);
      return { success: true, method: "SMTP", messageId: info.messageId };
    } catch (error) {
      console.error(`[SMTP Error] Failed to send email to ${to}:`, error);
      throw error;
    }
  }

  // Option 2: Use Resend API if configured
  if (resendApiKey) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: resendFrom,
          to: [to],
          subject,
          html,
          text,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Resend API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log(`[Resend] Email successfully sent to ${to}: ${data.id}`);
      return { success: true, method: "Resend", id: data.id };
    } catch (error) {
      console.error(`[Resend Error] Failed to send email to ${to}:`, error);
      throw error;
    }
  }

  // Option 3: Fallback Mock (logs email contents)
  console.log(`\n======================================================`);
  console.log(`[EMAIL FALLBACK MOCK] No email provider configured.`);
  console.log(`To enable live emails, set up SMTP or Resend environment variables.`);
  console.log(`------------------------------------------------------`);
  console.log(`To:      ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(`Text:    ${text}`);
  console.log(`======================================================\n`);

  return {
    success: true,
    method: "Mock",
    warning: "Email printed to console (No SMTP or Resend keys configured in environment)",
  };
}

// API Routes
app.post("/api/send-registration-email", async (req, res) => {
  try {
    const { email, name, role, club } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is verplicht." });
    }

    const displayName = name || email.split("@")[0];
    const coachRole = role || "Coach";
    const coachClub = club || "Niet gespecificeerd";
    const adminEmail = "dannyderooij020@gmail.com";

    // 1. Visitor Welcome Email Template
    const visitorSubject = "Welkom bij Basketball Coach - Bevestiging van je registratie 🏀";
    const visitorText = `Beste ${displayName},\n\nWelkom bij Basketball Coach Game Stats!\nJe account is succesvol aangemaakt. Je kunt nu direct aan de slag met het bijhouden van spelerstatistieken, wedstrijden beheren en je teams organiseren.\n\nSportieve groet,\nHet Basketball Coach Team`;
    
    const visitorHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: #0b0f19;
            color: #f3f4f6;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 600px;
            margin: 20px auto;
            background-color: #111827;
            border-radius: 16px;
            border: 1px solid rgba(255, 255, 255, 0.08);
            overflow: hidden;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
          }
          .header {
            background-color: #1f2937;
            background-image: linear-gradient(135deg, #FF6A00 0%, #e65c00 100%);
            padding: 30px 20px;
            text-align: center;
          }
          .header h1 {
            color: #ffffff;
            font-size: 24px;
            font-weight: 900;
            margin: 0;
            text-transform: uppercase;
            letter-spacing: -0.025em;
            font-style: italic;
          }
          .header p {
            color: rgba(255, 255, 255, 0.9);
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.2em;
            margin: 5px 0 0 0;
            font-weight: 800;
          }
          .content {
            padding: 30px 25px;
            line-height: 1.6;
            color: #e5e7eb;
          }
          .greeting {
            font-size: 18px;
            font-weight: 700;
            color: #ffffff;
            margin-top: 0;
            margin-bottom: 15px;
          }
          .intro-text {
            font-size: 15px;
            margin-bottom: 25px;
          }
          .btn-container {
            text-align: center;
            margin: 30px 0;
          }
          .btn {
            background-color: #FF6A00;
            color: #ffffff !important;
            text-decoration: none;
            padding: 12px 28px;
            font-weight: 700;
            border-radius: 8px;
            display: inline-block;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            transition: background-color 0.2s;
          }
          .btn:hover {
            background-color: #e65c00;
          }
          .features {
            background-color: rgba(255, 255, 255, 0.02);
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 25px;
          }
          .features h3 {
            margin-top: 0;
            font-size: 14px;
            text-transform: uppercase;
            color: #FF6A00;
            letter-spacing: 0.1em;
          }
          .features ul {
            margin: 0;
            padding-left: 20px;
          }
          .features li {
            margin-bottom: 8px;
            font-size: 14px;
          }
          .footer {
            background-color: #0b0f19;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #9ca3af;
            border-top: 1px solid rgba(255, 255, 255, 0.05);
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Basketball Coach</h1>
            <p>Game Stats Dashboard</p>
          </div>
          <div class="content">
            <p class="greeting">Beste ${displayName},</p>
            <p class="intro-text">Welkom aan boord! Je account is succesvol aangemaakt op ons platform. Vanaf nu heb je de tools in handen om je team naar de overwinning te leiden en statistieken op professionele wijze te analyseren.</p>
            
            <div class="features">
              <h3>Wat kun je nu doen?</h3>
              <ul>
                <li><strong>Teams & Spelers Beheren:</strong> Voeg teams toe, selecteer posities en stel rugnummers in.</li>
                <li><strong>Wedstrijden Vastleggen:</strong> Houd in real-time speeltijd, fouten en scores bij tijdens de wedstrijd.</li>
                <li><strong>Statistieken Analyseren:</strong> Bekijk per wedstrijd of over het hele seizoen de prestaties per speler (punten, rebounds, assists, schotpercentages).</li>
                <li><strong>Exporteren:</strong> Genereer professionele PDF-rapporten van je statistieken om te delen met spelers of de club.</li>
              </ul>
            </div>

            <div class="btn-container">
              <a href="${process.env.APP_URL || "https://basketballcoach.nl"}" class="btn" target="_blank">Start Dashboard</a>
            </div>

            <p style="margin-bottom: 0;">Sportieve groet,<br><strong>Het Basketball Coach Team</strong></p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Basketball Coach Game Stats. Alle rechten voorbehouden.</p>
            <p style="font-size: 10px; margin-top: 5px; color: #6b7280;">Dit is een automatisch verzonden bericht. Beantwoorden is niet mogelijk.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // 2. Admin Notification Email Template
    const adminSubject = `🚨 Nieuwe Coach Geregistreerd: ${email}`;
    const adminText = `Hallo Admin,\n\nEr is zojuist een nieuwe coach geregistreerd op het platform!\n\nGegevens:\n- Email: ${email}\n- Naam: ${displayName}\n- Rol: ${coachRole}\n- Club: ${coachClub}\n- Tijdstip: ${new Date().toLocaleString("nl-NL")}\n\nMet vriendelijke groet,\nBasketball Coach Systeem`;
    
    const adminHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: #0b0f19;
            color: #f3f4f6;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 600px;
            margin: 20px auto;
            background-color: #111827;
            border-radius: 16px;
            border: 1px solid rgba(255, 255, 255, 0.08);
            overflow: hidden;
          }
          .header {
            background-color: #1f2937;
            border-bottom: 2px solid #FF6A00;
            padding: 20px;
            text-align: center;
          }
          .header h2 {
            color: #ffffff;
            margin: 0;
            font-size: 20px;
            font-style: italic;
            text-transform: uppercase;
          }
          .content {
            padding: 25px;
            color: #e5e7eb;
          }
          .table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            background-color: rgba(255, 255, 255, 0.02);
            border-radius: 8px;
            overflow: hidden;
          }
          .table th, .table td {
            padding: 12px 15px;
            text-align: left;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          }
          .table th {
            background-color: rgba(255, 255, 255, 0.05);
            font-weight: bold;
            color: #FF6A00;
            width: 30%;
          }
          .footer {
            background-color: #0b0f19;
            padding: 15px;
            text-align: center;
            font-size: 11px;
            color: #6b7280;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>🚨 Nieuwe Registratie Melding</h2>
          </div>
          <div class="content">
            <p>Beste Admin,</p>
            <p>Er is zojuist een nieuwe coach geregistreerd in de <strong>Basketball Coach</strong> app. Hieronder vind je de details van de nieuwe gebruiker:</p>
            
            <table class="table">
              <tr>
                <th>E-mailadres</th>
                <td><strong>${email}</strong></td>
              </tr>
              <tr>
                <th>Naam</th>
                <td>${displayName}</td>
              </tr>
              <tr>
                <th>Functie/Rol</th>
                <td>${coachRole}</td>
              </tr>
              <tr>
                <th>Club/Vereniging</th>
                <td>${coachClub}</td>
              </tr>
              <tr>
                <th>Registratietijd</th>
                <td>${new Date().toLocaleString("nl-NL")}</td>
              </tr>
            </table>
            
            <p>Met sportieve groet,<br><strong>Systeem Notificaties</strong></p>
          </div>
          <div class="footer">
            <p>Automatisch gegenereerd door het Basketball Coach Platform.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send both emails in parallel in the background to avoid blocking the client UI
    res.json({
      success: true,
      message: "Registration email processing started in the background."
    });

    Promise.allSettled([
      sendEmail({ to: email, subject: visitorSubject, html: visitorHtml, text: visitorText }),
      sendEmail({ to: adminEmail, subject: adminSubject, html: adminHtml, text: adminText }),
    ]).then((results) => {
      const visitorResult = results[0];
      const adminResult = results[1];
      console.log("Background email sending completed. Visitor:", visitorResult.status, "Admin:", adminResult.status);
    }).catch((err) => {
      console.error("Error in background email sending:", err);
    });
  } catch (error: any) {
    console.error("Fout bij het verwerken van registratiemail:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Interne serverfout bij verzenden e-mails.", details: error.message });
    }
  }
});

// Vite middleware / Static serving setup
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
