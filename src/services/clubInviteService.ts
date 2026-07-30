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
import { getClubMembers } from './clubService';
import {
  sendClubInviteEmail,
  sendInviteAcceptedEmail,
  sendAddedToClubWorkspaceEmail,
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
 * Maakt een nieuwe uitnodiging aan voor een club workspace met validatie op dubbele uitnodigingen en bestaand lidmaatschap.
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

  // VALIDATIE 1: Controleer of er al een openstaande (pending) uitnodiging voor dit e-mailadres binnen dezelfde club is
  try {
    const pendingQuery = query(
      collection(db, 'club_invites'),
      where('clubId', '==', clubId),
      where('email', '==', cleanEmail),
      where('status', '==', 'pending')
    );
    const pendingSnap = await getDocs(pendingQuery);
    const unexpiredPending = pendingSnap.docs.filter(d => (d.data().expiresAt || 0) > Date.now());
    if (unexpiredPending.length > 0) {
      throw new Error('Er bestaat al een openstaande uitnodiging voor dit e-mailadres binnen deze club.');
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('openstaande uitnodiging')) {
      throw err;
    }
    console.warn("Fout bij controleren bestaande uitnodigingen:", err);
  }

  // VALIDATIE 2: Controleer of dit e-mailadres al een actief lid is van de club
  try {
    const currentMembers = await getClubMembers(clubId);
    const isAlreadyMember = currentMembers.some(m => m.userEmail?.trim().toLowerCase() === cleanEmail);
    if (isAlreadyMember) {
      throw new Error('Dit e-mailadres is al actief lid van deze club.');
    }

    // Controleer ook of e-mailadres overeenkomt met de club-eigenaar
    const clubSnap = await getDoc(doc(db, 'clubs', clubId));
    if (clubSnap.exists()) {
      const ownerUid = clubSnap.data().ownerUid;
      if (ownerUid) {
        const ownerSnap = await getDoc(doc(db, 'users', ownerUid));
        if (ownerSnap.exists()) {
          const ownerEmail = ownerSnap.data().email || ownerSnap.data().profiel?.email;
          if (ownerEmail && ownerEmail.trim().toLowerCase() === cleanEmail) {
            throw new Error('Dit e-mailadres is al actief lid (eigenaar) van deze club.');
          }
        }
      }
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('actief lid')) {
      throw err;
    }
    console.warn("Fout bij controleren clubleden:", err);
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

    // Verstuur e-mailnotificatie naar genodigde
    try {
      let clubName = 'Club Workspace';
      const clubSnap = await getDoc(doc(db, 'clubs', clubId));
      if (clubSnap.exists()) {
        clubName = clubSnap.data().naam || 'Club Workspace';
      }

      let inviterName = 'De Clubbeheerder';
      const inviterSnap = await getDoc(doc(db, 'users', adminUid));
      if (inviterSnap.exists()) {
        inviterName = inviterSnap.data().profiel?.naam || inviterSnap.data().naam || 'De Clubbeheerder';
      }

      await sendClubInviteEmail({
        recipientEmail: cleanEmail,
        recipientName: cleanName,
        clubName,
        role,
        inviterName
      });
    } catch (e) {
      console.warn("Fout bij verzenden van uitnodigingse-mail:", e);
    }

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

export interface AcceptedInviteInfo {
  clubId: string;
  clubName: string;
  role: InviteRole;
}

/**
 * Controleert automatisch bij registratie of inloggen of er openstaande uitnodigingen zijn voor dit e-mailadres,
 * accepteert deze automatisch, voegt het lid toe aan club_members, en retourneert de geaccepteerde uitnodigingen.
 */
export async function checkAndAcceptPendingInvites(
  userUid: string,
  userEmail: string
): Promise<AcceptedInviteInfo[]> {
  if (!userUid || !userEmail) return [];
  const cleanEmail = userEmail.trim().toLowerCase();

  try {
    const invitesRef = collection(db, 'club_invites');
    const q = query(
      invitesRef,
      where('email', '==', cleanEmail),
      where('status', '==', 'pending')
    );
    const snap = await getDocs(q);

    if (snap.empty) {
      return [];
    }

    const now = Date.now();
    const acceptedInvites: AcceptedInviteInfo[] = [];

    for (const docSnap of snap.docs) {
      const invite = { id: docSnap.id, ...docSnap.data() } as ClubInvite;

      // Sla verlopen uitnodigingen over
      if (invite.expiresAt && invite.expiresAt <= now) {
        continue;
      }

      // 1. Voeg toe aan club_members (voorkom dubbele records met docId `${clubId}_${userUid}`)
      const memberDocRef = doc(db, 'club_members', `${invite.clubId}_${userUid}`);
      const memberSnap = await getDoc(memberDocRef);

      if (!memberSnap.exists()) {
        await setDoc(memberDocRef, {
          clubId: invite.clubId,
          userUid,
          role: invite.role,
          status: 'active',
          joinedAt: now
        });
      } else {
        await updateDoc(memberDocRef, {
          status: 'active',
          role: invite.role
        });
      }

      // 2. Werk eventueel het lidmaatschap van de gebruiker bij naar 'club' in de users-collectie
      try {
        const userDocRef = doc(db, 'users', userUid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          const uData = userDocSnap.data();
          if (!uData.membership || uData.membership.type === 'gratis' || uData.membership.type === 'coach') {
            await updateDoc(userDocRef, {
              'membership.type': 'club',
              'membership.status': 'active',
              'membership.clubId': invite.clubId
            });
          }
        }
      } catch (e) {
        console.warn("Kon gebruikerslidmaatschap niet automatisch upgraden bij acceptatie:", e);
      }

      // 3. Update uitnodiging naar status 'accepted'
      const inviteRef = doc(db, 'club_invites', invite.id);
      await updateDoc(inviteRef, {
        status: 'accepted'
      });

      // 4. Auditlog
      await writeAuditLog({
        adminUid: userUid,
        clubId: invite.clubId,
        inviteId: invite.id,
        action: 'club_invite_accepted',
        oldValue: { id: invite.id, status: 'pending' },
        newValue: { id: invite.id, status: 'accepted', userUid }
      });

      // Ophalen clubnaam en aanmaker gegevens voor e-mail notificaties en welkomstscherm
      let clubName = 'Club Workspace';
      try {
        const clubSnap = await getDoc(doc(db, 'clubs', invite.clubId));
        if (clubSnap.exists()) {
          clubName = clubSnap.data().naam || 'Club Workspace';
        }
      } catch (e) {
        console.warn("Kon clubnaam niet ophalen voor welkomstbericht:", e);
      }

      // 5. Verstuur E-mailnotificaties (Toegevoegd aan Club Workspace & Uitnodiging Geaccepteerd)
      try {
        // A. E-mail naar het nieuwe lid (Toegevoegd aan Club Workspace)
        await sendAddedToClubWorkspaceEmail({
          recipientEmail: cleanEmail,
          recipientName: invite.displayName || userEmail,
          clubName,
          role: invite.role
        });

        // B. E-mail naar de clubbeheerder die de uitnodiging verstuurde
        if (invite.createdBy) {
          const inviterSnap = await getDoc(doc(db, 'users', invite.createdBy));
          if (inviterSnap.exists()) {
            const inviterData = inviterSnap.data();
            const inviterEmail = inviterData.profiel?.email || inviterData.email;
            const inviterName = inviterData.profiel?.naam || inviterData.naam || 'Clubbeheerder';

            if (inviterEmail) {
              await sendInviteAcceptedEmail({
                recipientEmail: inviterEmail,
                inviterEmail,
                inviterName,
                memberName: invite.displayName || userEmail,
                memberEmail: cleanEmail,
                clubName,
                role: invite.role
              });
            }
          }
        }
      } catch (emailErr) {
        console.warn("Fout bij verzenden van e-mailnotificaties bij uitnodigingsacceptatie:", emailErr);
      }

      acceptedInvites.push({
        clubId: invite.clubId,
        clubName,
        role: invite.role
      });
    }

    return acceptedInvites;
  } catch (err) {
    console.warn("Fout bij automatisch accepteren van uitnodigingen:", err);
    return [];
  }
}

