export type UserRole =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "SCANNER"
  | "TEACHER"
  | "STAFF"
  | "PARENT";

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  roles: UserRole[];
  primaryRole: UserRole;
  schoolId: string | null;
  isActive: boolean;
}
