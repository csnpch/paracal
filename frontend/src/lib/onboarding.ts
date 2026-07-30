export const FEATURE_TOUR_WELCOME_KEY = 'paracal.featureTourWelcomeDismissed';
export const CALENDAR_MODE_TOUR_KEY = 'paracal.calendarModeTourDismissed';
export const JIRA_WORKLOG_PERSON_TOUR_KEY = 'paracal.jiraWorklogPersonTourDismissed';
export const JIRA_WORKLOG_RELOAD_TOUR_KEY = 'paracal.jiraWorklogReloadTourDismissed';

export const hasSeenOnboarding = (key: string) => {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem(key) === 'true';
};

export const markOnboardingSeen = (key: string) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, 'true');
};
