import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole, UserPermission, CashierSession } from '../types';
import { sqliteService } from '../db/sqlite';
import { verifyPassword, hashPassword, DEFAULT_SALT } from '../utils/security';
import { sendOtp, verifyOtp } from '../utils/otpClient';

export interface PendingOtpSession {
  tempToken: string; // signed token issued by the server; the code itself is only ever in the SMS
  user: User;
  contactInfo: string; // masked phone number, safe to display
  expiresAt: number;
}

export interface RequestLoginResult {
  requireOtp: boolean;
  success?: boolean;
  tempToken?: string;
  contactInfo?: string;
  error?: string;
}

interface AuthContextType {
  currentUser: User | null;
  currentRole: UserRole | null;
  users: User[];
  roles: UserRole[];
  isLoading: boolean;
  loginError: string | null;
  isAdmin: boolean;
  isCashier: boolean;
  isPrimaryAdmin: boolean;
  activeCashierSession: CashierSession | null;
  pendingOtp: PendingOtpSession | null;
  login: (username: string, password: string) => Promise<boolean>;
  requestLogin: (identifier: string, password: string) => Promise<RequestLoginResult>;
  verifyCashierOtp: (tempToken: string, otpCode: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  switchUser: (userId: string) => void;
  switchUserWithPassword: (userId: string, password: string) => Promise<{ success: boolean; error?: string }>;
  hasPermission: (permission: UserPermission) => boolean;
  refreshUsers: () => void;
  refreshActiveSession: () => void;
  createUser: (userData: {
    username: string;
    full_name: string;
    email: string;
    phone: string;
    password: string;
    role_id: string;
  }) => Promise<void>;
  updateUserRole: (userId: string, roleId: string) => void;
  toggleUserActive: (userId: string, isActive: boolean) => void;
  resetUserPassword: (userId: string, newPass: string) => Promise<void>;
  deleteUser: (userId: string) => void;
  openSession: (openingCash: number, notes?: string) => CashierSession;
  closeSession: (actualCash: number, closingNotes?: string) => CashierSession | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [pendingOtp, setPendingOtp] = useState<PendingOtpSession | null>(null);
  const [activeCashierSession, setActiveCashierSession] = useState<CashierSession | null>(null);

  const loadData = () => {
    try {
      const uList = sqliteService.getUsers();
      const rList = sqliteService.getUserRoles();
      setUsers(uList);
      setRoles(rList);

      // Check session storage for existing login
      const savedUserId = sessionStorage.getItem('pekasa_logged_user_id');
      if (savedUserId) {
        const found = uList.find((u) => u.id === savedUserId);
        if (found) {
          if (found.is_active === false || (found as any).is_active === 0) {
            // Deactivated user kicked out
            setCurrentUser(null);
            sessionStorage.removeItem('pekasa_logged_user_id');
          } else {
            setCurrentUser(found);
            const activeSes = sqliteService.getCurrentCashierSession(found.id);
            setActiveCashierSession(activeSes);
          }
        }
      }
    } catch (e) {
      console.error('Failed to load users from SQLite:', e);
    }
  };

  const refreshActiveSession = () => {
    if (currentUser) {
      const activeSes = sqliteService.getCurrentCashierSession(currentUser.id);
      setActiveCashierSession(activeSes);
    } else {
      setActiveCashierSession(null);
    }
  };

  useEffect(() => {
    sqliteService.initialize().then(() => {
      loadData();
      setIsLoading(false);
    });

    const unsubscribe = sqliteService.subscribe(() => {
      loadData();
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    refreshActiveSession();
  }, [currentUser]);

  const isAdmin = currentUser?.role_id === 'role-admin' || currentUser?.username === 'trevor' || currentUser?.username === 'peter';
  const isCashier = currentUser?.role_id === 'role-cashier';
  const isPrimaryAdmin = currentUser?.username === 'trevor' || currentUser?.username === 'peter';

  // Request login: handles OTP trigger for Cashiers vs direct entry for Admins
  const requestLogin = async (identifier: string, pass: string): Promise<RequestLoginResult> => {
    setLoginError(null);
    const uList = sqliteService.getUsers();
    const cleanId = identifier.trim().toLowerCase();
    const user = uList.find(
      (u) =>
        u.username.toLowerCase() === cleanId ||
        u.email.toLowerCase() === cleanId ||
        u.phone.replace(/[\s+-]/g, '').includes(cleanId.replace(/[\s+-]/g, ''))
    );

    if (!user) {
      const msg = 'Invalid username, phone or email. Only authorized staff and partners have access.';
      setLoginError(msg);
      return { requireOtp: false, error: msg };
    }

    if (user.is_active === false || (user as any).is_active === 0) {
      const msg = 'This Cashier account has been deactivated by Admin. Please contact Trevor or Peter.';
      setLoginError(msg);
      return { requireOtp: false, error: msg };
    }

    const isValid = await verifyPassword(pass, user.password_hash, user.salt || DEFAULT_SALT);
    if (!isValid) {
      const msg = 'Incorrect password. Access denied.';
      setLoginError(msg);
      return { requireOtp: false, error: msg };
    }

    // If Cashier: Generate OTP and require verification
    const userIsCashier = user.role_id === 'role-cashier' && user.username !== 'trevor' && user.username !== 'peter';

    if (userIsCashier) {
      // The server generates the 6-digit code and texts it to the cashier's phone number.
      const sent = await sendOtp(user.id, user.phone, user.full_name);
      if (!sent.ok || !sent.token) {
        const msg = sent.error || 'Could not send the verification code. Please try again.';
        setLoginError(msg);
        return { requireOtp: false, error: msg };
      }

      const contact = sent.maskedPhone || 'your phone';
      setPendingOtp({
        tempToken: sent.token,
        user,
        contactInfo: contact,
        expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes (enforced by the server too)
      });

      sqliteService.logAudit(
        user.full_name,
        'OTP_DISPATCH',
        'USER',
        user.id,
        `6-digit counter login OTP sent by SMS to ${contact}`
      );

      return { requireOtp: true, tempToken: sent.token, contactInfo: contact };
    }

    // Admin direct sign-in (Trevor or Peter)
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
    sqliteService.run('UPDATE users SET last_login = :ll WHERE id = :id', {
      ':ll': nowStr,
      ':id': user.id
    });
    sqliteService.logAudit(user.full_name, 'LOGIN', 'USER', user.id, 'Administrator authorized terminal login');

    const updatedUser = { ...user, last_login: nowStr };
    setCurrentUser(updatedUser);
    sessionStorage.setItem('pekasa_logged_user_id', user.id);
    setPendingOtp(null);

    return { requireOtp: false, success: true };
  };

  // Verify Cashier OTP
  const verifyCashierOtp = async (tempToken: string, otpCode: string): Promise<{ success: boolean; error?: string }> => {
    if (!pendingOtp || pendingOtp.tempToken !== tempToken) {
      return { success: false, error: 'OTP session expired or invalid. Please sign in again.' };
    }

    if (Date.now() > pendingOtp.expiresAt) {
      setPendingOtp(null);
      return { success: false, error: 'OTP code expired. Please request a new verification code.' };
    }

    // The server checks the code against the signed token
    const result = await verifyOtp(tempToken, otpCode);
    if (!result.ok || result.userId !== pendingOtp.user.id) {
      return { success: false, error: result.error || 'Invalid OTP code. Please enter the 6-digit code received.' };
    }

    // OTP Verified! Log in the Cashier
    const user = pendingOtp.user;
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
    sqliteService.run('UPDATE users SET last_login = :ll WHERE id = :id', {
      ':ll': nowStr,
      ':id': user.id
    });
    sqliteService.logAudit(
      user.full_name,
      'OTP_VERIFIED_LOGIN',
      'USER',
      user.id,
      `Two-factor OTP verified successfully. Cashier logged in for counter duty.`
    );

    const updatedUser = { ...user, last_login: nowStr };
    setCurrentUser(updatedUser);
    sessionStorage.setItem('pekasa_logged_user_id', user.id);
    setPendingOtp(null);
    setLoginError(null);

    return { success: true };
  };

  // Legacy direct login fallback
  const login = async (identifier: string, pass: string): Promise<boolean> => {
    const res = await requestLogin(identifier, pass);
    if (!res.requireOtp && res.success) {
      return true;
    }
    // If it requires OTP, wait for OTP step
    return false;
  };

  const logout = () => {
    if (currentUser) {
      sqliteService.logAudit(currentUser.full_name, 'LOGOUT', 'USER', currentUser.id, 'Session ended');
    }
    setCurrentUser(null);
    setPendingOtp(null);
    sessionStorage.removeItem('pekasa_logged_user_id');
  };

  const switchUser = (userId: string) => {
    const found = users.find((u) => u.id === userId);
    if (found) {
      setCurrentUser(found);
      sessionStorage.setItem('pekasa_logged_user_id', found.id);
      sqliteService.logAudit(found.full_name, 'SWITCH_USER', 'USER', found.id, 'Operator switched counter duty');
    }
  };

  const switchUserWithPassword = async (userId: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const targetUser = users.find((u) => u.id === userId);
    if (!targetUser) {
      return { success: false, error: 'User account not found.' };
    }

    if (targetUser.is_active === false || (targetUser as any).is_active === 0) {
      return { success: false, error: 'This Cashier account has been deactivated by Admin.' };
    }

    const isValid = await verifyPassword(password, targetUser.password_hash, targetUser.salt || DEFAULT_SALT);
    if (!isValid) {
      return { 
        success: false, 
        error: `Incorrect password for ${targetUser.full_name}. Please try again.`
      };
    }

    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
    sqliteService.run('UPDATE users SET last_login = :ll WHERE id = :id', {
      ':ll': nowStr,
      ':id': targetUser.id
    });
    sqliteService.logAudit(
      targetUser.full_name,
      'SWITCH_USER_AUTH',
      'USER',
      targetUser.id,
      `Operator authenticated switch from ${currentUser?.full_name || 'Previous'} to ${targetUser.full_name}`
    );

    const updated = { ...targetUser, last_login: nowStr };
    setCurrentUser(updated);
    sessionStorage.setItem('pekasa_logged_user_id', targetUser.id);
    return { success: true };
  };

  const currentRole = roles.find((r) => r.id === currentUser?.role_id) || null;

  const hasPermission = (permission: UserPermission): boolean => {
    if (!currentUser) return false;
    if (isAdmin) return true; // Full admin has all permissions
    if (!currentRole) return false;
    return !!currentRole.permissions[permission];
  };

  // Only Trevor and Peter (or Admin) can create new cashier accounts
  const createUser = async (userData: {
    username: string;
    full_name: string;
    email: string;
    phone: string;
    password: string;
    role_id: string;
  }) => {
    const salt = DEFAULT_SALT;
    const passwordHash = await hashPassword(userData.password, salt);
    const role = roles.find((r) => r.id === userData.role_id);
    const roleTitle = role ? role.name : 'Counter Cashier';
    const id = 'usr-' + Date.now();
    const ca = new Date().toISOString().replace('T', ' ').substring(0, 19);

    sqliteService.run(
      'INSERT INTO users (id, username, full_name, email, phone, password_hash, salt, role_id, role_title, is_active, created_at) VALUES (:id, :un, :fn, :em, :ph, :phash, :salt, :rid, :rt, 1, :ca)',
      {
        ':id': id,
        ':un': userData.username.toLowerCase().trim(),
        ':fn': userData.full_name,
        ':em': userData.email,
        ':ph': userData.phone,
        ':phash': passwordHash,
        ':salt': salt,
        ':rid': userData.role_id,
        ':rt': roleTitle,
        ':ca': ca
      }
    );

    sqliteService.logAudit(
      currentUser?.full_name || 'Trevor Mbugua',
      'CREATE_CASHIER_ACCOUNT',
      'USER',
      id,
      `Created new authorized Cashier operator account: ${userData.username} (${userData.full_name}, ${userData.phone})`
    );
    loadData();
  };

  const updateUserRole = (userId: string, roleId: string) => {
    const role = roles.find((r) => r.id === roleId);
    if (!role) return;

    sqliteService.run('UPDATE users SET role_id = :rid, role_title = :rt WHERE id = :id', {
      ':rid': roleId,
      ':rt': role.name,
      ':id': userId
    });

    sqliteService.logAudit(currentUser?.full_name || 'Admin', 'UPDATE_ROLE', 'USER', userId, `Changed role to ${role.name}`);
    loadData();
  };

  const toggleUserActive = (userId: string, isActive: boolean) => {
    sqliteService.toggleUserActive(userId, isActive, currentUser?.full_name || 'Admin');
    loadData();
  };

  const resetUserPassword = async (userId: string, newPass: string) => {
    await sqliteService.resetUserPassword(userId, newPass, currentUser?.full_name || 'Admin');
    loadData();
  };

  const deleteUser = (userId: string) => {
    sqliteService.deleteUser(userId, currentUser?.full_name || 'Admin');
    loadData();
  };

  const openSession = (openingCash: number, notes?: string): CashierSession => {
    if (!currentUser) throw new Error('Must be logged in to open a session');
    const ses = sqliteService.openCashierSession(
      currentUser.id,
      currentUser.full_name,
      currentUser.branch_id || 'br-nairobi',
      openingCash,
      notes
    );
    setActiveCashierSession(ses);
    return ses;
  };

  const closeSession = (actualCash: number, closingNotes?: string): CashierSession | null => {
    if (!activeCashierSession) return null;
    const res = sqliteService.closeCashierSession(activeCashierSession.id, actualCash, closingNotes);
    setActiveCashierSession(null);
    return res;
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        currentRole,
        users,
        roles,
        isLoading,
        loginError,
        isAdmin,
        isCashier,
        isPrimaryAdmin,
        activeCashierSession,
        pendingOtp,
        login,
        requestLogin,
        verifyCashierOtp,
        logout,
        switchUser,
        switchUserWithPassword,
        hasPermission,
        refreshUsers: loadData,
        refreshActiveSession,
        createUser,
        updateUserRole,
        toggleUserActive,
        resetUserPassword,
        deleteUser,
        openSession,
        closeSession
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
