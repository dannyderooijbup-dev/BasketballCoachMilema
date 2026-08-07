import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';

export interface BaseEmailOptions {
  recipientEmail: string;
  recipientName?: string;
  lang?: 'nl' | 'en';
}

export interface TrialStartedOptions extends BaseEmailOptions {
  trialEndDate?: number | string;
}

export interface CoachApprovedOptions extends BaseEmailOptions {}

export interface ClubApprovedOptions extends BaseEmailOptions {
  clubName?: string;
}

export interface TrialExpiringSoonOptions extends BaseEmailOptions {
  daysRemaining: number;
}

export interface TrialExpiredOptions extends BaseEmailOptions {}

export interface ClubInviteOptions extends BaseEmailOptions {
  clubName: string;
  role: string;
  inviterName: string;
}

export interface InviteAcceptedOptions extends BaseEmailOptions {
  inviterEmail?: string;
  inviterName?: string;
  memberName: string;
  memberEmail: string;
  clubName: string;
  role: string;
}

export interface AddedToClubWorkspaceOptions extends BaseEmailOptions {
  clubName: string;
  role: string;
}

export interface EmailDispatchPayload {
  to: string;
  subject: string;
  templateId: string;
  html: string;
  metadata?: Record<string, any>;
}

export interface TemplateParams {
  title: string;
  badgeText?: string;
  headline: string;
  bodyParagraphs: string[];
  ctaText?: string;
  ctaUrl?: string;
  footerNotice?: string;
  highlightBox?: {
    label: string;
    value: string;
  }[];
}

/**
 * Bouwt een centrale, responsive dark-themed HTML e-mailtemplate met Basketball Coach GameStats branding.
 */
export function generateEmailHtml(params: TemplateParams): string {
  const appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://app.basketballcoach.nl';
  const ctaTargetUrl = params.ctaUrl || appUrl;

  const highlightHtml = params.highlightBox && params.highlightBox.length > 0
    ? `
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 24px; margin-bottom: 24px; background-color: #111827; border: 1px solid #1F2937; border-radius: 12px; padding: 16px;">
        ${params.highlightBox.map(item => `
          <tr>
            <td style="padding: 6px 0; color: #9CA3AF; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">${item.label}:</td>
            <td style="padding: 6px 0; color: #F9FAFB; font-size: 14px; font-weight: 700; text-align: right;">${item.value}</td>
          </tr>
        `).join('')}
      </table>
    `
    : '';

  const ctaButtonHtml = params.ctaText
    ? `
      <div style="margin-top: 32px; margin-bottom: 24px; text-align: center;">
        <a href="${ctaTargetUrl}" target="_blank" style="display: inline-block; background-color: #F97316; color: #FFFFFF; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 15px; font-weight: 700; text-decoration: none; padding: 14px 28px; border-radius: 10px; border: 1px solid #EA580C; box-shadow: 0 4px 14px rgba(249, 115, 22, 0.35);">
          ${params.ctaText} &rarr;
        </a>
      </div>
    `
    : '';

  const badgeHtml = params.badgeText
    ? `
      <div style="display: inline-block; background-color: rgba(249, 115, 22, 0.15); color: #F97316; border: 1px solid rgba(249, 115, 22, 0.3); font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; padding: 4px 12px; border-radius: 20px; margin-bottom: 16px;">
        ${params.badgeText}
      </div>
    `
    : '';

  return `
<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${params.title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0B0F17; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #F3F4F6;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #0B0F17; padding: 40px 10px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; background-color: #131926; border: 1px solid #1F293D; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
          
          <!-- Header Banner -->
          <tr>
            <td style="padding: 32px 32px 24px 32px; background: linear-gradient(180deg, #1A2338 0%, #131926 100%); border-bottom: 1px solid #1F293D; text-align: center;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center">
                <tr>
                  <td style="vertical-align: middle; padding-right: 12px;">
                    <div style="width: 40px; height: 40px; background-color: #F97316; border-radius: 10px; text-align: center; line-height: 40px; color: #FFFFFF; font-size: 20px; font-weight: 900; box-shadow: 0 4px 12px rgba(249, 115, 22, 0.4);">
                      🏀
                    </div>
                  </td>
                  <td style="vertical-align: middle; text-align: left;">
                    <span style="font-size: 18px; font-weight: 900; color: #FFFFFF; letter-spacing: -0.5px; font-style: italic; text-transform: uppercase;">
                      BASKETBALL COACH <span style="color: #F97316;">GAMESTATS</span>
                    </span>
                    <br/>
                    <span style="font-size: 11px; font-weight: 600; color: #9CA3AF; tracking: 0.5px; text-transform: uppercase;">
                      The #1 Stat Tracker for Coaches
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 36px 32px; color: #E5E7EB; font-size: 15px; line-height: 1.6;">
              ${badgeHtml}
              
              <h1 style="margin: 0 0 16px 0; color: #FFFFFF; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">
                ${params.headline}
              </h1>

              ${params.bodyParagraphs.map(p => `<p style="margin: 0 0 16px 0; color: #D1D5DB; font-size: 15px; line-height: 1.65;">${p}</p>`).join('')}

              ${highlightHtml}

              ${ctaButtonHtml}

              ${params.footerNotice ? `<p style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #1F293D; color: #9CA3AF; font-size: 13px; font-style: italic;">${params.footerNotice}</p>` : ''}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background-color: #0E131F; border-top: 1px solid #1F293D; text-align: center; color: #6B7280; font-size: 12px; line-height: 1.5;">
              <p style="margin: 0 0 8px 0; font-weight: 600; color: #9CA3AF;">
                Basketball Coach GameStats
              </p>
              <p style="margin: 0 0 8px 0;">
                Automatische e-mailnotificatie vanuit je GameStats Account.
              </p>
              <p style="margin: 0; font-size: 11px; color: #4B5563;">
                © ${new Date().getFullYear()} Basketball Coach GameStats. Alle rechten voorbehouden.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Centrale verzendfunctie: plaatst de e-mail in Firestore mail_queue en email_logs,
 * en simuleert/verstuur via Resend of backend API.
 */
export async function dispatchEmail(payload: EmailDispatchPayload): Promise<void> {
  const now = Date.now();
  
  // Clean email adres
  const cleanTo = payload.to.trim().toLowerCase();

  try {
    // 1. Schrijf naar Firestore mail_queue (Outbox voor Cloud Functions / Resend Extensions)
    await addDoc(collection(db, 'mail_queue'), {
      to: cleanTo,
      subject: payload.subject,
      html: payload.html,
      templateId: payload.templateId,
      status: 'queued',
      createdAt: now,
      metadata: payload.metadata || {}
    });

    // 2. Schrijf naar Firestore email_logs voor beheeroverzicht
    await addDoc(collection(db, 'email_logs'), {
      to: cleanTo,
      subject: payload.subject,
      templateId: payload.templateId,
      status: 'sent',
      sentAt: now,
      metadata: payload.metadata || {}
    });

    // 3. Verstuur e-mail via backend API (server.ts met Resend / SMTP ondersteuning)
    try {
      if (typeof window !== 'undefined') {
        fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: cleanTo,
            subject: payload.subject,
            html: payload.html,
            templateId: payload.templateId,
          }),
        }).catch((apiErr) => {
          console.warn('[EmailService] Optionele backend API verzending waarschuwing:', apiErr);
        });
      }
    } catch (apiErr) {
      console.warn('[EmailService] Fout bij aanroepen /api/send-email:', apiErr);
    }

    // Logging voor ontwikkelomgeving en ontwikkeltabs
    console.log(`[EmailService] E-mail succesvol klaargezet en gelogd [${payload.templateId}] -> ${cleanTo}`);

  } catch (err) {
    console.error(`[EmailService] Fout bij verzenden van e-mail [${payload.templateId}]:`, err);
  }
}

// =========================================================================
// SPECIFIEKE EVENT TRIGGERS (MEMBERSHIP & CLUB)
// =========================================================================

/**
 * 1. Account goedgekeurd als Trial
 */
export async function sendTrialStartedEmail(options: TrialStartedOptions): Promise<void> {
  const name = options.recipientName || 'Coach';
  const endDateStr = options.trialEndDate 
    ? (typeof options.trialEndDate === 'number' ? new Date(options.trialEndDate).toLocaleDateString('nl-NL') : options.trialEndDate)
    : 'over 14 dagen';

  const html = generateEmailHtml({
    title: 'Je proefperiode van 14 dagen is gestart!',
    badgeText: 'Proefperiode Gestart',
    headline: `Welkom bij Basketball Coach GameStats, ${name}!`,
    bodyParagraphs: [
      `Je account is succesvol goedgekeurd voor een gratis proefperiode van 14 dagen. Je hebt nu direct toegang tot alle basisfuncties om wedstrijden, opstellingen en spelerstatistieken bij te houden.`,
      `Je proefperiode is geldig tot **${endDateStr}**. Maak vandaag nog je eerste team en spelers aan om meteen te beginnen met live stat tracking!`
    ],
    highlightBox: [
      { label: 'Pakket', value: '14 Dagen Gratis Trial' },
      { label: 'Geldig tot', value: String(endDateStr) }
    ],
    ctaText: 'Open GameStats & Start',
    footerNotice: 'Vragen over je proefperiode? Neem gerust contact op met ons supportteam.'
  });

  await dispatchEmail({
    to: options.recipientEmail,
    subject: 'Je proefperiode van 14 dagen is gestart! 🏀',
    templateId: 'trial_started',
    html,
    metadata: { recipientName: name, trialEndDate: options.trialEndDate }
  });
}

/**
 * 2. Account goedgekeurd als Coach
 */
export async function sendCoachApprovedEmail(options: CoachApprovedOptions): Promise<void> {
  const name = options.recipientName || 'Coach';

  const html = generateEmailHtml({
    title: 'Je Coach Licentie is geactiveerd!',
    badgeText: 'Lidmaatschap Goedgekeurd',
    headline: `Gefeliciteerd ${name}, je Coach account is actief!`,
    bodyParagraphs: [
      `Je aanvraag voor de Coach Licentie is door de beheerder goedgekeurd. Je hebt nu onbeperkte toegang tot de GameStats applicatie.`,
      `Met je Coach Licentie kun je onbeperkt teams aanmaken, uitgebreide seizoensstatistieken inzien en gedetailleerde PDF/Excel exports genereren.`
    ],
    highlightBox: [
      { label: 'Licentietype', value: 'Coach Licentie' },
      { label: 'Status', value: 'Actief' }
    ],
    ctaText: 'Ga naar je Dashboard',
    footerNotice: 'Bedankt dat je kiest voor Basketball Coach GameStats!'
  });

  await dispatchEmail({
    to: options.recipientEmail,
    subject: 'Je Coach Licentie is goedgekeurd! 🏀',
    templateId: 'membership_coach_approved',
    html,
    metadata: { recipientName: name }
  });
}

/**
 * 3. Account goedgekeurd als Club
 */
export async function sendClubApprovedEmail(options: ClubApprovedOptions): Promise<void> {
  const name = options.recipientName || 'Club Beheerder';
  const clubName = options.clubName || 'je Club Workspace';

  const html = generateEmailHtml({
    title: 'Je Club Workspace is actief!',
    badgeText: 'Club Licentie Geactiveerd',
    headline: `Welkom bij het Club Workspace netwerk, ${name}!`,
    bodyParagraphs: [
      `Je Club Licentie is goedgekeurd en geactiveerd voor **${clubName}**.`,
      `Je hebt nu toegang tot de centrale Club Workspace waarin je overkoepelende clubteams kunt beheren, co-coaches en assistenten kunt uitnodigen en centrale statistieken kunt inzien.`
    ],
    highlightBox: [
      { label: 'Licentietype', value: 'Club Workspace' },
      { label: 'Clubnaam', value: clubName },
      { label: 'Status', value: 'Actief' }
    ],
    ctaText: 'Open Club Workspace',
    footerNotice: 'Nodig nu je coaches uit via het Club Dashboard.'
  });

  await dispatchEmail({
    to: options.recipientEmail,
    subject: `Je Club Licentie voor ${clubName} is actief! 🏀`,
    templateId: 'membership_club_approved',
    html,
    metadata: { recipientName: name, clubName }
  });
}

/**
 * 4. Trial verloopt binnenkort
 */
export async function sendTrialExpiringSoonEmail(options: TrialExpiringSoonOptions): Promise<void> {
  const name = options.recipientName || 'Coach';
  const days = options.daysRemaining;

  const html = generateEmailHtml({
    title: `Je proefperiode verloopt over ${days} ${days === 1 ? 'dag' : 'dagen'}`,
    badgeText: 'Herinnering Proefperiode',
    headline: `Hoi ${name}, je proefperiode loopt bijna af!`,
    bodyParagraphs: [
      `Je 14-daagse proefperiode op Basketball Coach GameStats verloopt over **${days} ${days === 1 ? 'dag' : 'dagen'}**.`,
      `Wilt u na afloop onbeperkt speler- en wedstrijdstatistieken blijven bijhouden? Upgrade tijdig naar een volwaardige Coach of Club licentie om geen gegevens te verliezen.`
    ],
    highlightBox: [
      { label: 'Resterende tijd', value: `${days} ${days === 1 ? 'dag' : 'dagen'}` },
      { label: 'Actie vereist', value: 'Upgrade Account' }
    ],
    ctaText: 'Bekijk Licentie Opties',
    footerNotice: 'Neem contact met ons op als je vragen hebt over onze abonnementen.'
  });

  await dispatchEmail({
    to: options.recipientEmail,
    subject: `Herinnering: Je proefperiode verloopt over ${days} ${days === 1 ? 'dag' : 'dagen'} 🏀`,
    templateId: 'trial_expiring_soon',
    html,
    metadata: { recipientName: name, daysRemaining: days }
  });
}

/**
 * 5. Trial verlopen
 */
export async function sendTrialExpiredEmail(options: TrialExpiredOptions): Promise<void> {
  const name = options.recipientName || 'Coach';

  const html = generateEmailHtml({
    title: 'Je proefperiode is verstreken',
    badgeText: 'Proefperiode Verlopen',
    headline: `Beste ${name}, je proefperiode is afgelopen.`,
    bodyParagraphs: [
      `Je 14-daagse proefperiode voor Basketball Coach GameStats is verstreken. Je ingevoerde teams en spelerstatistieken blijven veilig opgeslagen.`,
      `Om de applicatie weer actief te gebruiken en nieuwe wedstrijden in te voeren, kun je je account eenvoudig upgraden naar een Coach of Club licentie.`
    ],
    highlightBox: [
      { label: 'Status', value: 'Proefperiode Verlopen' },
      { label: 'Gegevens', value: 'Veilig bewaard' }
    ],
    ctaText: 'Upgrade nu je account',
    footerNotice: 'Lid worden van een club? Vraag je clubbeheerder om een uitnodiging.'
  });

  await dispatchEmail({
    to: options.recipientEmail,
    subject: 'Je proefperiode voor GameStats is verstreken 🏀',
    templateId: 'trial_expired',
    html,
    metadata: { recipientName: name }
  });
}

/**
 * 6. Nieuwe Club-uitnodiging
 */
export async function sendClubInviteEmail(options: ClubInviteOptions): Promise<void> {
  const name = options.recipientName || 'Coach';
  const roleTitle = options.role === 'coach' ? 'Coach' : options.role === 'assistant' ? 'Assistent-coach' : options.role;

  const html = generateEmailHtml({
    title: `Uitnodiging voor ${options.clubName}`,
    badgeText: 'Club Uitnodiging',
    headline: `Hoi ${name}, je bent uitgenodigd!`,
    bodyParagraphs: [
      `**${options.inviterName}** heeft je uitgenodigd om als **${roleTitle}** toe te treden tot de Club Workspace van **${options.clubName}**.`,
      `Wanneer je inlogt of registreert met dit e-mailadres (**${options.recipientEmail}**), wordt je account automatisch gekoppeld aan de club en krijg je direct toegang tot de gedeelde clubteams en statistieken.`
    ],
    highlightBox: [
      { label: 'Club', value: options.clubName },
      { label: 'Rol', value: roleTitle },
      { label: 'Uitgenodigd door', value: options.inviterName }
    ],
    ctaText: 'Meld je aan & Accepteer',
    footerNotice: 'Deze uitnodiging is 30 dagen geldig. Geen account? Registreer met dit e-mailadres.'
  });

  await dispatchEmail({
    to: options.recipientEmail,
    subject: `Uitnodiging voor Club Workspace ${options.clubName} 🏀`,
    templateId: 'club_invite_sent',
    html,
    metadata: {
      recipientName: name,
      clubName: options.clubName,
      role: options.role,
      inviterName: options.inviterName
    }
  });
}

/**
 * 7. Uitnodiging geaccepteerd (notificatie naar clubbeheerder / inviter)
 */
export async function sendInviteAcceptedEmail(options: InviteAcceptedOptions): Promise<void> {
  const inviterName = options.inviterName || 'Club Beheerder';
  const roleTitle = options.role === 'coach' ? 'Coach' : options.role === 'assistant' ? 'Assistent-coach' : options.role;

  const html = generateEmailHtml({
    title: `Uitnodiging geaccepteerd door ${options.memberName}`,
    badgeText: 'Uitnodiging Geaccepteerd',
    headline: `Hoi ${inviterName}, er is een nieuw lid toegetreden!`,
    bodyParagraphs: [
      `Goed nieuws! **${options.memberName}** (${options.memberEmail}) heeft de uitnodiging geaccepteerd en is nu actief als **${roleTitle}** binnen **${options.clubName}**.`,
      `De nieuwe gebruiker heeft nu toegang tot de gedeelde Club Workspace.`
    ],
    highlightBox: [
      { label: 'Nieuw lid', value: options.memberName },
      { label: 'E-mailadres', value: options.memberEmail },
      { label: 'Rol', value: roleTitle },
      { label: 'Club', value: options.clubName }
    ],
    ctaText: 'Open Club Dashboard',
    footerNotice: 'Je kunt clubleden beheren via de Club Instellingen.'
  });

  const recipient = options.inviterEmail || options.recipientEmail;

  await dispatchEmail({
    to: recipient,
    subject: `${options.memberName} heeft de club-uitnodiging geaccepteerd! 🏀`,
    templateId: 'club_invite_accepted',
    html,
    metadata: {
      memberName: options.memberName,
      memberEmail: options.memberEmail,
      clubName: options.clubName,
      role: options.role
    }
  });
}

/**
 * 8. Toegevoegd aan Club Workspace
 */
export async function sendAddedToClubWorkspaceEmail(options: AddedToClubWorkspaceOptions): Promise<void> {
  const name = options.recipientName || 'Coach';
  const roleTitle = options.role === 'coach' ? 'Coach' : options.role === 'assistant' ? 'Assistent-coach' : options.role;

  const html = generateEmailHtml({
    title: `Je bent toegevoegd aan ${options.clubName}`,
    badgeText: 'Workspace Gekoppeld',
    headline: `Welkom bij de Club Workspace, ${name}!`,
    bodyParagraphs: [
      `Je account is nu officieel gekoppeld aan de Club Workspace van **${options.clubName}** in de rol van **${roleTitle}**.`,
      `Vanaf nu kun je in de app eenvoudig overschakelen naar de gedeelde clubomgeving om clubteams en spelerstatistieken in te zien.`
    ],
    highlightBox: [
      { label: 'Club Workspace', value: options.clubName },
      { label: 'Toegekende Rol', value: roleTitle }
    ],
    ctaText: 'Ga naar Club Workspace',
    footerNotice: 'Veel succes met de wedstrijden!'
  });

  await dispatchEmail({
    to: options.recipientEmail,
    subject: `Je bent nu toegevoegd aan ${options.clubName}! 🏀`,
    templateId: 'added_to_club_workspace',
    html,
    metadata: {
      recipientName: name,
      clubName: options.clubName,
      role: options.role
    }
  });
}

export default {
  generateEmailHtml,
  dispatchEmail,
  sendTrialStartedEmail,
  sendCoachApprovedEmail,
  sendClubApprovedEmail,
  sendTrialExpiringSoonEmail,
  sendTrialExpiredEmail,
  sendClubInviteEmail,
  sendInviteAcceptedEmail,
  sendAddedToClubWorkspaceEmail,
};
