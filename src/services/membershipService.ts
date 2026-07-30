import { doc, setDoc, collection, addDoc, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { UserMembership, UserRole } from '../types';
import { ensureClubWorkspaceForUser } from './clubService';
import {
  sendTrialStartedEmail,
  sendCoachApprovedEmail,
  sendClubApprovedEmail,
  sendTrialExpiredEmail,
} from './emailService';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path,
  };
  console.error('Firestore Admin Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export interface AdminActionPayload {
  adminUid: string;
  targetUid: string;
  action: string;
  userUpdate: Record<string, any>;
  oldValue: any;
  newValue: any;
}

/**
 * Generieke, herbruikbare service om beheerdersacties uit te voeren:
 * 1. Werkt het gebruikersdocument in Firestore bij met merge: true
 * 2. Registreert een auditlog in de 'audit_logs' collectie
 */
export async function executeAdminAction({
  adminUid,
  targetUid,
  action,
  userUpdate,
  oldValue,
  newValue,
}: AdminActionPayload): Promise<void> {
  const now = Date.now();
  const userRef = doc(db, 'users', targetUid);

  // 1. Gebruikersdocument bijwerken in Firestore
  try {
    await setDoc(userRef, userUpdate, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${targetUid}`);
  }

  // 2. Auditlog schrijven in Firestore
  try {
    const auditLogRef = collection(db, 'audit_logs');
    await addDoc(auditLogRef, {
      timestamp: now,
      adminUid,
      targetUid,
      action,
      oldValue: oldValue ?? null,
      newValue: newValue ?? null,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, 'audit_logs');
  }
}

/**
 * Helper functie om profielgegevens van een doelgebruiker op te halen voor e-mailnotificaties.
 */
async function getUserDetails(
  targetUid: string,
  fallbackEmail?: string,
  fallbackName?: string,
  fallbackClub?: string
): Promise<{ email: string; naam: string; club: string }> {
  let email = fallbackEmail || '';
  let naam = fallbackName || '';
  let club = fallbackClub || '';

  try {
    const userSnap = await getDoc(doc(db, 'users', targetUid));
    if (userSnap.exists()) {
      const data = userSnap.data();
      email = data.profiel?.email || data.email || data.emailadres || data.userEmail || email;
      naam = data.profiel?.naam || data.naam || data.displayName || naam;
      club = data.profiel?.club || data.club || club;
    }
  } catch (err) {
    console.warn('Fout bij ophalen van gebruikersgegevens voor e-mail notificatie:', err);
  }

  // Als email nog steeds leeg is maar targetUid een e-mailadres is:
  if (!email && targetUid && targetUid.includes('@')) {
    email = targetUid;
  }

  return { email, naam, club };
}

/**
 * Start een proefperiode van 14 dagen voor de opgegeven gebruiker.
 */
export async function startTrial(
  adminUid: string,
  targetUid: string,
  currentMembership?: UserMembership | null,
  targetEmail?: string,
  targetName?: string
): Promise<void> {
  const now = Date.now();
  const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

  const newMembership: UserMembership = {
    type: 'trial',
    status: 'active',
    trialStart: now,
    trialEnd: now + FOURTEEN_DAYS_MS,
    approvedAt: now,
    approvedBy: adminUid,
  };

  await executeAdminAction({
    adminUid,
    targetUid,
    action: 'trial_started',
    userUpdate: {
      membership: newMembership,
    },
    oldValue: currentMembership || null,
    newValue: newMembership,
  });

  // Verstuur e-mailnotificatie
  try {
    const { email, naam } = await getUserDetails(targetUid, targetEmail, targetName);
    if (email) {
      await sendTrialStartedEmail({
        recipientEmail: email,
        recipientName: naam || 'Coach',
        trialEndDate: newMembership.trialEnd || undefined,
      });
    } else {
      console.warn('Geen e-mailadres gevonden voor trial_started notificatie:', targetUid);
    }
  } catch (e) {
    console.warn('Fout bij verzenden van trial_started e-mail:', e);
  }
}

/**
 * Beëindigt/verloopt de proefperiode van een gebruiker op centrale wijze.
 * Zet trialEnd op een verstreken tijdstip (now - 1000ms), waardoor isTrialExpired direct true is.
 * Kan handmatig door een beheerder worden aangeroepen (action: 'trial_expired_manually')
 * of door een toekomstige automatische achtergrondtaak (action: 'trial_expired_automatically').
 */
export async function expireTrial(
  adminUid: string,
  targetUid: string,
  currentMembership?: UserMembership | null,
  isManual: boolean = true,
  targetEmail?: string,
  targetName?: string
): Promise<void> {
  const now = Date.now();
  const newMembership: UserMembership = {
    type: 'trial',
    status: currentMembership?.status || 'active',
    trialStart: currentMembership?.trialStart || now - 14 * 24 * 60 * 60 * 1000,
    trialEnd: now - 1000,
    approvedAt: currentMembership?.approvedAt || null,
    approvedBy: currentMembership?.approvedBy || null,
  };

  const action = isManual ? 'trial_expired_manually' : 'trial_expired_automatically';

  await executeAdminAction({
    adminUid,
    targetUid,
    action,
    userUpdate: {
      membership: newMembership,
    },
    oldValue: currentMembership || null,
    newValue: newMembership,
  });

  // Verstuur e-mailnotificatie
  try {
    const { email, naam } = await getUserDetails(targetUid, targetEmail, targetName);
    if (email) {
      await sendTrialExpiredEmail({
        recipientEmail: email,
        recipientName: naam || 'Coach',
      });
    } else {
      console.warn('Geen e-mailadres gevonden voor trial_expired notificatie:', targetUid);
    }
  } catch (e) {
    console.warn('Fout bij verzenden van trial_expired e-mail:', e);
  }
}

/**
 * Activeert een Coach licentie voor de opgegeven gebruiker.
 * Maakt eventuele proefperiode datums leeg.
 */
export async function activateCoach(
  adminUid: string,
  targetUid: string,
  currentMembership?: UserMembership | null,
  targetEmail?: string,
  targetName?: string
): Promise<void> {
  const now = Date.now();
  const newMembership: UserMembership = {
    type: 'coach',
    status: 'active',
    approvedAt: now,
    approvedBy: adminUid,
    trialStart: null,
    trialEnd: null,
  };

  await executeAdminAction({
    adminUid,
    targetUid,
    action: 'coach_activated',
    userUpdate: {
      membership: newMembership,
    },
    oldValue: currentMembership || null,
    newValue: newMembership,
  });

  // Verstuur e-mailnotificatie
  try {
    const { email, naam } = await getUserDetails(targetUid, targetEmail, targetName);
    if (email) {
      await sendCoachApprovedEmail({
        recipientEmail: email,
        recipientName: naam || 'Coach',
      });
    } else {
      console.warn('Geen e-mailadres gevonden voor coach_approved notificatie:', targetUid);
    }
  } catch (e) {
    console.warn('Fout bij verzenden van coach_approved e-mail:', e);
  }
}

/**
 * Activeert een Club licentie voor de opgegeven gebruiker.
 * Maakt eventuele proefperiode datums leeg.
 */
export async function activateClub(
  adminUid: string,
  targetUid: string,
  currentMembership?: UserMembership | null,
  targetEmail?: string,
  targetName?: string,
  targetClub?: string
): Promise<void> {
  const now = Date.now();
  const newMembership: UserMembership = {
    type: 'club',
    status: 'active',
    approvedAt: now,
    approvedBy: adminUid,
    trialStart: null,
    trialEnd: null,
  };

  await executeAdminAction({
    adminUid,
    targetUid,
    action: 'club_activated',
    userUpdate: {
      membership: newMembership,
    },
    oldValue: currentMembership || null,
    newValue: newMembership,
  });

  // Bij eerste activatie van Club-lidmaatschap: maak automatisch club & club_members record aan
  try {
    await ensureClubWorkspaceForUser(targetUid);
  } catch (e) {
    console.error("Fout bij automatisch aanmaken van Club Workspace:", e);
  }

  // Verstuur e-mailnotificatie
  try {
    const { email, naam, club } = await getUserDetails(targetUid, targetEmail, targetName, targetClub);
    if (email) {
      await sendClubApprovedEmail({
        recipientEmail: email,
        recipientName: naam || 'Club Beheerder',
        clubName: club || 'je Club Workspace',
      });
    } else {
      console.warn('Geen e-mailadres gevonden voor club_approved notificatie:', targetUid);
    }
  } catch (e) {
    console.warn('Fout bij verzenden van club_approved e-mail:', e);
  }
}

/**
 * Zet het lidmaatschap van de gebruiker terug naar 'pending'.
 * Wis goedkeurings- en proefperiodegegevens.
 */
export async function resetToPending(
  adminUid: string,
  targetUid: string,
  currentMembership?: UserMembership | null
): Promise<void> {
  const newMembership: UserMembership = {
    type: 'pending',
    status: 'pending',
    approvedAt: null,
    approvedBy: null,
    trialStart: null,
    trialEnd: null,
  };

  await executeAdminAction({
    adminUid,
    targetUid,
    action: 'membership_reset_pending',
    userUpdate: {
      membership: newMembership,
    },
    oldValue: currentMembership || null,
    newValue: newMembership,
  });
}

/**
 * Schort het lidmaatschap van de gebruiker op (status 'suspended').
 */
export async function suspendMembership(
  adminUid: string,
  targetUid: string,
  currentMembership?: UserMembership | null
): Promise<void> {
  const newMembership: UserMembership = {
    type: currentMembership?.type || 'pending',
    status: 'suspended',
    approvedAt: currentMembership?.approvedAt || null,
    approvedBy: currentMembership?.approvedBy || null,
    trialStart: currentMembership?.trialStart || null,
    trialEnd: currentMembership?.trialEnd || null,
  };

  await executeAdminAction({
    adminUid,
    targetUid,
    action: 'membership_suspended',
    userUpdate: {
      membership: newMembership,
    },
    oldValue: currentMembership || null,
    newValue: newMembership,
  });
}

/**
 * Heractiveert een geschorst of inactief lidmaatschap (status 'active').
 */
export async function reactivateMembership(
  adminUid: string,
  targetUid: string,
  currentMembership?: UserMembership | null
): Promise<void> {
  const now = Date.now();
  const type = currentMembership?.type && currentMembership.type !== 'pending' ? currentMembership.type : 'coach';

  const newMembership: UserMembership = {
    type,
    status: 'active',
    approvedAt: currentMembership?.approvedAt || now,
    approvedBy: currentMembership?.approvedBy || adminUid,
    trialStart: currentMembership?.trialStart || null,
    trialEnd: currentMembership?.trialEnd || null,
  };

  await executeAdminAction({
    adminUid,
    targetUid,
    action: 'membership_reactivated',
    userUpdate: {
      membership: newMembership,
    },
    oldValue: currentMembership || null,
    newValue: newMembership,
  });
}

/**
 * Wijzigt de systeemrol van de gebruiker (admin/user).
 */
export async function changeRole(
  adminUid: string,
  targetUid: string,
  newRole: UserRole,
  currentRole?: UserRole
): Promise<void> {
  await executeAdminAction({
    adminUid,
    targetUid,
    action: 'role_changed',
    userUpdate: {
      role: newRole,
    },
    oldValue: currentRole || 'user',
    newValue: newRole,
  });
}
