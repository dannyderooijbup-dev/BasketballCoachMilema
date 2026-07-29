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

