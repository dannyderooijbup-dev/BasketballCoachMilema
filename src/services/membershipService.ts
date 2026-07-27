import { doc, setDoc, collection, addDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { UserMembership, UserRole } from '../types';

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
 * Start een proefperiode van 14 dagen voor de opgegeven gebruiker.
 */
export async function startTrial(
  adminUid: string,
  targetUid: string,
  currentMembership?: UserMembership | null
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
}

/**
 * Uitbreidbaar voor toekomstige acties:
 * - activateCoach
 * - activateClub
 * - resetPending
 * - changeRole
 */
