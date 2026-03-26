export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  twoFactorEnabled: boolean;
  isEmailVerified: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

export interface BankAccount {
  id: string;
  bankName: string;
  accountName: string;
  iban?: string;
  accountType: 'CHECKING' | 'SAVINGS' | 'CREDIT_CARD' | 'DEPOT' | 'LOAN' | 'OTHER';
  balance: number | string;
  currency: string;
  lastSynced?: string;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  isSystem: boolean;
  keywords: string[];
}

export interface Transaction {
  id: string;
  bankAccountId: string;
  categoryId?: string;
  category?: Pick<Category, 'name' | 'icon' | 'color'>;
  amount: number | string;
  currency: string;
  date: string;
  purpose?: string;
  counterpartName?: string;
  counterpartIban?: string;
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER' | 'STANDING_ORDER' | 'DIRECT_DEBIT' | 'OTHER';
  notes?: string;
  tags: string[];
}

export interface Budget {
  id: string;
  categoryId: string;
  category?: Pick<Category, 'name' | 'icon' | 'color'>;
  amount: number;
  spent: number;
  remaining: number;
  percentage: number;
  period: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  isActive: boolean;
}

export interface DashboardData {
  overview: {
    totalBalance: number;
    monthlyIncome: number;
    monthlyExpenses: number;
    savingsRate: number;
  };
  recentTransactions: Transaction[];
  accounts: BankAccount[];
  expensesByCategory: Array<{
    categoryId: string;
    category?: Pick<Category, 'name' | 'icon' | 'color'>;
    amount: number;
  }>;
}

export interface MonthlyOverview {
  month: string;
  income: number;
  expenses: number;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    totalPages: number;
  };
}

export interface CreateAccountData {
  bankName: string;
  accountName: string;
  iban?: string;
  accountType?: BankAccount['accountType'];
  balance?: number;
}

export interface CreateBudgetData {
  categoryId: string;
  amount: number;
  period?: Budget['period'];
}

export interface CreateTransactionData {
  bankAccountId: string;
  amount: number;
  date: string;
  purpose?: string;
  counterpartName?: string;
  counterpartIban?: string;
  categoryId?: string;
  type?: Transaction['type'];
  notes?: string;
  tags?: string[];
}

export interface RecurringPayment {
  id: string;
  name: string;
  amount: number | string;
  currency: string;
  frequency: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'BIANNUALLY' | 'YEARLY';
  counterpartName?: string;
  categoryId?: string;
  category?: Pick<Category, 'name' | 'icon' | 'color'>;
  nextDueDate?: string;
  lastChargeDate?: string;
  isActive: boolean;
}

export interface CreateRecurringPaymentData {
  name: string;
  amount: number;
  frequency?: RecurringPayment['frequency'];
  counterpartName?: string;
  categoryId?: string;
  nextDueDate?: string;
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  currency: string;
  deadline?: string;
  icon?: string;
  color?: string;
  isCompleted: boolean;
  completedAt?: string;
  percentage: number;
  remaining: number;
}

export interface CreateSavingsGoalData {
  name: string;
  targetAmount: number;
  currentAmount?: number;
  deadline?: string;
  icon?: string;
  color?: string;
}

export interface Contract {
  id: string;
  name: string;
  provider: string;
  contractType: string;
  monthlyCost: number;
  yearlyCost: number;
  billingCycle: 'MONTHLY' | 'QUARTERLY' | 'BIANNUALLY' | 'YEARLY';
  contractNumber?: string;
  startDate?: string;
  endDate?: string;
  cancellationDate?: string;
  noticePeriod?: string;
  autoRenewal: boolean;
  details?: Record<string, unknown>;
  counterpartName?: string;
  counterpartIban?: string;
  avgMonthlyAmount: number;
  transactionCount: number;
  lastChargeDate?: string;
  isActive: boolean;
  isAutoDetected: boolean;
}

export interface CreateContractData {
  name: string;
  provider: string;
  contractType: string;
  monthlyCost?: number;
  yearlyCost?: number;
  billingCycle?: string;
  contractNumber?: string;
  startDate?: string;
  endDate?: string;
  cancellationDate?: string;
  noticePeriod?: string;
  autoRenewal?: boolean;
  details?: Record<string, unknown>;
  counterpartName?: string;
  counterpartIban?: string;
}

export interface DetectedContract {
  counterpartName: string;
  counterpartIban?: string;
  occurrences: number;
  totalAmount: number;
  avgAmount: number;
  frequency: string;
  lastDate: string;
  firstDate: string;
  suggestedType: string;
}

export interface ProviderComparison {
  contractId: string;
  contractName: string;
  provider: string;
  contractType: string;
  currentMonthly: number;
  currentYearly: number;
  marketAvgMonthly: number;
  marketAvgYearly: number;
  savingsPotentialMonthly: number;
  savingsPotentialYearly: number;
  percentAboveAvg: number;
  rating: 'GOOD' | 'OK' | 'EXPENSIVE';
  tips: string[];
  compareUrls: string[];
}

export interface TransactionFilters {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
  bankAccountId?: string;
  startDate?: string;
  endDate?: string;
  type?: Transaction['type'];
  tag?: string;
}

// ---------- Notifications ----------
export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
}

// ---------- Categorization Rules ----------
export interface CategorizationRule {
  id: string;
  categoryId: string;
  category?: Pick<Category, 'name' | 'icon' | 'color'>;
  field: string;
  operator: string;
  value: string;
  priority: number;
  isActive: boolean;
  appliedCount: number;
}

export interface CreateRuleData {
  categoryId: string;
  field: string;
  operator: string;
  value: string;
  priority?: number;
}

// ---------- Reports ----------
export interface MonthlyReport {
  period: { year: number; month: number; label: string };
  income: { total: number; byCategory: { category: string; amount: number }[] };
  expenses: { total: number; byCategory: { category: string; amount: number; percentage: number }[] };
  balance: number;
  savingsRate: number;
  topExpenses: { counterpartName: string; total: number; count: number }[];
  comparison: { prevMonth: { income: number; expenses: number }; change: { incomePercent: number; expensesPercent: number } };
  budgetStatus: { budget: { id: string; category: { name: string; icon?: string; color?: string }; amount: number }; spent: number; remaining: number; percentage: number }[];
  dailySpending: { date: string; amount: number }[];
}

export interface YearlyReport {
  period: { year: number; label: string };
  income: { total: number; byMonth: { month: number; amount: number }[]; byCategory: { category: string; amount: number }[] };
  expenses: { total: number; byMonth: { month: number; amount: number }[]; byCategory: { category: string; amount: number; percentage: number }[] };
  balance: number;
  savingsRate: number;
  monthlyAvg: { income: number; expenses: number };
  netWorthChange: number;
}

// ---------- Assets / Net Worth ----------
export interface Asset {
  id: string;
  name: string;
  assetType: string;
  value: number;
  currency: string;
  isLiability: boolean;
  interestRate?: number;
  institution?: string;
  notes?: string;
}

export interface CreateAssetData {
  name: string;
  assetType: string;
  value: number;
  currency?: string;
  isLiability?: boolean;
  interestRate?: number;
  institution?: string;
  notes?: string;
}

export interface NetWorthSummary {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  byType: { type: string; items: { name: string; value: number }[]; total: number }[];
  bankAccounts: { total: number; accounts: { name: string; balance: number }[] };
  history: { date: string; netWorth: number }[];
}

// ---------- Shared Expenses ----------
export interface Household {
  id: string;
  name: string;
  members: HouseholdMember[];
  expenses?: SharedExpense[];
}

export interface HouseholdMember {
  id: string;
  name: string;
  userId?: string;
  role: string;
}

export interface SharedExpense {
  id: string;
  description: string;
  amount: number;
  date: string;
  splitType: string;
  paidById: string;
  shares: SharedExpenseShare[];
}

export interface SharedExpenseShare {
  id: string;
  memberId: string;
  amount: number;
  isSettled: boolean;
  member?: HouseholdMember;
}

// ---------- Cashflow ----------
export interface CashflowForecast {
  currentBalance: number;
  endOfMonthEstimate: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlyNet: number;
  recurring: { income: number; expenses: number };
  variable: { income: number; expenses: number };
  forecast: { month: string; label: string; projectedBalance: number; income: number; expenses: number; net: number }[];
  warnings: string[];
}

// ---------- Portfolio ----------
export interface PortfolioHolding {
  id: string;
  symbol: string;
  name: string;
  holdingType: string;
  quantity: number;
  avgBuyPrice: number;
  currentPrice: number;
  currency: string;
  exchange?: string;
  isin?: string;
  totalInvested: number;
  currentValue: number;
  profitLoss: number;
  profitLossPercent: number;
}

export interface CreateHoldingData {
  symbol: string;
  name: string;
  holdingType: string;
  quantity: number;
  avgBuyPrice: number;
  currentPrice: number;
  currency?: string;
  exchange?: string;
  isin?: string;
}

export interface PortfolioSummary {
  totalInvested: number;
  totalCurrentValue: number;
  totalProfitLoss: number;
  totalProfitLossPercent: number;
  holdingsCount: number;
  byType: { type: string; value: number; invested: number; items: number }[];
  holdings: PortfolioHolding[];
}
