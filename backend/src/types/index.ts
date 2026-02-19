// Re-export all types from the shared package
export type {
  LeaveType,
  Employee,
  CreateEmployeeRequest,
  UpdateEmployeeRequest,
  Event,
  CreateEventRequest,
  UpdateEventRequest,
  HolidayType,
  Holiday,
  CompanyHoliday,
  CreateCompanyHolidayInput,
  UpdateCompanyHolidayInput,
  NotificationType,
  WeeklyScope,
  CronjobConfig,
  ApiResponse,
} from '../../../shared/types';

export { LEAVE_TYPES } from '../../../shared/types';