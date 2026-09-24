import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  addDoc,
  query, 
  where 
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { ClubWorkspace, ClubMember, ClubMemberRole, ClubMemberStatus, Team, Player } from '../types';

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
  console.error('Firestore Club Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
  * Garandeert dat een club_members document bestaat voor de opgegeven gebruiker in een specifieke club.
  */
export async function ensureClubMemberRecord(
  clubId: string, 
  userUid: string, 
  role: ClubMemberRole = 'admin',
  status: ClubMemberStatus = 'active'
): Promise<void> {
  if (!clubId || !userUid) return;

  try {
    const membersRef = collection(db, 'club_members');
    const q = query(membersRef, where('clubId', '==', clubId), where('userUid', '==', userUid));
    const snap = await getDocs(q);

    if (snap.empty) {
      const docId = `${clubId}_${userUid}`;
      const memberDocRef = doc(db, 'club_members', docId);
      
      let emailToStore = '';
      let nameToStore = '';
      if (auth.currentUser && auth.currentUser.uid === userUid) {
        emailToStore = auth.currentUser.email || '';
        nameToStore = auth.currentUser.displayName || '';
      }

      await setDoc(memberDocRef, {
        clubId,
        userUid,
        userName: nameToStore,
        userEmail: emailToStore,
        role,
        status,
        joinedAt: Date.now(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `club_members/${clubId}_${userUid}`);
  }
}

/**
 * Garandeert dat er een Club Workspace bestaat voor de gebruiker bij activatie van een Club-lidmaatschap.
 * 1. Zoekt of de gebruiker al eigenaar is van een club.
 * 2. Maakt automatisch een club aan als die nog niet bestaat.
 * 3. Maakt automatisch een club_members-record aan waarin de gebruiker de rol 'admin' heeft.
 */
export async function ensureClubWorkspaceForUser(
  ownerUid: string, 
  defaultName?: string
): Promise<ClubWorkspace | null> {
  if (!ownerUid) return null;

  try {
    // 1. Zoek bestaande club waarvan de gebruiker de eigenaar is
    const clubsRef = collection(db, 'clubs');
    const q = query(clubsRef, where('ownerUid', '==', ownerUid));
    const snap = await getDocs(q);

    if (!snap.empty) {
      const docSnap = snap.docs[0];
      const club = { id: docSnap.id, ...docSnap.data() } as ClubWorkspace;
      
      // Garandeer dat eigenaar als admin in club_members staat
      await ensureClubMemberRecord(club.id, ownerUid, 'admin', 'active');
      return club;
    }

    // 2. Ophalen van gebruikersprofiel voor een representatieve clubnaam
    let nameToUse = defaultName;
    if (!nameToUse) {
      try {
        const userSnap = await getDoc(doc(db, 'users', ownerUid));
        if (userSnap.exists()) {
          const userData = userSnap.data();
          if (userData.club && typeof userData.club === 'string' && userData.club.trim()) {
            nameToUse = userData.club.trim();
          } else if (userData.naam && typeof userData.naam === 'string' && userData.naam.trim()) {
            nameToUse = `Club ${userData.naam.trim()}`;
          }
        }
      } catch (e) {
        console.warn('Kon gebruikersprofiel niet ophalen voor clubnaam:', e);
      }
    }
    if (!nameToUse) {
      nameToUse = 'Mijn Club Workspace';
    }

    // 3. Maak automatisch een nieuwe club aan
    const now = Date.now();
    const newClubRef = doc(collection(db, 'clubs'));
    const newClub: ClubWorkspace = {
      id: newClubRef.id,
      naam: nameToUse,
      ownerUid,
      createdAt: now,
      subscriptionType: 'club',
    };

    await setDoc(newClubRef, {
      naam: newClub.naam,
      ownerUid: newClub.ownerUid,
      createdAt: newClub.createdAt,
      subscriptionType: newClub.subscriptionType,
    });

    // 4. Maak automatisch een club_members-record aan met rol 'admin'
    await ensureClubMemberRecord(newClub.id, ownerUid, 'admin', 'active');

    return newClub;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'clubs');
    return null;
  }
}

/**
 * Haalt de Club Workspace op behorende bij de gebruiker (als eigenaar of lid).
 */
export async function getClubForUser(userUid: string): Promise<ClubWorkspace | null> {
  if (!userUid) return null;

  try {
    // 1. Zoek eerst als eigenaar van een club
    const clubsRef = collection(db, 'clubs');
    const qOwner = query(clubsRef, where('ownerUid', '==', userUid));
    const snapOwner = await getDocs(qOwner);

    if (!snapOwner.empty) {
      const docSnap = snapOwner.docs[0];
      return { id: docSnap.id, ...docSnap.data() } as ClubWorkspace;
    }

    // 2. Zoek anders in club_members
    const membersRef = collection(db, 'club_members');
    const qMember = query(membersRef, where('userUid', '==', userUid), where('status', '==', 'active'));
    const snapMember = await getDocs(qMember);

    if (!snapMember.empty) {
      const memberData = snapMember.docs[0].data() as ClubMember;
      const clubSnap = await getDoc(doc(db, 'clubs', memberData.clubId));
      if (clubSnap.exists()) {
        return { id: clubSnap.id, ...clubSnap.data() } as ClubWorkspace;
      }
    }

    return null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, 'clubs');
    return null;
  }
}

/**
 * Haalt alle leden op van een specifieke Club Workspace en verrijkt deze met gebruikersgegevens.
 */
export async function getClubMembers(clubId: string): Promise<ClubMember[]> {
  if (!clubId) return [];

  try {
    const membersRef = collection(db, 'club_members');
    const q = query(membersRef, where('clubId', '==', clubId));
    const snap = await getDocs(q);

    const members: ClubMember[] = [];
    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      const memberItem: ClubMember = {
        id: docSnap.id,
        clubId: data.clubId,
        userUid: data.userUid,
        userName: data.userName || '',
        userEmail: data.userEmail || '',
        role: data.role || 'coach',
        status: data.status || 'active',
        joinedAt: data.joinedAt || Date.now(),
      };

      // 1. Directe controle indien dit de huidige ingelogde gebruiker betreft
      if (auth.currentUser && auth.currentUser.uid === data.userUid) {
        if (!memberItem.userEmail && auth.currentUser.email) {
          memberItem.userEmail = auth.currentUser.email;
        }
        if (!memberItem.userName && auth.currentUser.displayName) {
          memberItem.userName = auth.currentUser.displayName;
        }
      }

      // 2. Ophalen naam/e-mail uit users collectie (ondersteunt zowel profiel.email als root-level email)
      try {
        const userSnap = await getDoc(doc(db, 'users', data.userUid));
        if (userSnap.exists()) {
          const userData = userSnap.data();
          const profiel = userData.profiel || {};
          if (!memberItem.userName) {
            memberItem.userName = profiel.naam || userData.naam || '';
          }
          if (!memberItem.userEmail) {
            memberItem.userEmail = profiel.email || userData.email || '';
          }
        }
      } catch (e) {
        console.warn('Kon lid gebruikersprofiel niet verrijken:', e);
      }

      // 3. Fallback: als userEmail nog leeg is, check geaccepteerde club_invites
      if (!memberItem.userEmail) {
        try {
          const invitesRef = collection(db, 'club_invites');
          const qInv = query(invitesRef, where('clubId', '==', clubId), where('status', '==', 'accepted'));
          const invSnap = await getDocs(qInv);
          for (const invDoc of invSnap.docs) {
            const invData = invDoc.data();
            if (invData.userUid === data.userUid || invData.acceptedByUid === data.userUid) {
              memberItem.userEmail = invData.email || '';
              if (!memberItem.userName && invData.displayName) {
                memberItem.userName = invData.displayName;
              }
              break;
            }
          }
        } catch (e) {
          // negeer eventuele query-fouten voor invites
        }
      }

      members.push(memberItem);
    }

    return members;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `club_members for ${clubId}`);
    return [];
  }
}

/**
 * Werkt de clubnaam bij.
 */
export async function updateClubName(clubId: string, newName: string): Promise<void> {
  if (!clubId || !newName.trim()) return;
  try {
    const clubRef = doc(db, 'clubs', clubId);
    await updateDoc(clubRef, { naam: newName.trim() });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `clubs/${clubId}`);
  }
}

/**
 * Haalt alle teams op die gekoppeld zijn aan een specifieke Club Workspace (clubId).
 */
export async function getClubTeams(clubId: string): Promise<Team[]> {
  if (!clubId) return [];

  try {
    const teamsRef = collection(db, 'teams');
    const q = query(teamsRef, where('clubId', '==', clubId));
    const snap = await getDocs(q);

    const teams: Team[] = [];
    snap.forEach(docSnap => {
      teams.push({ id: docSnap.id, ...docSnap.data() } as Team);
    });
    return teams;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `teams for club ${clubId}`);
    return [];
  }
}

/**
 * Interne helper om Club Workspace audit logs vast te leggen.
 */
async function logClubAdminAction(payload: {
  adminUid: string;
  clubId: string;
  memberUid: string;
  action: 'club_member_role_updated' | 'club_member_status_updated' | 'club_member_removed';
  oldValue: Record<string, any> | null;
  newValue: Record<string, any> | null;
}): Promise<void> {
  try {
    const auditLogRef = collection(db, 'audit_logs');
    await addDoc(auditLogRef, {
      timestamp: Date.now(),
      adminUid: payload.adminUid,
      targetUid: payload.memberUid,
      clubId: payload.clubId,
      memberUid: payload.memberUid,
      action: payload.action,
      oldValue: payload.oldValue,
      newValue: payload.newValue,
    });
  } catch (err) {
    console.warn('Kon auditlog niet wegschrijven:', err);
  }
}

/**
 * Haalt de specifieke rol op van een gebruiker binnen een Club Workspace.
 * - Eigenaar van de club is ALTIJD 'admin'.
 * - Een actieve gebruiker in club_members krijgt zijn geconfigureerde rol ('admin', 'coach', 'assistant').
 * - Een 'pending' clublid wordt NIET beschouwd als een actieve clubgebruiker (retourneert null).
 */
export async function getClubMemberRole(clubId: string, userUid: string): Promise<ClubMemberRole | null> {
  if (!clubId || !userUid) return null;

  try {
    // 1. Controleer of de gebruiker eigenaar is van de club
    const clubSnap = await getDoc(doc(db, 'clubs', clubId));
    if (clubSnap.exists() && clubSnap.data().ownerUid === userUid) {
      return 'admin';
    }

    // 2. Controleer het club_members record
    const memberDocRef = doc(db, 'club_members', `${clubId}_${userUid}`);
    const memberSnap = await getDoc(memberDocRef);
    if (memberSnap.exists()) {
      const data = memberSnap.data();
      // Alleen een actief lidmaatschap telt als geldige club-rol
      if (data.status === 'active') {
        return (data.role as ClubMemberRole) || 'coach';
      }
      // Pending leden hebben geen actieve club-toegang
      return null;
    }

    return null;
  } catch (err) {
    console.warn('Kon clubrol van gebruiker niet ophalen:', err);
    return null;
  }
}

/**
 * Haalt het volledige club_member document op voor een specifieke gebruiker.
 */
export async function getClubMember(clubId: string, userUid: string): Promise<ClubMember | null> {
  if (!clubId || !userUid) return null;

  try {
    const memberDocRef = doc(db, 'club_members', `${clubId}_${userUid}`);
    const memberSnap = await getDoc(memberDocRef);
    if (memberSnap.exists()) {
      const data = memberSnap.data();
      return {
        id: memberSnap.id,
        clubId: data.clubId,
        userUid: data.userUid,
        userName: data.userName || '',
        userEmail: data.userEmail || '',
        role: data.role || 'coach',
        status: data.status || 'active',
        joinedAt: data.joinedAt || Date.now(),
      };
    }

    // Indien eigenaar zonder lidmaatschapsrecord, retourneer synthetisch admin record
    const clubSnap = await getDoc(doc(db, 'clubs', clubId));
    if (clubSnap.exists() && clubSnap.data().ownerUid === userUid) {
      return {
        id: `${clubId}_${userUid}`,
        clubId,
        userUid,
        userName: auth.currentUser?.displayName || 'Clubbeheerder',
        userEmail: auth.currentUser?.email || '',
        role: 'admin',
        status: 'active',
        joinedAt: clubSnap.data().createdAt || Date.now(),
      };
    }

    return null;
  } catch (err) {
    console.warn('Kon club_member niet ophalen:', err);
    return null;
  }
}

/**
 * Controleert of de opgegeven gebruiker Club Admin is binnen de Club Workspace.
 */
export async function isClubAdmin(clubId: string, userUid: string): Promise<boolean> {
  if (!clubId || !userUid) return false;
  const role = await getClubMemberRole(clubId, userUid);
  return role === 'admin';
}

/**
 * Werkt de rol van een clublid bij (coach <-> assistant).
 * Beveiligingsregels:
 * - Alleen een Club Admin mag dit doen.
 * - Eigenaar van de club kan niet gedegradeerd of gewijzigd worden.
 * - De admin mag zichzelf niet degraderen.
 * - Nieuwe rol moet 'coach' of 'assistant' zijn.
 */
export async function updateClubMemberRole(
  clubId: string,
  memberUid: string,
  newRole: ClubMemberRole,
  adminUid?: string
): Promise<void> {
  const currentAdmin = adminUid || auth.currentUser?.uid;
  if (!currentAdmin) {
    throw new Error('Je moet ingelogd zijn om leden te beheren.');
  }

  // 1. Controleer of uitvoerder admin is
  const callerRole = await getClubMemberRole(clubId, currentAdmin);
  if (callerRole !== 'admin') {
    throw new Error('Alleen clubbeheerders mogen de rol van leden wijzigen.');
  }

  // 2. Controleer of doelgebruiker niet de eigenaar is
  const clubSnap = await getDoc(doc(db, 'clubs', clubId));
  if (!clubSnap.exists()) {
    throw new Error('Club Workspace niet gevonden.');
  }
  const clubOwnerUid = clubSnap.data().ownerUid;
  if (memberUid === clubOwnerUid) {
    throw new Error('De rol van de cloubeigenaar kan niet worden gewijzigd.');
  }

  // 3. Admin mag zichzelf niet wijzigen
  if (memberUid === currentAdmin) {
    throw new Error('Je kunt je eigen beheerdersrol niet wijzigen.');
  }

  // 4. Toegestane rollen
  if (newRole !== 'coach' && newRole !== 'assistant') {
    throw new Error('Alleen de rollen Coach en Assistent kunnen worden toegewezen.');
  }

  // 5. Ophalen oude waarde voor audit log
  const memberDocRef = doc(db, 'club_members', `${clubId}_${memberUid}`);
  const memberSnap = await getDoc(memberDocRef);
  if (!memberSnap.exists()) {
    throw new Error('Clublid niet gevonden.');
  }
  const oldRole = memberSnap.data().role || 'coach';

  // 6. Bijwerken in Firestore
  try {
    await updateDoc(memberDocRef, { role: newRole });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `club_members/${clubId}_${memberUid}`);
  }

  // 7. Audit log vastleggen
  await logClubAdminAction({
    adminUid: currentAdmin,
    clubId,
    memberUid,
    action: 'club_member_role_updated',
    oldValue: { role: oldRole },
    newValue: { role: newRole },
  });
}

/**
 * Werkt de status van een clublid bij (active <-> pending).
 * Beveiligingsregels:
 * - Alleen een Club Admin mag dit doen.
 * - Eigenaar van de club kan niet op pending worden gezet.
 * - De admin mag zichzelf niet op pending zetten.
 */
export async function updateClubMemberStatus(
  clubId: string,
  memberUid: string,
  newStatus: ClubMemberStatus,
  adminUid?: string
): Promise<void> {
  const currentAdmin = adminUid || auth.currentUser?.uid;
  if (!currentAdmin) {
    throw new Error('Je moet ingelogd zijn om leden te beheren.');
  }

  // 1. Controleer of uitvoerder admin is
  const callerRole = await getClubMemberRole(clubId, currentAdmin);
  if (callerRole !== 'admin') {
    throw new Error('Alleen clubbeheerders mogen de status van leden wijzigen.');
  }

  // 2. Controleer of doelgebruiker niet de eigenaar is
  const clubSnap = await getDoc(doc(db, 'clubs', clubId));
  if (!clubSnap.exists()) {
    throw new Error('Club Workspace niet gevonden.');
  }
  const clubOwnerUid = clubSnap.data().ownerUid;
  if (memberUid === clubOwnerUid) {
    throw new Error('De status van de cloubeigenaar kan niet worden gewijzigd.');
  }

  // 3. Admin mag zichzelf niet wijzigen
  if (memberUid === currentAdmin) {
    throw new Error('Je kunt je eigen lidstatus niet wijzigen.');
  }

  if (newStatus !== 'active' && newStatus !== 'pending') {
    throw new Error('Ongeldige status opgegeven.');
  }

  // 4. Ophalen oude waarde voor audit log
  const memberDocRef = doc(db, 'club_members', `${clubId}_${memberUid}`);
  const memberSnap = await getDoc(memberDocRef);
  if (!memberSnap.exists()) {
    throw new Error('Clublid niet gevonden.');
  }
  const oldStatus = memberSnap.data().status || 'active';

  // 5. Bijwerken in Firestore
  try {
    await updateDoc(memberDocRef, { status: newStatus });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `club_members/${clubId}_${memberUid}`);
  }

  // 6. Audit log vastleggen
  await logClubAdminAction({
    adminUid: currentAdmin,
    clubId,
    memberUid,
    action: 'club_member_status_updated',
    oldValue: { status: oldStatus },
    newValue: { status: newStatus },
  });
}

/**
 * Verwijdert een clublid uit de Club Workspace.
 * Beveiligingsregels:
 * - Alleen een Club Admin mag dit doen.
 * - Eigenaar van de club kan niet worden verwijderd.
 * - Admin kan zichzelf niet verwijderen.
 */
export async function removeClubMember(
  clubId: string,
  memberUid: string,
  adminUid?: string
): Promise<void> {
  const currentAdmin = adminUid || auth.currentUser?.uid;
  if (!currentAdmin) {
    throw new Error('Je moet ingelogd zijn om leden te beheren.');
  }

  // 1. Controleer of uitvoerder admin is
  const callerRole = await getClubMemberRole(clubId, currentAdmin);
  if (callerRole !== 'admin') {
    throw new Error('Alleen clubbeheerders mogen leden verwijderen.');
  }

  // 2. Controleer of doelgebruiker niet de eigenaar is
  const clubSnap = await getDoc(doc(db, 'clubs', clubId));
  if (!clubSnap.exists()) {
    throw new Error('Club Workspace niet gevonden.');
  }
  const clubOwnerUid = clubSnap.data().ownerUid;
  if (memberUid === clubOwnerUid) {
    throw new Error('De eigenaar van de club kan niet worden verwijderd.');
  }

  // 3. Admin mag zichzelf niet verwijderen
  if (memberUid === currentAdmin) {
    throw new Error('Je kunt jezelf niet als beheerder verwijderen uit de Club Workspace.');
  }

  // 4. Ophalen bestaande gegevens voor audit log
  const memberDocRef = doc(db, 'club_members', `${clubId}_${memberUid}`);
  const memberSnap = await getDoc(memberDocRef);
  if (!memberSnap.exists()) {
    throw new Error('Clublid niet gevonden.');
  }
  const existingData = memberSnap.data();

  // 5. Document verwijderen uit club_members
  try {
    await deleteDoc(memberDocRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `club_members/${clubId}_${memberUid}`);
  }

  // 6. Audit log vastleggen
  await logClubAdminAction({
    adminUid: currentAdmin,
    clubId,
    memberUid,
    action: 'club_member_removed',
    oldValue: {
      role: existingData.role,
      status: existingData.status,
      joinedAt: existingData.joinedAt,
      userEmail: existingData.userEmail || null,
    },
    newValue: null,
  });
}

/**
 * Koppelt een bestaand team aan een Club Workspace.
 * Behoudt de oorspronkelijke userId en voegt clubId toe.
 */
export async function linkTeamToClub(
  teamId: string,
  clubId: string,
  userUid?: string
): Promise<void> {
  if (!teamId || !clubId) return;
  const currentUid = userUid || auth.currentUser?.uid;
  if (!currentUid) throw new Error('Inloggen vereist.');

  const teamRef = doc(db, 'teams', teamId);
  try {
    await updateDoc(teamRef, { clubId });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `teams/${teamId}`);
  }
}

/**
 * Ontkoppelt een team van een Club Workspace (maakt het weer een persoonlijk team).
 */
export async function unlinkTeamFromClub(
  teamId: string,
  userUid?: string
): Promise<void> {
  if (!teamId) return;
  const currentUid = userUid || auth.currentUser?.uid;
  if (!currentUid) throw new Error('Inloggen vereist.');

  const teamRef = doc(db, 'teams', teamId);
  try {
    await updateDoc(teamRef, { clubId: null });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `teams/${teamId}`);
  }
}

/**
 * Koppelt een bestaande speler aan een Club Workspace.
 * Behoudt de oorspronkelijke userId en voegt clubId toe.
 */
export async function linkPlayerToClub(
  playerId: string,
  clubId: string,
  userUid?: string
): Promise<void> {
  if (!playerId || !clubId) return;
  const currentUid = userUid || auth.currentUser?.uid;
  if (!currentUid) throw new Error('Inloggen vereist.');

  const playerRef = doc(db, 'players', playerId);
  try {
    await updateDoc(playerRef, { clubId });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `players/${playerId}`);
  }
}

/**
 * Ontkoppelt een speler van de Club Workspace (maakt het weer een persoonlijke speler).
 */
export async function unlinkPlayerFromClub(
  playerId: string,
  userUid?: string
): Promise<void> {
  if (!playerId) return;
  const currentUid = userUid || auth.currentUser?.uid;
  if (!currentUid) throw new Error('Inloggen vereist.');

  const playerRef = doc(db, 'players', playerId);
  try {
    await updateDoc(playerRef, { clubId: null });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `players/${playerId}`);
  }
}

/**
 * Haalt alle spelers op die gekoppeld zijn aan de Club Workspace (clubId).
 */
export async function getClubPlayers(clubId: string): Promise<Player[]> {
  if (!clubId) return [];

  try {
    const playersRef = collection(db, 'players');
    const q = query(playersRef, where('clubId', '==', clubId));
    const snap = await getDocs(q);

    const players: Player[] = [];
    snap.forEach((docSnap) => {
      players.push({ id: docSnap.id, ...docSnap.data() } as Player);
    });
    return players;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `players for club ${clubId}`);
    return [];
  }
}


