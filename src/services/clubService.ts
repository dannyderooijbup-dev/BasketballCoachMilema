import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  query, 
  where 
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { ClubWorkspace, ClubMember, ClubMemberRole, ClubMemberStatus, Team } from '../types';

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
      await setDoc(memberDocRef, {
        clubId,
        userUid,
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
        role: data.role || 'coach',
        status: data.status || 'active',
        joinedAt: data.joinedAt || Date.now(),
      };

      // Ophalen naam/e-mail uit users collectie
      try {
        const userSnap = await getDoc(doc(db, 'users', data.userUid));
        if (userSnap.exists()) {
          const userData = userSnap.data();
          memberItem.userName = userData.naam || '';
          memberItem.userEmail = userData.email || '';
        }
      } catch (e) {
        console.warn('Kon lid gebruikersprofiel niet verrijken:', e);
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
 * Haalt de specifieke rol op van een gebruiker binnen een Club Workspace.
 */
export async function getClubMemberRole(clubId: string, userUid: string): Promise<ClubMemberRole | null> {
  if (!clubId || !userUid) return null;

  try {
    const memberDocRef = doc(db, 'club_members', `${clubId}_${userUid}`);
    const memberSnap = await getDoc(memberDocRef);
    if (memberSnap.exists()) {
      return (memberSnap.data().role as ClubMemberRole) || 'coach';
    }

    const clubSnap = await getDoc(doc(db, 'clubs', clubId));
    if (clubSnap.exists() && clubSnap.data().ownerUid === userUid) {
      return 'admin';
    }

    return null;
  } catch (err) {
    console.warn('Kon clubrol van gebruiker niet ophalen:', err);
    return null;
  }
}

