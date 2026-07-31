/** Bump version suffix when tours should reset for existing users. */
const ONBOARDING_KEY_VERSION = 'v2';

export const FEATURE_TOUR_WELCOME_KEY = `paracal.${ONBOARDING_KEY_VERSION}.featureTourWelcomeDismissed`;
export const CALENDAR_MODE_TOUR_KEY = `paracal.${ONBOARDING_KEY_VERSION}.calendarModeTourDismissed`;
export const JIRA_WORKLOG_PERSON_TOUR_KEY = `paracal.${ONBOARDING_KEY_VERSION}.jiraWorklogPersonTourDismissed`;
export const JIRA_WORKLOG_RELOAD_TOUR_KEY = `paracal.${ONBOARDING_KEY_VERSION}.jiraWorklogReloadTourDismissed`;

export const hasSeenOnboarding = (key: string) => {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem(key) === 'true';
};

export const markOnboardingSeen = (key: string) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, 'true');
};
