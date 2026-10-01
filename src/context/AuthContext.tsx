import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole, UserPermission } from '../types';
import { sqliteService } from '../db/sqlite';
import { verifyPassword, hashPassword, DEFAULT_SALT } from '../utils/security';

interface AuthContextType {
  currentUser: User | null;
  currentRole: UserRole | null;
  users: User[];
  roles: UserRole[];
  isLoading: boolean;
  loginError: string | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  switchUser: (userId: string) => void;
  switchUserWithPassword: (userId: string, password: string) => Promise<{ success: boolean; error?: string }>;
  hasPermission: (permission: UserPermission) => boolean;
  refreshUsers: () => void;
  createUser: (userData: {
    username: string;
    full_name: string;
    email: string;
    phone: string;
    password: string;
    role_id: string;
  }) => Promise<void>;
  updateUserRole: (userId: string, roleId: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loginError, setLoginError] = useState<string | null>(null);

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
          setCurrentUser(found);
        }
      }
    } catch (e) {
      console.error('Failed to load users from SQLite:', e);
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

  const login = async (username: string, password: string): Promise<boolean> => {
    setLoginError(null);
    const uList = sqliteService.getUsers();
    const user = uList.find((u) => u.username.toLowerCase() === username.trim().toLowerCase());

    if (!user) {
      setLoginError('Invalid username. Only registered authorized operators have access.');
      return false;
    }

    const isValid = await verifyPassword(password, user.password_hash, user.salt || DEFAULT_SALT);
    if (!isValid) {
      setLoginError('Incorrect password. Access denied.');
      return false;
    }

    // Update last login in SQLite
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
    sqliteService.run('UPDATE users SET last_login = :ll WHERE id = :id', {
      ':ll': nowStr,
      ':id': user.id
    });
    sqliteService.logAudit(user.full_name, 'LOGIN', 'USER', user.id, 'Successful login into PEKASA terminal');

    const updatedUser = { ...user, last_login: nowStr };
    setCurrentUser(updatedUser);
    sessionStorage.setItem('pekasa_logged_user_id', user.id);
    return true;
  };

  const logout = () => {
    if (currentUser) {
      sqliteService.logAudit(currentUser.full_name, 'LOGOUT', 'USER', currentUser.id, 'Session ended');
    }
    setCurrentUser(null);
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

    const isValid = await verifyPassword(password, targetUser.password_hash, targetUser.salt || DEFAULT_SALT);
    if (!isValid) {
      return { 
        success: false, 
        error: `Incorrect password for ${targetUser.full_name}. Please input the recommended password.` 
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
    if (!currentRole) return false;
    return !!currentRole.permissions[permission];
  };

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
    const roleTitle = role ? role.name : 'Staff';
    const id = 'usr-' + Date.now();
    const ca = new Date().toISOString().replace('T', ' ').substring(0, 19);

    sqliteService.run(
      'INSERT INTO users (id, username, full_name, email, phone, password_hash, salt, role_id, role_title, created_at) VALUES (:id, :un, :fn, :em, :ph, :phash, :salt, :rid, :rt, :ca)',
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

    sqliteService.logAudit(currentUser?.full_name || 'Admin', 'CREATE_USER', 'USER', id, `Created new user account: ${userData.username}`);
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

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        currentRole,
        users,
        roles,
        isLoading,
        loginError,
        login,
        logout,
        switchUser,
        switchUserWithPassword,
        hasPermission,
        refreshUsers: loadData,
        createUser,
        updateUserRole
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
