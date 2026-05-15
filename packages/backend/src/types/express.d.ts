declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
      twoFactorEnabled: boolean;
      isActive: boolean;
    }
  }
}

export {};
