import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  query, 
  where,
  onSnapshot
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { ClubInvite, InviteRole } from '../types';

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

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path
  };
  console.error("Firestore operation error in clubInviteService:", errInfo);
  throw new Error(`Fout bij ${operationType} op ${path}: ${errInfo.error}`);
}

/**
  Hulpservice om auditlogs weg te schrijven naar de audit_logs collectie.
 */
async function writeAuditLog(data: {
  adminUid: string;
  clubId: string;
  inviteId: string;
  action: 'club_invite_created' | 'club_invite_cancelled' | 'club_invite_accepted';
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
}): Promise<void> {
  try {
    const logRef = doc(collection(db, 'audit_logs'));
    await setDoc(logRef, {
      timestamp: Date.now(),
      adminUid: data.adminUid,
      clubId: data.clubId,
      inviteId: data.inviteId,
      action: data.action,
      oldValue: data.oldValue,
      newValue: data.newValue
    });
  } catch (err) {
    console.warn("Niet gelukt om auditlog weg te schrijven:", err);
  }
}

/**
 * Maakt een nieuwe uitnodiging aan voor een club workspace.
 */
export async function createInvite(
  adminUid: string,
  clubId: string,
  email: string,
  displayName: string,
  role: InviteRole
): Promise<string> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanName = displayName.trim();

  if (!clubId || !cleanEmail || !cleanName) {
    throw new Error('Incomplete gegevens voor het aanmaken van een uitnodiging.');
  }

  const now = Date.now();
  const expiresAt = now + 30 * 24 * 60 * 60 * 1000; // 30 dagen geldig

  const inviteRef = doc(collection(db, 'club_invites'));
  const inviteData: Omit<ClubInvite, 'id'> = {
    clubId,
    email: cleanEmail,
    displayName: cleanName,
    role,
    status: 'pending',
    createdAt: now,
    createdBy: adminUid,
    expiresAt
  };

  try {
    await setDoc(inviteRef, inviteData);

    // Schrijf automatisch auditlog weg
    await writeAuditLog({
      adminUid,
      clubId,
      inviteId: inviteRef.id,
      action: 'club_invite_created',
      oldValue: null,
      newValue: {
        email: cleanEmail,
        displayName: cleanName,
        role,
        status: 'pending',
        clubId,
        expiresAt
      }
    });

    return inviteRef.id;
  } catch (err) {
    return handleFirestoreError(err, OperationType.CREATE, `club_invites/${inviteRef.id}`);
  }
}

/**
 * Annuleert een bestaande club-uitnodiging.
 * Wijzigt de status naar 'cancelled' zonder het document te verwijderen, en schrijft een auditlog.
 */
export async function cancelInvite(
  adminUid: string,
  clubId: string,
  inviteId: string,
  currentInvite?: ClubInvite | null
): Promise<void> {
  if (!inviteId) return;

  const inviteRef = doc(db, 'club_invites', inviteId);

  try {
    await updateDoc(inviteRef, {
      status: 'cancelled'
    });

    // Schrijf automatisch auditlog weg
    await writeAuditLog({
      adminUid,
      clubId,
      inviteId,
      action: 'club_invite_cancelled',
      oldValue: currentInvite ? {
        id: currentInvite.id,
        email: currentInvite.email,
        displayName: currentInvite.displayName,
        role: currentInvite.role,
        status: currentInvite.status
      } : { id: inviteId, status: 'pending' },
      newValue: {
        id: inviteId,
        status: 'cancelled'
      }
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `club_invites/${inviteId}`);
  }
}

/**
 * Haalt alle actieve (pending) uitnodigingen op voor een specifieke club workspace.
 */
export async function getPendingInvites(clubId: string): Promise<ClubInvite[]> {
  if (!clubId) return [];

  try {
    const invitesRef = collection(db, 'club_invites');
    const q = query(
      invitesRef, 
      where('clubId', '==', clubId),
      where('status', '==', 'pending')
    );
    const snap = await getDocs(q);

    const invites: ClubInvite[] = [];
    snap.forEach(docSnap => {
      invites.push({ id: docSnap.id, ...docSnap.data() } as ClubInvite);
    });

    return invites.sort((a, b) => b.createdAt - a.createdAt);
  } catch (err) {
    console.warn("Fout bij ophalen pending invites:", err);
    return [];
  }
}

/**
 * Haalt alle uitnodigingen (pending, accepted, cancelled) op voor de club workspace.
 */
export async function getAllClubInvites(clubId: string): Promise<ClubInvite[]> {
  if (!clubId) return [];

  try {
    const invitesRef = collection(db, 'club_invites');
    const q = query(invitesRef, where('clubId', '==', clubId));
    const snap = await getDocs(q);

    const invites: ClubInvite[] = [];
    snap.forEach(docSnap => {
      invites.push({ id: docSnap.id, ...docSnap.data() } as ClubInvite);
    });

    return invites.sort((a, b) => b.createdAt - a.createdAt);
  } catch (err) {
    console.warn("Fout bij ophalen club invites:", err);
    return [];
  }
}

/**
 * Luistert in realtime naar wijzigingen in club-uitnodigingen.
 */
export function subscribeToClubInvites(
  clubId: string, 
  callback: (invites: ClubInvite[]) => void
): () => void {
  if (!clubId) {
    callback([]);
    return () => {};
  }

  const invitesRef = collection(db, 'club_invites');
  const q = query(invitesRef, where('clubId', '==', clubId));

  return onSnapshot(q, (snap) => {
    const invites: ClubInvite[] = [];
    snap.forEach(docSnap => {
      invites.push({ id: docSnap.id, ...docSnap.data() } as ClubInvite);
    });
    invites.sort((a, b) => b.createdAt - a.createdAt);
    callback(invites);
  }, (err) => {
    console.warn("Realtime listener fout voor club invites:", err);
  });
}

/**
 * Voorbereiding op registratie: Zoekt openstaande uitnodigingen op basis van e-mailadres.
 */
export async function getPendingInvitesForEmail(email: string): Promise<ClubInvite[]> {
  if (!email) return [];
  const cleanEmail = email.trim().toLowerCase();

  try {
    const invitesRef = collection(db, 'club_invites');
    const q = query(
      invitesRef, 
      where('email', '==', cleanEmail),
      where('status', '==', 'pending')
    );
    const snap = await getDocs(q);

    const invites: ClubInvite[] = [];
    snap.forEach(docSnap => {
      const invite = { id: docSnap.id, ...docSnap.data() } as ClubInvite;
      // Controleer eventueel vervaldatum
      if (invite.expiresAt > Date.now()) {
        invites.push(invite);
      }
    });

    return invites;
  } catch (err) {
    console.warn("Fout bij zoeken uitnodigingen voor e-mail:", err);
    return [];
  }
}

/**
 * Accepteert een uitnodiging (voegt gebruiker toe aan club_members en werkt status bij).
 */
export async function acceptInvite(inviteId: string, userUid: string): Promise<void> {
  if (!inviteId || !userUid) return;

  try {
    const inviteRef = doc(db, 'club_invites', inviteId);
    const inviteSnap = await getDoc(inviteRef);

    if (!inviteSnap.exists()) {
      throw new Error('Uitnodiging niet gevonden.');
    }

    const invite = inviteSnap.data() as ClubInvite;

    // 1. Voeg toe aan club_members
    const memberDocRef = doc(db, 'club_members', `${invite.clubId}_${userUid}`);
    await setDoc(memberDocRef, {
      clubId: invite.clubId,
      userUid,
      role: invite.role,
      status: 'active',
      joinedAt: Date.now()
    });

    // 2. Update uitnodiging status naar accepted
    await updateDoc(inviteRef, {
      status: 'accepted'
    });

    // 3. Auditlog
    await writeAuditLog({
      adminUid: userUid,
      clubId: invite.clubId,
      inviteId,
      action: 'club_invite_accepted',
      oldValue: { id: inviteId, status: 'pending' },
      newValue: { id: inviteId, status: 'accepted', userUid }
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `club_invites/${inviteId}`);
  }
}
