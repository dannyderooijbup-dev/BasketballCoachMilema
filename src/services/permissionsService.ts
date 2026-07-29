import { UserMembership, MembershipPermissions } from '../types';

/**
 * Centrale permissie-configuratie per membership type.
 * Nieuwe premium- of rolfuncties kunnen hier eenvoudig worden toegevoegd als extra properties.
 */
export const MEMBERSHIP_PERMISSIONS_CONFIG: Record<string, MembershipPermissions> = {
  coach: {
    hasAccess: true,
    maxTeams: 3,
    canExportData: true,
    canManageMultipleClubs: false,
  },
  club: {
    hasAccess: true,
    maxTeams: Infinity,
    canExportData: true,
    canManageMultipleClubs: true,
  },
  trial: {
    hasAccess: true,
    maxTeams: 3,
    canExportData: true,
    canManageMultipleClubs: false,
  },
  pending: {
    hasAccess: false,
    maxTeams: 0,
    canExportData: false,
    canManageMultipleClubs: false,
  },
  suspended: {
    hasAccess: false,
    maxTeams: 0,
    canExportData: false,
    canManageMultipleClubs: false,
  },
};

export interface TrialCalculationResult {
  remainingDays: number;
  usedDays: number;
  totalDays: number;
  progressPercentage: number; // percentage of trial completed (0-100)
  remainingPercentage: number; // percentage of trial remaining (0-100)
  isExpired: boolean;
  statusColor: 'green' | 'orange' | 'red' | 'expired';
  expiryDateFormatted: string;
}

const DEFAULT_TRIAL_DURATION_DAYS = 14;

/**
 * Berekent het aantal resterende dagen van een proefperiode.
 */
export function getRemainingTrialDays(membership?: UserMembership | null): number {
  if (!membership || membership.type !== 'trial' || !membership.trialEnd) {
    return 0;
  }
  const now = Date.now();
  if (now >= membership.trialEnd) {
    return 0;
  }
  const diffMs = membership.trialEnd - now;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Berekent het aantal gebruikte dagen van een proefperiode.
 */
export function getUsedTrialDays(membership?: UserMembership | null): number {
  if (!membership || membership.type !== 'trial') {
    return 0;
  }
  const totalDays = DEFAULT_TRIAL_DURATION_DAYS;
  const remainingDays = getRemainingTrialDays(membership);
  return Math.max(0, Math.min(totalDays, totalDays - remainingDays));
}

/**
 * Bepaalt de kleurstatus op basis van het aantal resterende trialdagen.
 * - Groen: meer dan 7 dagen (> 7)
 * - Oranje: 3 t/m 7 dagen (3-7)
 * - Rood: 0 t/m 2 dagen (0-2)
 * - Expired: wanneer verlopen
 */
export function getTrialStatusColor(remainingDays: number, isExpired: boolean): 'green' | 'orange' | 'red' | 'expired' {
  if (isExpired || remainingDays <= 0) {
    return 'expired';
  }
  if (remainingDays > 7) {
    return 'green';
  }
  if (remainingDays >= 3) {
    return 'orange';
  }
  return 'red';
}

/**
 * Maakt een volledige proefperiode berekening met alle benodigde UI-data.
 */
export function calculateTrialDetails(membership?: UserMembership | null): TrialCalculationResult {
  const expired = isTrialExpired(membership);
  const remainingDays = getRemainingTrialDays(membership);
  const totalDays = DEFAULT_TRIAL_DURATION_DAYS;
  const usedDays = expired ? totalDays : Math.max(0, totalDays - remainingDays);

  const progressPercentage = Math.min(100, Math.max(0, Math.round((usedDays / totalDays) * 100)));
  const remainingPercentage = Math.min(100, Math.max(0, 100 - progressPercentage));
  const statusColor = getTrialStatusColor(remainingDays, expired);

  let expiryDateFormatted = 'Onbekend';
  if (membership?.trialEnd) {
    expiryDateFormatted = new Date(membership.trialEnd).toLocaleDateString('nl-NL', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  return {
    remainingDays,
    usedDays,
    totalDays,
    progressPercentage,
    remainingPercentage,
    isExpired: expired,
    statusColor,
    expiryDateFormatted,
  };
}

/**
 * Controleert of een proefperiode verstreken is op basis van de huidige timestamp en trialEnd.
 */
export function isTrialExpired(membership?: UserMembership | null): boolean {
  if (!membership || membership.type !== 'trial') return false;
  if (!membership.trialEnd) return false;
  return Date.now() > membership.trialEnd;
}

/**
 * Bepaalt de geldende permissies voor een gebruiker op basis van zijn membership-status en -type.
 */
export function getPermissions(membership?: UserMembership | null): MembershipPermissions {
  if (!membership) {
    return MEMBERSHIP_PERMISSIONS_CONFIG.pending;
  }

  // Als de status geschorst (suspended) is, vervallen alle rechten
  if (membership.status === 'suspended') {
    return MEMBERSHIP_PERMISSIONS_CONFIG.suspended;
  }

  // Als de status niet 'active' is (bijv. pending of inactive), geen toegang
  if (membership.status !== 'active') {
    return MEMBERSHIP_PERMISSIONS_CONFIG.pending;
  }

  // Bij een trial: controleer of de proefperiode niet verlopen is
  if (membership.type === 'trial' && isTrialExpired(membership)) {
    return MEMBERSHIP_PERMISSIONS_CONFIG.pending;
  }

  const type = membership.type?.toLowerCase() || 'pending';
  return MEMBERSHIP_PERMISSIONS_CONFIG[type] || MEMBERSHIP_PERMISSIONS_CONFIG.pending;
}

/**
 * Geeft het maximale aantal teams dat een gebruiker mag aanmaken.
 * Retourneert Infinity voor onbeperkt (zoals bij Club).
 */
export function getMaxTeams(membership?: UserMembership | null): number {
  const permissions = getPermissions(membership);
  return permissions.maxTeams;
}

/**
 * Controleert of een gebruiker nog een nieuw team mag aanmaken op basis van het huidige aantal teams.
 */
export function canCreateTeam(membership?: UserMembership | null, currentTeamCount: number = 0): boolean {
  const permissions = getPermissions(membership);
  if (!permissions.hasAccess) return false;
  if (permissions.maxTeams === Infinity) return true;
  return currentTeamCount < permissions.maxTeams;
}

/**
 * Helper om snel te controleren of de gebruiker algemene toegang tot de applicatie heeft.
 */
export function hasGeneralAccess(membership?: UserMembership | null): boolean {
  return getPermissions(membership).hasAccess;
}

export interface UpgradeReason {
  code: 'MAX_TEAMS_REACHED' | 'TRIAL_EXPIRED' | 'MEMBERSHIP_SUSPENDED' | 'ACCESS_PENDING' | 'FEATURE_LOCKED';
  title: string;
  description: string;
  suggestedPlan?: 'coach' | 'club';
}

/**
 * Bepaalt centraal de reden waarom een actie of functie beperkt is en retourneert de bijbehorende melding.
 */
export function getUpgradeReason(
  membership?: UserMembership | null,
  currentTeamCount: number = 0
): UpgradeReason | null {
  const permissions = getPermissions(membership);

  if (membership?.status === 'suspended') {
    return {
      code: 'MEMBERSHIP_SUSPENDED',
      title: 'Lidmaatschap opgeschort',
      description: 'Je account is tijdelijk opgeschort. Neem contact op met de beheerder voor meer informatie.',
    };
  }

  if (membership?.type === 'trial' && isTrialExpired(membership)) {
    return {
      code: 'TRIAL_EXPIRED',
      title: 'Proefperiode verlopen',
      description: 'Je proefperiode van 14 dagen is verlopen. Upgrade naar een Coach- of Club-lidmaatschap om verder te werken.',
      suggestedPlan: 'coach',
    };
  }

  if (!permissions.hasAccess) {
    return {
      code: 'ACCESS_PENDING',
      title: 'Toegang in behandeling',
      description: 'Je account-aanvraag is nog in behandeling. Zodra je account goedgekeurd is, krijg je toegang.',
    };
  }

  if (permissions.maxTeams !== Infinity && currentTeamCount >= permissions.maxTeams) {
    const typeLabel = membership?.type === 'trial' ? 'Proefperiode' : 'Coach';
    return {
      code: 'MAX_TEAMS_REACHED',
      title: 'Maximum aantal teams bereikt',
      description: `Je ${typeLabel}-lidmaatschap ondersteunt maximaal ${permissions.maxTeams} teams. Upgrade naar Club om onbeperkt teams te beheren en toekomstige premiumfuncties te gebruiken.`,
      suggestedPlan: 'club',
    };
  }

  return null;
}

