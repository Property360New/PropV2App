// ─── Auth Types ─────────────────────────────────────────────
export type Designation =
  | "SALES_EXECUTIVE"
  | "TEAM_LEAD"
  | "SALES_MANAGER"
  | "AREA_MANAGER"
  | "DGM"
  | "GM"
  | "VP_SALES"
  | "ADMIN"
  | "SALES_COORDINATOR";

export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  designation: Designation;
  avatar: string | null;
  companyId: string;
  dailyCallTarget: number | null;
  monthlySalesTarget: string | null;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  employee: Employee;
  mustAcceptTerms?: boolean;
}

export interface AuthProfile {
  userId: string;
  email: string;
  lastLoginAt: string;
  employeeId: string;
  companyId: string;
  designation: Designation;
  subordinateIds: string[];
  permissions: {
    canViewAllFreshLeads: boolean;
    canEditInventory: boolean;
    canAddExpenses: boolean;
    canManageEmployees: boolean;
    canViewAllAttendance: boolean;
  };
  reportingManagerId: string | null;
  birthday: string | null;
  marriageAnniversary: string | null;
  phone: string | null;
  firstName: string;
  lastName: string | null;
  dailyCallTarget: number | null;
  monthlySalesTarget: number | null;
  avatar: string | null;
}

// ─── Lead Types ─────────────────────────────────────────────
export type LeadStatus =
  | "FRESH"
  | "FOLLOW_UP"
  | "NOT_INTERESTED"
  | "DEAL_DONE"
  | "HOT_PROSPECT"
  | "SUSPECT"
  | "VISIT_DONE"
  | "MEETING_DONE"
  | "RINGING"
  | "SWITCH_OFF"
  | "WRONG_NUMBER"
  | "CALL_BACK";

export type LeadSource = string;
export type LeadType = "ALL" | "RENT" | "RESIDENTIAL" | "COMMERCIAL";
export type FurnishingType = "RAW_FLAT" | "SEMI_FURNISHED" | "FULLY_FURNISHED";

export type TabCounts = Record<string, number>;

// ─── Query Remark ────────────────────────────────────────────
// A remark added to an existing query — does not create a new query entry.
export interface QueryRemark {
  id: string;
  queryId?: string;       // optional — not always present in nested responses
  text: string;
  createdAt: string;
  updatedAt?: string;     // optional — not always present in nested responses
  createdBy: { id: string; firstName: string; lastName: string };
}

// ─── Lead Query ──────────────────────────────────────────────
export interface LeadQuery {
  id: string;

  // RENAMED from callStatus — single unified status field
  status: LeadStatus;
  // Alias kept so any component still reading callStatus doesn't break
  callStatus: LeadStatus;

  remark: string | null;
  isAutoRemark?: boolean;

  // Dates
  followUpDate: string | null;
  visitDate:    string | null;
  meetingDate:  string | null;
  dealDoneDate: string | null;
  expVisitDate: string | null;   // expected visit date
  shiftingDate: string | null;   // rent leads only

  // Lead interest details captured at query time
  leadType:       LeadType | null;
  bhk:            string | null;
  floor:          string | null;
  location:       string | null;  // commercial: area/sector
  purpose:        string | null;  // commercial: "Rental Income" | "Appreciation" | "Self Use"
  furnishingType: FurnishingType | null;
  size:           number | null;  // sqft — residential only

  // Budget
  projectId: string | null;
  project?:  { id: string; name: string } | null;
  budgetMin:  number | null;
  budgetMax:  number | null;
  budgetUnit: string | null;

  // Visit / Meeting participants
  visitDoneById?:   string | null;
  visitDoneBy?:     { id: string; firstName: string; lastName: string } | null;
  meetingDoneById?: string | null;
  meetingDoneBy?:   { id: string; firstName: string; lastName: string } | null;

  // Deal done specifics
  closingAmount: number | null;
  unitNo:        string | null;

  // Not interested reason
  reason: string | null;

  // Admin-only financials
  leadActualSlab: number | null;
  discount:       number | null;
  actualRevenue:  number | null;
  incentiveSlab:  number | null;
  sellRevenue:    number | null;

  createdAt: string;
  updatedAt?: string;
  createdBy?: { id: string; firstName: string; lastName: string };

  // Remarks added to this query over time
  remarks?: QueryRemark[];
}

// ─── Lead ────────────────────────────────────────────────────
export interface Lead {
  id: string;
  name: string;
  phone: string;
  phone2: string | null;
  email: string | null;
  address: string | null;
  source: string | null;
  type: string | null;
  assignedToId: string;
  assignedTo?: { id: string; firstName: string; lastName: string };
  createdById: string;
  createdBy?: { id: string; firstName: string; lastName: string };
  projectId: string | null;
  project?: { id: string; name: string } | null;
  queries: LeadQuery[];
  latestQuery?: LeadQuery | null;
  totalCalls: number;
  lastCalledAt: string | null;
  highlightedQueryId: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// ─── Dashboard Types ────────────────────────────────────────
export interface DashboardSummary {
  totalLeads: number;
  freshLeads: number;
  followUpLeads: number;
  dealsDoneThisMonth: number;
  hotProspects: number;
  overdueFollowups: number;
  totalCustomers: number;
}

export interface NotificationStripItem {
  employeeId: string;
  employeeName: string;
  hasSale: boolean;
  lastSaleAt: string | null;
  showToAdmin: boolean;
}

export interface TodaysFollowup {
  id: string;
  followUpDate: string;
  lead: {
    id: string;
    name: string;
    phone: string;
    status: LeadStatus;
  };
}

export interface MyTarget {
  employeeId: string;
  month: number;
  year: number;
  callTarget: number;
  salesTarget: number;
  callsAchieved: number;
  salesAchieved: number;
  visitsAchieved: number;
  meetingsAchieved: number;
  dealsAchieved: number;
}

// ─── Notification Types ─────────────────────────────────────
export interface AppNotification {
  id: string;
  recipientId?: string;
  type: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
  recipientEmployee?: { id: string; firstName: string; lastName: string; designation?: string };
  isOwnNotification?: boolean;
}

export interface NotificationListResponse {
  data: AppNotification[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// ─── Attendance Types ───────────────────────────────────────
export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employee?: { id: string; firstName: string; lastName: string };
  date: string;
  checkInAt: string | null;
  checkInLat: number | null;
  checkInLng: number | null;
  checkInLocation: string | null;
  checkOutAt: string | null;
  checkOutLat: number | null;
  checkOutLng: number | null;
  checkOutLocation: string | null;
  hoursWorked: number | null;
  status: "PRESENT_FULL" | "PRESENT_HALF" | "ABSENT" | "FULL_DAY" | "HALF_DAY";
}

// ─── Hierarchy Types ────────────────────────────────────────
export interface ScopeEmployee {
  id: string;
  firstName: string;
  lastName: string;
  designation: Designation;
}

// ─── Employee Management Types ──────────────────────────────
export interface ManagedEmployee {
  id: string;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  designation: Designation;
  avatar: string | null;
  reportingManagerId: string | null;
  reportingManager?: { id: string; firstName: string; lastName: string; designation: Designation } | null;
  dailyCallTarget: number | null;
  monthlySalesTarget: number | null;
  isActive: boolean;
  birthday: string | null;
  marriageAnniversary: string | null;
  user?: { email: string; isActive: boolean };
}

export interface CreateEmployeeBody {
  firstName: string;
  lastName?: string;
  email: string;
  password: string;
  phone?: string;
  designation: Designation;
  reportingManagerId?: string;
  birthday?: string;
  marriageAnniversary?: string;
  dailyCallTarget?: number;
  monthlySalesTarget?: number;
}

// ─── Expense Types ──────────────────────────────────────────
export type ExpenseCategory = "PERSONAL" | "OFFICE";

export type ExpenseSubCategory =
  // Personal
  | "FAMILY" | "GROCERY" | "VEGETABLES_FRUITS" | "MAINTENANCE" | "RECHARGE"
  | "IGL" | "CLOTHS" | "MEDICAL" | "EMI" | "MAID" | "VEHICLE"
  | "GIFTS" | "TRAVELS" | "INVESTMENT" | "LIC" | "PERSONAL_OTHER"
  // Office
  | "SALARY" | "MARKETING" | "INCENTIVE" | "STATIONERY" | "MISCELLANEOUS"
  | "MOBILE_RECHARGE" | "WIFI_RECHARGE" | "OFFICE_EXPENSE" | "CONVEYANCE"
  | "ELECTRICITY" | "OFFICE_MAINTENANCE" | "OFFICE_OTHER";

export interface Expense {
  id: string;
  category: ExpenseCategory;
  subCategory?: ExpenseSubCategory;
  title: string;
  amount: number;
  description: string | null;
  receiptUrl: string | null;
  expenseDate: string;
  createdById: string;
  createdBy?: { id: string; firstName: string; lastName: string; designation?: Designation };
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseListResponse {
  data: Expense[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    totalAmount: number;
  };
}

// ─── Inventory Types ────────────────────────────────────────
export type InventoryType = "RESIDENTIAL" | "COMMERCIAL";
export type InventorySubType =
  | "RENT_RESIDENTIAL"
  | "RESALE_RESIDENTIAL"
  | "RENT_COMMERCIAL"
  | "RESALE_COMMERCIAL";
export type BHKType =
  | "TWO_BHK"
  | "TWO_BHK_STUDY"
  | "THREE_BHK"
  | "THREE_BHK_STUDY"
  | "THREE_BHK_SERVANT"
  | "THREE_BHK_STORE"
  | "FOUR_BHK"
  | "FOUR_BHK_STUDY"
  | "FOUR_BHK_SERVANT"
  | "FOUR_BHK_STORE";

export interface InventoryItem {
  id: string;
  ownerName: string;
  ownerPhone: string;
  ownerEmail: string | null;
  inventoryType: InventoryType;
  inventorySubType: InventorySubType;
  projectId: string | null;
  project?: { id: string; name: string } | null;
  unitNo: string | null;
  towerNo: string | null;
  bhk: BHKType | null;
  size: number | null;
  facing: string | null;
  floor: string | null;
  demand: number | null;
  hasTenant: boolean;
  hasParking: boolean;
  expectedVisitTime: string | null;
  availableDate: string | null;
  furnishingType: FurnishingType | null;
  inventoryStatus: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Customer Types ─────────────────────────────────────────
export interface Customer {
  id: string;
  leadId: string;
  name: string;
  phone: string;
  email: string | null;
  source: string | null;
  leadActualSlab: number | null;
  discount: number | null;
  actualRevenue: number | null;
  incentiveSlab: number | null;
  salesRevenue: number | null;
  incentiveAmount: number | null;
  dealValue: number | null;
  incentiveNote: string | null;
  createdById: string;
  createdBy?: { id: string; firstName: string; lastName: string };
  assignedToId: string | null;
  assignedTo?: { id: string; firstName: string; lastName: string; designation?: Designation };
  lead?: {
    id: string;
    source: string | null;
    type: string | null;
    project?: { id: string; name: string } | null;
    // UPDATED: queries now use `status` instead of `callStatus`
    queries?: {
      id: string;
      status: LeadStatus;
      callStatus: LeadStatus; // alias
      remark: string | null;
      dealDoneDate: string | null;
      createdAt: string;
    }[];
  };
  createdAt: string;
  updatedAt: string;
}

// ─── Target Types (team) ────────────────────────────────────
export interface TeamTarget {
  id: string;
  employeeId: string;
  month: number;
  year: number;
  callTarget: number;
  salesTarget: number;
  callsAchieved: number;
  salesAchieved: number;
  visitsAchieved: number;
  meetingsAchieved: number;
  dealsAchieved: number;
  employee?: {
    id: string;
    firstName: string;
    lastName: string;
    designation: Designation;
    avatar: string | null;
  };
}

// ─── Staff Location Types ───────────────────────────────────
export interface StaffLocation {
  id: string;
  employeeId: string;
  employee?: { id: string; firstName: string; lastName: string; designation: Designation };
  latitude: number;
  longitude: number;
  address: string | null;
  capturedAt: string;
}

// ─── Project Types ──────────────────────────────────────────
export interface Project {
  id: string;
  name: string;
  clientName: string | null;
  product: string | null;
  sizeInSqft: number | null;
  floors: number | null;
  paymentPlan: string | null;
  basicSellPrice: number | null;
  discount: number | null;
  viewPlc: number | null;
  cornerPlc: number | null;
  floorPlc: number | null;
  edc: number | null;
  idc: number | null;
  ffc: number | null;
  otherAdditionalCharges: number | null;
  leastRent: number | null;
  otherPossessionCharges: number | null;
  gstPercent: number | null;
  note1: string | null;
  note2: string | null;
  note3: string | null;
  note4: string | null;
  powerBackupKva: number | null;
  powerBackupPrice: number | null;
  onBookingPercent: number | null;
  within30DaysPercent: number | null;
  onPossessionPercent: number | null;
  isActive: boolean;
  createdAt: string;
}

// ─── Terms & Privacy Types ──────────────────────────────────
export interface TermsConditions {
  id: string;
  content: string;
  version: number;
  isActive: boolean;
  createdAt: string;
}

export interface PrivacyPolicy {
  content: string;
  version: number;
  updatedAt: string;
}

// ─── Hierarchy Tree Types ───────────────────────────────────
export interface HierarchyNode {
  id: string;
  firstName: string;
  lastName: string | null;
  designation: Designation;
  avatar: string | null;
  children: HierarchyNode[];
}

// ─── KRA Calendar ───────────────────────────────────────────
export interface CallActivityBucket {
  range: string;
  count: number;
}

export interface CallActivityResponse {
  buckets: CallActivityBucket[];
  total: number;
  dateRange: { gte: string; lte: string };
}