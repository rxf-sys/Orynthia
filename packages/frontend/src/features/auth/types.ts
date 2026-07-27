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
