import React, { useState } from 'react';
import { sqliteService } from '../db/sqlite';
import { User, UserRole, Expense, Supplier, PaymentMethod, CashierSession, PaymentVoidRequest, AuditLog } from '../types';
import { formatKES } from '../utils/numbering';
import { cleanKenyanPhone } from '../utils/messaging';
import { useAuth } from '../context/AuthContext';
import { 
  Users, 
  DollarSign, 
  TrendingUp, 
  Wrench, 
  Truck, 
  Network, 
  ShieldCheck, 
  Plus, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle,
  Receipt, 
  PieChart, 
  Layers, 
  FileText,
  X,
  Lock,
  Unlock,
  KeyRound,
  Trash2,
  Power,
  RotateCcw,
  Check,
  Ban,
  Clock,
  Coins
} from 'lucide-react';

export const PartnersView: React.FC = () => {
  const { 
    currentUser, 
    users, 
    roles, 
    createUser, 
    updateUserRole, 
    toggleUserActive, 
    resetUserPassword, 
    deleteUser,
    isPrimaryAdmin 
  } = useAuth();

  const appliances = sqliteService.getAppliances();
  const payments = sqliteService.getPayments();
  const expenses = sqliteService.getExpenses();
  const suppliers = sqliteService.getSuppliers();
  const auditLogs = sqliteService.getAuditLogs();
  const sessions = sqliteService.getCashierSessions();
  const voidRequests = sqliteService.getPaymentVoidRequests();

  const [activeSubTab, setActiveSubTab] = useState<
    'financials' | 'cashiers' | 'sessions' | 'voids' | 'expenses' | 'technicians' | 'suppliers' | 'audit' | 'network'
  >('cashiers');

  // New Expense Form State
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [expenseCategory, setExpenseCategory] = useState('Electricity/Tokens');
  const [expenseAmount, setExpenseAmount] = useState<number>(3000);
  const [expensePaidBy, setExpensePaidBy] = useState<'Trevor' | 'Peter' | 'Shop Petty Cash'>('Trevor');
  const [expenseMethod, setExpenseMethod] = useState<PaymentMethod>('M-Pesa');
  const [expenseRef, setExpenseRef] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [expenseNotes, setExpenseNotes] = useState('');

  // New Supplier Form State
  const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false);
  const [supplierName, setSupplierName] = useState('');
  const [supplierContact, setSupplierContact] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('+254 ');
  const [supplierEmail, setSupplierEmail] = useState('');
  const [supplierAddress, setSupplierAddress] = useState('');
  const [supplierCategory, setSupplierCategory] = useState('');
  const [supplierTerms, setSupplierTerms] = useState('Cash on Delivery');

  // New Cashier / Staff Form State
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newStaffUsername, setNewStaffUsername] = useState('');
  const [newStaffFullName, setNewStaffFullName] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffPhone, setNewStaffPhone] = useState('+254 7');
  const [newStaffPassword, setNewStaffPassword] = useState('');
  const [newStaffRoleId, setNewStaffRoleId] = useState('role-cashier');

  // Password reset modal state
  const [resetModalUser, setResetModalUser] = useState<User | null>(null);
  const [newResetPassword, setNewResetPassword] = useState('');

  // Check if authorized creator (Trevor or Peter)
  const isAuthorizedAdmin = isPrimaryAdmin || currentUser?.role_id === 'role-admin';

  // --- Financial Computations ---
  const trevorDisbursed = appliances
    .filter((a) => a.funder === 'Trevor')
    .reduce((acc, a) => acc + (Number(a.amount_received) || 0), 0);

  const peterDisbursed = appliances
    .filter((a) => a.funder === 'Peter')
    .reduce((acc, a) => acc + (Number(a.amount_received) || 0), 0);

  const trevorCollections = payments
    .filter((p) => p.received_by === 'Trevor')
    .reduce((acc, p) => acc + (Number(p.amount) || 0), 0);

  const peterCollections = payments
    .filter((p) => p.received_by === 'Peter')
    .reduce((acc, p) => acc + (Number(p.amount) || 0), 0);

  const totalRevenue = payments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
  const totalExpenses = expenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
  const netShopProfit = totalRevenue - totalExpenses;

  // Technician Performance Computations
  const technicianStats: Record<string, { total: number; completed: number; revenue: number }> = {};
  appliances.forEach((a) => {
    const tech = a.technician_name || 'Unassigned';
    if (!technicianStats[tech]) {
      technicianStats[tech] = { total: 0, completed: 0, revenue: 0 };
    }
    technicianStats[tech].total += 1;
    if (a.status === 'Ready for Collection' || a.status === 'Redeemed') {
      technicianStats[tech].completed += 1;
    }
    technicianStats[tech].revenue += Number(a.interest_charges) || 0;
  });

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const id = 'exp-' + Date.now();
    const expCode = sqliteService.getNextSequence('EXP');
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);

    try {
      sqliteService.run(
        `INSERT INTO operating_expenses (
          id, expense_number, branch_id, category, description, amount,
          payment_method, paid_by, reference_code, approved_by, expense_date, created_at
        ) VALUES (
          :id, :num, :bid, :cat, :desc, :amt,
          :pm, :pb, :ref, :ab, :ed, :ca
        )`,
        {
          ':id': id,
          ':num': expCode,
          ':bid': 'br-nairobi',
          ':cat': expenseCategory,
          ':desc': expenseNotes || expenseCategory,
          ':amt': Number(expenseAmount),
          ':pm': expenseMethod,
          ':pb': expensePaidBy,
          ':ref': expenseRef || null,
          ':ab': currentUser?.full_name || 'Admin',
          ':ed': expenseDate,
          ':ca': nowStr
        }
      );

      sqliteService.logAudit(currentUser?.full_name || 'Admin', 'RECORD_EXPENSE', 'EXPENSE', id, `Logged ${expenseCategory} of KES ${expenseAmount}`);
      setIsAddExpenseOpen(false);
      setExpenseNotes('');
      setExpenseRef('');
    } catch (err: any) {
      alert('Error creating expense: ' + err.message);
    }
  };

  const handleAddSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    const id = 'sup-' + Date.now();
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);

    try {
      sqliteService.run(
        `INSERT INTO suppliers (id, name, contact_person, phone, email, address, created_at)
         VALUES (:id, :name, :contact, :phone, :email, :address, :ca)`,
        {
          ':id': id,
          ':name': supplierName,
          ':contact': supplierContact,
          ':phone': supplierPhone,
          ':email': supplierEmail,
          ':address': supplierAddress,
          ':ca': nowStr
        }
      );

      sqliteService.logAudit(currentUser?.full_name || 'Admin', 'ADD_SUPPLIER', 'SUPPLIER', id, `Added supplier ${supplierName}`);
      setIsAddSupplierOpen(false);
      setSupplierName('');
      setSupplierContact('');
      setSupplierPhone('+254 ');
    } catch (err: any) {
      alert('Error creating supplier: ' + err.message);
    }
  };

  const handleCreateCashierUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthorizedAdmin) {
      alert('Unauthorized: Only Trevor Mbugua or Peter Kamau can create new cashier accounts.');
      return;
    }
    if (!newStaffUsername || !newStaffFullName || !newStaffPassword) {
      alert('Please fill in username, full name, and password.');
      return;
    }
    // The sign-in OTP is texted to this number, so it must be a valid Kenyan mobile (07xx / 01xx / +254...)
    if (!/^254[17]\d{8}$/.test(cleanKenyanPhone(newStaffPhone))) {
      alert('Please enter a valid Kenyan mobile number for the cashier (e.g. 0712 345 678 or +254 712 345 678). The sign-in code is sent to it by SMS.');
      return;
    }

    try {
      await createUser({
        username: newStaffUsername,
        full_name: newStaffFullName,
        email: newStaffEmail,
        phone: newStaffPhone,
        password: newStaffPassword,
        role_id: newStaffRoleId
      });
      setIsAddUserOpen(false);
      setNewStaffUsername('');
      setNewStaffFullName('');
      setNewStaffPassword('');
      setNewStaffEmail('');
      setNewStaffPhone('+254 7');
      alert(`Cashier account successfully provisioned by ${currentUser?.full_name || 'Admin'}. When the cashier signs in with their password, a 6-digit code is sent by SMS to ${newStaffPhone.trim()}.`);
    } catch (err: any) {
      alert('Error creating cashier account: ' + err.message);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetModalUser || !newResetPassword) return;

    try {
      await resetUserPassword(resetModalUser.id, newResetPassword);
      alert(`Password successfully updated for ${resetModalUser.full_name}`);
      setResetModalUser(null);
      setNewResetPassword('');
    } catch (err: any) {
      alert('Failed to reset password: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="pb-2 border-b border-slate-800">
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <span>Admin & Partners Control Hub</span>
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Senior Partners <strong>Trevor Mbugua</strong> & <strong>Peter Kamau</strong> management portal: Cashier accounts, OTP authorizations, daily session reconciliation, void approvals, and financials.
        </p>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-800 pb-2 text-xs">
        {[
          { id: 'cashiers', label: 'Cashier Accounts & Roles', icon: Users, badge: users.filter(u => u.role_id === 'role-cashier').length },
          { id: 'sessions', label: 'Cashier Sessions & Reconciliations', icon: Coins, badge: sessions.filter(s => s.reconciliation_status === 'PENDING_APPROVAL').length },
          { id: 'voids', label: 'Void & Correction Requests', icon: AlertTriangle, badge: voidRequests.filter(v => v.status === 'PENDING').length },
          { id: 'financials', label: 'Partner Capital & P&L', icon: DollarSign },
          { id: 'expenses', label: 'Shop Operating Expenses', icon: Receipt },
          { id: 'technicians', label: 'Technicians', icon: Wrench },
          { id: 'suppliers', label: 'Suppliers Directory', icon: Truck },
          { id: 'audit', label: 'Audit Trail & Login History', icon: Clock },
          { id: 'network', label: 'Multi-Computer LAN Setup', icon: Network }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`py-2 px-3.5 rounded-lg font-bold flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              {typeof tab.badge === 'number' && tab.badge > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                  isActive ? 'bg-slate-950 text-amber-400' : 'bg-amber-500/20 text-amber-400'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* SUB-TAB 1: CASHIER ACCOUNTS & DUTIES */}
      {activeSubTab === 'cashiers' && (
        <div className="space-y-6">
          {/* Authorization Notice */}
          <div className="p-4 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 rounded-xl flex items-start gap-3 text-xs text-slate-300">
            <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-amber-300 block">
                Exclusive Senior Partner Authority (Trevor Mbugua & Peter Kamau)
              </span>
              <p className="leading-relaxed text-[11px] text-slate-300">
                Only Senior Partners <strong>Trevor Mbugua</strong> and <strong>Peter Kamau</strong> have system rights to
                provision new Cashier accounts, disable or activate cashier terminals, and reset passwords.
                When a cashier signs in, an OTP verification code is dispatched to their contact info before counter terminal access is granted.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Staff & Cashier Accounts Directory ({users.length})
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Active cashiers receive simplified cashier dashboards with OTP protection and daily drawer session reconciliation.
              </p>
            </div>

            <button
              onClick={() => setIsAddUserOpen(true)}
              disabled={!isAuthorizedAdmin}
              className={`px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-md ${
                !isAuthorizedAdmin ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              title={!isAuthorizedAdmin ? 'Only Trevor or Peter can create cashiers' : undefined}
            >
              <Plus className="w-4 h-4" />
              <span>Create New Cashier Account</span>
            </button>
          </div>

          {/* Users Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase text-[11px] font-semibold bg-slate-950/40">
                    <th className="py-3 px-4">Operator Name</th>
                    <th className="py-3 px-4">Login Username</th>
                    <th className="py-3 px-4">Contact Phone / Email</th>
                    <th className="py-3 px-4">Assigned Role</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Last Activity</th>
                    <th className="py-3 px-4 text-right">Admin Controls</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {users.map((u) => {
                    const isDirector = u.username === 'trevor' || u.username === 'peter';
                    const isActive = u.is_active !== false && (u as any).is_active !== 0;

                    return (
                      <tr key={u.id} className="hover:bg-slate-800/40">
                        <td className="py-3 px-4 font-bold text-white whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span>{u.full_name}</span>
                            {isDirector && (
                              <span className="text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.2 rounded font-bold">
                                Director
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-amber-400 whitespace-nowrap">{u.username}</td>
                        <td className="py-3 px-4 font-mono text-slate-400 whitespace-nowrap">
                          <div>{u.phone}</div>
                          {u.email && <div className="text-[10px] text-slate-500">{u.email}</div>}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className={`inline-block px-2.5 py-0.5 rounded text-[11px] font-semibold ${
                            u.role_id === 'role-admin'
                              ? 'bg-amber-950 text-amber-400 border border-amber-800/50'
                              : 'bg-slate-800 text-slate-200 border border-slate-700'
                          }`}>
                            {u.role_title}
                          </span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {isActive ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded font-medium">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Active</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] text-rose-400 bg-rose-950/40 border border-rose-800/40 px-2 py-0.5 rounded font-medium">
                              <Ban className="w-3 h-3" />
                              <span>Disabled</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-400 whitespace-nowrap text-[11px]">
                          {u.last_login || 'Never'}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap space-x-1.5">
                          {isDirector ? (
                            <span className="text-[11px] text-slate-500 italic">Protected Partner</span>
                          ) : (
                            <>
                              {/* Toggle Active / Disabled */}
                              <button
                                onClick={() => toggleUserActive(u.id, !isActive)}
                                className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                                  isActive
                                    ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                    : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                }`}
                              >
                                {isActive ? 'Disable' : 'Activate'}
                              </button>

                              {/* Reset Password */}
                              <button
                                onClick={() => {
                                  setResetModalUser(u);
                                  setNewResetPassword('');
                                }}
                                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] font-semibold border border-slate-700 cursor-pointer"
                              >
                                Reset Pass
                              </button>

                              {/* Delete Account */}
                              <button
                                onClick={() => {
                                  if (confirm(`Are you sure you want to permanently delete cashier account for ${u.full_name}?`)) {
                                    deleteUser(u.id);
                                  }
                                }}
                                className="px-2 py-1 bg-rose-900/30 hover:bg-rose-900/50 text-rose-400 rounded text-[11px] border border-rose-800/40 cursor-pointer"
                                title="Delete cashier account"
                              >
                                <Trash2 className="w-3 h-3 inline" />
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Role Permissions Matrix */}
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              System Roles & Boundary Enforcement Matrix
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 bg-slate-950/70 border border-amber-500/30 rounded-xl space-y-2">
                <div className="font-bold text-amber-400 text-sm flex items-center justify-between">
                  <span>1. ADMIN (Senior Partner / Director)</span>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded">Full Authority</span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Full control over entire store: create and manage cashiers, interest rates, loan approvals,
                  collateral sales, operating expenses, financial statements, database backups and restore.
                </p>
                <div className="pt-2 text-[11px] text-slate-400">
                  Exclusive Administrators: <strong className="text-white">Trevor Mbugua</strong> & <strong className="text-white">Peter Kamau</strong>
                </div>
              </div>

              <div className="p-4 bg-slate-950/70 border border-cyan-500/30 rounded-xl space-y-2">
                <div className="font-bold text-cyan-400 text-sm flex items-center justify-between">
                  <span>2. CASHIER (Counter Terminal Operator)</span>
                  <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded">Protected Duty</span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Simplified cashier interface: Customer search & registration, loan creation, payment receipts,
                  collateral photos, and daily cash drawer reconciliation. 
                  Cannot delete customers, cannot change interest rates, cannot silently delete payments.
                </p>
                <div className="pt-2 text-[11px] text-slate-400">
                  Security: Protected with mandatory <strong>6-digit OTP code verification</strong> upon login.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: CASHIER SESSIONS & RECONCILIATIONS */}
      {activeSubTab === 'sessions' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Daily Cashier Sessions & Drawer Reconciliations ({sessions.length})
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Review cash shortages and overages calculated by the system. Admin can verify and approve reconciliations.
              </p>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase text-[11px] font-semibold bg-slate-950/40">
                    <th className="py-3 px-4">Date / Shift</th>
                    <th className="py-3 px-4">Cashier Name</th>
                    <th className="py-3 px-4 text-right">Opening Float</th>
                    <th className="py-3 px-4 text-right">Cash Collected</th>
                    <th className="py-3 px-4 text-right">Expected Drawer Cash</th>
                    <th className="py-3 px-4 text-right">Actual Count</th>
                    <th className="py-3 px-4 text-right">Difference</th>
                    <th className="py-3 px-4">Reconciliation Status</th>
                    <th className="py-3 px-4 text-right">Admin Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {sessions.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-500">
                        No cashier drawer sessions recorded yet.
                      </td>
                    </tr>
                  ) : (
                    sessions.map((s) => {
                      const diff = s.difference || 0;
                      const isPending = s.reconciliation_status === 'PENDING_APPROVAL' || s.reconciliation_status === 'DISCREPANCY_FLAGGED';

                      return (
                        <tr key={s.id} className="hover:bg-slate-800/40">
                          <td className="py-3 px-4 font-mono text-slate-400 whitespace-nowrap">
                            <div>{s.session_date}</div>
                            <div className="text-[10px] text-slate-500">{s.opened_at.split(' ')[1]} - {s.closed_at ? s.closed_at.split(' ')[1] : 'OPEN'}</div>
                          </td>
                          <td className="py-3 px-4 font-bold text-white whitespace-nowrap">{s.cashier_name}</td>
                          <td className="py-3 px-4 text-right font-mono font-medium text-slate-300 whitespace-nowrap">
                            {formatKES(s.opening_cash)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400 whitespace-nowrap">
                            +{formatKES(s.cash_collected)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-[#FFD700] whitespace-nowrap">
                            {formatKES(s.expected_cash)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-white whitespace-nowrap">
                            {s.actual_cash !== null && s.actual_cash !== undefined ? formatKES(s.actual_cash) : <span className="text-slate-500 italic">Open Shift</span>}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold whitespace-nowrap">
                            {s.actual_cash !== null && s.actual_cash !== undefined ? (
                              diff === 0 ? (
                                <span className="text-emerald-400">KSh 0.00</span>
                              ) : diff < 0 ? (
                                <span className="text-rose-400">-KSh {Math.abs(diff).toLocaleString()}</span>
                              ) : (
                                <span className="text-amber-400">+KSh {diff.toLocaleString()}</span>
                              )
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            {s.status === 'OPEN' ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800/50">
                                Shift Open
                              </span>
                            ) : s.reconciliation_status === 'APPROVED' ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-emerald-400 border border-slate-700 flex items-center gap-1 w-fit">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Approved</span>
                              </span>
                            ) : diff !== 0 ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800/50 flex items-center gap-1 w-fit">
                                <AlertTriangle className="w-3 h-3" />
                                <span>Discrepancy Flagged</span>
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800/50">
                                Pending Approval
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            {s.status === 'CLOSED' && isPending && (
                              <button
                                onClick={() => {
                                  const notes = prompt(`Approve drawer reconciliation for ${s.cashier_name}? Add optional audit notes:`, `Reconciliation approved by ${currentUser?.full_name || 'Admin'}`);
                                  if (notes !== null) {
                                    sqliteService.approveCashierSessionReconciliation(s.id, currentUser?.full_name || 'Admin', notes);
                                    alert('Reconciliation approved and recorded in audit ledger.');
                                  }
                                }}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-[11px] cursor-pointer"
                              >
                                Approve
                              </button>
                            )}
                            {s.reconciliation_status === 'APPROVED' && (
                              <span className="text-[10px] text-slate-500 font-mono">
                                By {s.reconciliation_approved_by || 'Admin'}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: PAYMENT VOID / CORRECTION REQUESTS */}
      {activeSubTab === 'voids' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Payment Void & Correction Requests ({voidRequests.length})
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Cashiers cannot silently delete transaction receipts. Review submitted void requests below to approve or decline.
              </p>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase text-[11px] font-semibold bg-slate-950/40">
                    <th className="py-3 px-4">Request #</th>
                    <th className="py-3 px-4">Receipt #</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4 text-right">Amount (KES)</th>
                    <th className="py-3 px-4">Requested By</th>
                    <th className="py-3 px-4">Reason for Correction</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Admin Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {voidRequests.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500">
                        No payment void or correction requests pending.
                      </td>
                    </tr>
                  ) : (
                    voidRequests.map((vr) => (
                      <tr key={vr.id} className="hover:bg-slate-800/40">
                        <td className="py-3 px-4 font-mono font-bold text-amber-400 whitespace-nowrap">{vr.request_number}</td>
                        <td className="py-3 px-4 font-mono text-white whitespace-nowrap">{vr.receipt_number}</td>
                        <td className="py-3 px-4 font-medium text-slate-200 whitespace-nowrap">{vr.customer_name}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-rose-400 whitespace-nowrap">
                          {formatKES(vr.amount)}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">{vr.cashier_name}</td>
                        <td className="py-3 px-4 text-slate-300 max-w-xs">{vr.reason}</td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            vr.status === 'PENDING'
                              ? 'bg-amber-950 text-amber-300 border border-amber-800/50'
                              : vr.status === 'APPROVED'
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/50'
                                : 'bg-rose-950 text-rose-400 border border-rose-800/50'
                          }`}>
                            {vr.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap space-x-1.5">
                          {vr.status === 'PENDING' ? (
                            <>
                              <button
                                onClick={() => {
                                  if (confirm(`Approve void for receipt ${vr.receipt_number} of KSh ${vr.amount}? This will remove the receipt from active ledger.`)) {
                                    sqliteService.approvePaymentVoidRequest(vr.id, currentUser?.full_name || 'Admin');
                                    alert('Payment voided and removed from ledger.');
                                  }
                                }}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-[11px] cursor-pointer"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => {
                                  const reason = prompt('Decline reason:', 'Incorrect request');
                                  if (reason) {
                                    sqliteService.rejectPaymentVoidRequest(vr.id, currentUser?.full_name || 'Admin', reason);
                                  }
                                }}
                                className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded text-[11px] cursor-pointer"
                              >
                                Decline
                              </button>
                            </>
                          ) : (
                            <span className="text-[10px] text-slate-500 font-mono">
                              Reviewed by {vr.reviewed_by || 'Admin'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: FINANCIALS & P&L */}
      {activeSubTab === 'financials' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
              <span className="text-xs font-semibold text-slate-400">Total Capital Deployed</span>
              <div className="text-2xl font-black font-mono text-[#FFD700]">
                {formatKES(trevorDisbursed + peterDisbursed)}
              </div>
              <div className="text-xs text-slate-400 flex justify-between pt-2 border-t border-slate-800">
                <span>Trevor: {formatKES(trevorDisbursed)}</span>
                <span>Peter: {formatKES(peterDisbursed)}</span>
              </div>
            </div>

            <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
              <span className="text-xs font-semibold text-slate-400">Total Collections</span>
              <div className="text-2xl font-black font-mono text-emerald-400">
                {formatKES(totalRevenue)}
              </div>
              <div className="text-xs text-slate-400 flex justify-between pt-2 border-t border-slate-800">
                <span>Trevor: {formatKES(trevorCollections)}</span>
                <span>Peter: {formatKES(peterCollections)}</span>
              </div>
            </div>

            <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
              <span className="text-xs font-semibold text-slate-400">Net Retained Profit</span>
              <div className={`text-2xl font-black font-mono ${netShopProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {formatKES(netShopProfit)}
              </div>
              <div className="text-xs text-slate-400 flex justify-between pt-2 border-t border-slate-800">
                <span>Total Expenses: {formatKES(totalExpenses)}</span>
                <span>Split: 50% / 50%</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 5: EXPENSES */}
      {activeSubTab === 'expenses' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Shop Operating Expense Records ({expenses.length})
            </h3>
            <button
              onClick={() => setIsAddExpenseOpen(true)}
              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Record Expense</span>
            </button>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase text-[11px] font-semibold bg-slate-950/40">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4 text-right">Amount (KES)</th>
                    <th className="py-3 px-4">Paid By</th>
                    <th className="py-3 px-4">Method</th>
                    <th className="py-3 px-4">Ref Code</th>
                    <th className="py-3 px-4">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {expenses.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        No expenses logged.
                      </td>
                    </tr>
                  ) : (
                    expenses.map((e) => (
                      <tr key={e.id} className="hover:bg-slate-800/40">
                        <td className="py-3 px-4 font-mono text-slate-400 whitespace-nowrap">{e.expense_date}</td>
                        <td className="py-3 px-4 font-semibold text-white whitespace-nowrap">{e.category}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-rose-400 whitespace-nowrap">
                          {formatKES(e.amount)}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap font-mono text-amber-300">{e.paid_by}</td>
                        <td className="py-3 px-4 whitespace-nowrap">{e.payment_method}</td>
                        <td className="py-3 px-4 font-mono text-slate-400 whitespace-nowrap">{e.reference_code || '-'}</td>
                        <td className="py-3 px-4 text-slate-300">{e.notes || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 6: TECHNICIANS */}
      {activeSubTab === 'technicians' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Technician Repairs & Custody Throughput
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(technicianStats).map(([tech, stat]) => (
              <div key={tech} className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-sm">{tech}</span>
                  <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded">
                    Active
                  </span>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Appliances Handled:</span>
                    <span className="font-bold text-white font-mono">{stat.total}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Repairs Completed:</span>
                    <span className="font-bold text-emerald-400 font-mono">{stat.completed}</span>
                  </div>
                  <div className="flex justify-between text-slate-400 pt-1 border-t border-slate-800">
                    <span>Service Revenue:</span>
                    <span className="font-bold text-amber-400 font-mono">{formatKES(stat.revenue)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-TAB 7: SUPPLIERS */}
      {activeSubTab === 'suppliers' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Parts & Equipment Suppliers Directory ({suppliers.length})
            </h3>
            <button
              onClick={() => setIsAddSupplierOpen(true)}
              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Supplier</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {suppliers.map((s) => (
              <div key={s.id} className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2 text-xs">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <h4 className="font-bold text-white text-sm">{s.name}</h4>
                  <span className="text-[10px] text-amber-400 font-mono bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                    Supplier
                  </span>
                </div>
                <div className="space-y-1 text-slate-300">
                  <div>
                    <span className="text-slate-400">Contact Person:</span> {s.contact_person || 'N/A'}
                  </div>
                  <div>
                    <span className="text-slate-400">Phone:</span> <span className="font-mono text-amber-300">{s.phone}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Location:</span> {s.address || 'Nairobi'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-TAB 8: AUDIT LOGS & LOGIN HISTORY */}
      {activeSubTab === 'audit' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                System Audit Logs & Terminal History ({auditLogs.length})
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Immutable chronological log of all operator logins, OTP verifications, payments, loans, and admin approvals.
              </p>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 z-10 bg-slate-950">
                  <tr className="border-b border-slate-800 text-slate-400 uppercase text-[11px] font-semibold">
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3">Operator</th>
                    <th className="py-2.5 px-3">Action</th>
                    <th className="py-2.5 px-3">Entity Type</th>
                    <th className="py-2.5 px-3">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {auditLogs.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 font-mono text-slate-400 whitespace-nowrap text-[11px]">{a.created_at}</td>
                      <td className="py-2.5 px-3 font-semibold text-white whitespace-nowrap">{a.user_name}</td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-amber-300 border border-slate-700">
                          {a.action}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-400 whitespace-nowrap">{a.entity_type}</td>
                      <td className="py-2.5 px-3 text-slate-300">{a.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 9: MULTI-COMPUTER NETWORK */}
      {activeSubTab === 'network' && (
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl space-y-6 text-xs text-slate-300">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Network className="w-4 h-4 text-amber-400" />
              <span>Multi-Computer Network & Offline Sync Setup</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              How to operate PEKASA across multiple terminals (Counter PC, Workshop PC, Director Office) simultaneously.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-3">
              <h4 className="font-bold text-white text-xs uppercase text-amber-400">
                1. Local Area Network (LAN) Setup
              </h4>
              <p className="text-slate-400 leading-relaxed">
                PEKASA is architected as a Local-First progressive web application. When running on your main host PC
                (e.g., Cashier Desk), any other laptop or PC connected to the shop Wi-Fi or router can access it immediately:
              </p>
              <div className="p-3 bg-slate-900 border border-slate-700/80 rounded-lg font-mono text-[11px] text-amber-300 space-y-1">
                <div>Main Cashier PC: http://192.168.1.100:3000</div>
                <div>Workshop Bench PC: Opens http://192.168.1.100:3000</div>
                <div>Trevor / Peter Office Laptop: Opens http://192.168.1.100:3000</div>
              </div>
            </div>

            <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-3">
              <h4 className="font-bold text-white text-xs uppercase text-amber-400">
                2. Shift Handover & Offline Backup Protocol
              </h4>
              <p className="text-slate-400 leading-relaxed">
                Because PEKASA maintains a complete relational SQLite database, you can export the exact binary file
                at closing time:
              </p>
              <ul className="list-disc pl-4 space-y-1 text-slate-300 text-[11px]">
                <li>Click <strong className="text-white">SQLite Backup</strong> in the top bar at the end of each counter shift.</li>
                <li>Store the downloaded binary on a secure USB drive or Google Drive.</li>
                <li>Restore takes under 2 seconds if switching computers.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* CREATE CASHIER MODAL (Restricted to Trevor & Peter) */}
      {isAddUserOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-white text-sm">Provision New Cashier Account</h3>
                <p className="text-[11px] text-amber-400">Authorized by Senior Partner {currentUser?.full_name}</p>
              </div>
              <button onClick={() => setIsAddUserOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCashierUser} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  Cashier Username (Login ID) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={newStaffUsername}
                  onChange={(e) => setNewStaffUsername(e.target.value)}
                  placeholder="e.g. cashier1 or juma"
                  className="w-full py-2 px-3 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono text-xs focus:ring-1 focus:ring-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  Full Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={newStaffFullName}
                  onChange={(e) => setNewStaffFullName(e.target.value)}
                  placeholder="e.g. Kelvin Juma"
                  className="w-full py-2 px-3 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-amber-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    Password <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="password"
                    value={newStaffPassword}
                    onChange={(e) => setNewStaffPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full py-2 px-3 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono text-xs focus:ring-1 focus:ring-amber-500"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Assigned Role</label>
                  <select
                    value={newStaffRoleId}
                    onChange={(e) => setNewStaffRoleId(e.target.value)}
                    className="w-full py-2 px-3 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-amber-500 cursor-pointer"
                  >
                    <option value="role-cashier">Counter Cashier</option>
                    <option value="role-manager">Branch Manager</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  Phone Number (For OTP Verification) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={newStaffPhone}
                  onChange={(e) => setNewStaffPhone(e.target.value)}
                  placeholder="+254 7..."
                  className="w-full py-2 px-3 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono text-xs focus:ring-1 focus:ring-amber-500"
                  required
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Cashiers receive a 6-digit OTP code to this phone upon login.
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Email Address (Optional)</label>
                <input
                  type="email"
                  value={newStaffEmail}
                  onChange={(e) => setNewStaffEmail(e.target.value)}
                  placeholder="cashier@pekasa.co.ke"
                  className="w-full py-2 px-3 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddUserOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs cursor-pointer shadow-md"
                >
                  Create Authorized Cashier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {resetModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-sm">Reset Password</h3>
              <button onClick={() => setResetModalUser(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleResetPasswordSubmit} className="space-y-4 text-xs">
              <p className="text-slate-300">
                Set a new password for <strong className="text-white">{resetModalUser.full_name}</strong> ({resetModalUser.username}):
              </p>
              <div>
                <label className="block font-bold text-slate-300 mb-1">New Password</label>
                <input
                  type="password"
                  value={newResetPassword}
                  onChange={(e) => setNewResetPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono text-xs focus:ring-1 focus:ring-amber-500"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setResetModalUser(null)}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs cursor-pointer shadow-md"
                >
                  Save Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECORD EXPENSE MODAL */}
      {isAddExpenseOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-sm">Record Shop Operating Expense</h3>
              <button onClick={() => setIsAddExpenseOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddExpense} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Category</label>
                  <select
                    value={expenseCategory}
                    onChange={(e) => setExpenseCategory(e.target.value)}
                    className="w-full py-2 px-3 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-amber-500 cursor-pointer"
                  >
                    <option value="Electricity/Tokens">Electricity / Tokens</option>
                    <option value="Rent">Shop Rent</option>
                    <option value="Salaries">Staff Salaries</option>
                    <option value="Security">Security Guard</option>
                    <option value="Transport">Transport & Cargo</option>
                    <option value="Repairs & Maintenance">Repairs & Maintenance</option>
                    <option value="Airtime & Internet">Airtime & Wi-Fi</option>
                    <option value="Shop Supplies">Shop Supplies</option>
                    <option value="M-Pesa / Bank Charges">M-Pesa Charges</option>
                    <option value="Other Expense">Other Expense</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Amount (KES)</label>
                  <input
                    type="number"
                    min="1"
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(Number(e.target.value) || 0)}
                    className="w-full py-2 px-3 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono text-xs focus:ring-1 focus:ring-amber-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Paid By</label>
                  <select
                    value={expensePaidBy}
                    onChange={(e) => setExpensePaidBy(e.target.value as any)}
                    className="w-full py-2 px-3 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-amber-500 cursor-pointer"
                  >
                    <option value="Trevor">Trevor</option>
                    <option value="Peter">Peter</option>
                    <option value="Shop Petty Cash">Shop Petty Cash</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Payment Method</label>
                  <select
                    value={expenseMethod}
                    onChange={(e) => setExpenseMethod(e.target.value as any)}
                    className="w-full py-2 px-3 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-amber-500 cursor-pointer"
                  >
                    <option value="M-Pesa">M-Pesa</option>
                    <option value="Cash">Cash</option>
                    <option value="Bank">Bank</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Reference Code</label>
                  <input
                    type="text"
                    value={expenseRef}
                    onChange={(e) => setExpenseRef(e.target.value)}
                    placeholder="e.g. QHK883192"
                    className="w-full py-2 px-3 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono text-xs focus:ring-1 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Expense Date</label>
                  <input
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full py-2 px-3 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono text-xs focus:ring-1 focus:ring-amber-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Expense Description / Purpose</label>
                <input
                  type="text"
                  value={expenseNotes}
                  onChange={(e) => setExpenseNotes(e.target.value)}
                  placeholder="e.g. September workshop tokens"
                  className="w-full py-2 px-3 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddExpenseOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs cursor-pointer shadow-md"
                >
                  Record Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD SUPPLIER MODAL */}
      {isAddSupplierOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-sm">Add New Spare Parts Supplier</h3>
              <button onClick={() => setIsAddSupplierOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddSupplier} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">Supplier Company Name</label>
                <input
                  type="text"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  placeholder="e.g. Nairobi Electronics Spares Ltd"
                  className="w-full py-2 px-3 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-amber-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Contact Person</label>
                  <input
                    type="text"
                    value={supplierContact}
                    onChange={(e) => setSupplierContact(e.target.value)}
                    placeholder="e.g. Jared Mutua"
                    className="w-full py-2 px-3 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={supplierPhone}
                    onChange={(e) => setSupplierPhone(e.target.value)}
                    placeholder="+254 7..."
                    className="w-full py-2 px-3 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono text-xs focus:ring-1 focus:ring-amber-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Physical Address</label>
                <input
                  type="text"
                  value={supplierAddress}
                  onChange={(e) => setSupplierAddress(e.target.value)}
                  placeholder="e.g. Luthuli Avenue, Nairobi"
                  className="w-full py-2 px-3 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddSupplierOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs cursor-pointer shadow-md"
                >
                  Save Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
