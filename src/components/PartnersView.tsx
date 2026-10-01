import React, { useState } from 'react';
import { sqliteService } from '../db/sqlite';
import { User, UserRole, Expense, Supplier, PaymentMethod } from '../types';
import { formatKES } from '../utils/numbering';
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
  Receipt, 
  PieChart, 
  Layers, 
  FileText,
  X
} from 'lucide-react';

export const PartnersView: React.FC = () => {
  const { currentUser, users, roles, createUser, updateUserRole, hasPermission } = useAuth();
  const appliances = sqliteService.getAppliances();
  const payments = sqliteService.getPayments();
  const expenses = sqliteService.getExpenses();
  const suppliers = sqliteService.getSuppliers();
  const auditLogs = sqliteService.getAuditLogs();

  const [activeSubTab, setActiveSubTab] = useState<'financials' | 'technicians' | 'expenses' | 'suppliers' | 'roles' | 'network'>('financials');

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

  // New User / Staff Form State
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newStaffUsername, setNewStaffUsername] = useState('');
  const [newStaffFullName, setNewStaffFullName] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffPhone, setNewStaffPhone] = useState('+254 ');
  const [newStaffPassword, setNewStaffPassword] = useState('');
  const [newStaffRoleId, setNewStaffRoleId] = useState(roles[1]?.id || 'role-tech');

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
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);

    try {
      sqliteService.run(
        `INSERT INTO expenses (id, category, amount, paid_by, payment_method, reference_code, expense_date, notes, created_at)
         VALUES (:id, :cat, :amt, :pb, :pm, :ref, :ed, :nt, :ca)`,
        {
          ':id': id,
          ':cat': expenseCategory,
          ':amt': Number(expenseAmount),
          ':pb': expensePaidBy,
          ':pm': expenseMethod,
          ':ref': expenseRef,
          ':ed': expenseDate,
          ':nt': expenseNotes,
          ':ca': nowStr
        }
      );

      sqliteService.logAudit(
        currentUser?.full_name || 'Admin',
        'RECORD_EXPENSE',
        'EXPENSE',
        id,
        `Expense of KES ${expenseAmount} for ${expenseCategory} (Paid by ${expensePaidBy})`
      );

      setIsAddExpenseOpen(false);
      setExpenseNotes('');
      setExpenseRef('');
    } catch (err: any) {
      alert('Error recording expense: ' + err.message);
    }
  };

  const handleAddSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierName) return;

    const id = 'sup-' + Date.now();
    const nowStr = new Date().toISOString().split('T')[0];

    try {
      sqliteService.run(
        `INSERT INTO suppliers (id, name, contact_person, phone, email, address, category, payment_terms, created_at)
         VALUES (:id, :name, :contact, :phone, :email, :address, :cat, :terms, :ca)`,
        {
          ':id': id,
          ':name': supplierName,
          ':contact': supplierContact,
          ':phone': supplierPhone,
          ':email': supplierEmail,
          ':address': supplierAddress,
          ':cat': supplierCategory,
          ':terms': supplierTerms,
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

  const handleCreateStaffUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffUsername || !newStaffFullName || !newStaffPassword) {
      alert('Please fill in username, full name, and password.');
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
      alert('User added with salted SHA-256 password hash!');
    } catch (err: any) {
      alert('Error creating staff user: ' + err.message);
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
          Trevor & Peter management, P&L profit statement, technician productivity, and duty access roles.
        </p>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-800 pb-2 text-xs">
        {[
          { id: 'financials', label: 'Partner Capital & P&L', icon: DollarSign },
          { id: 'technicians', label: 'Technician Performance', icon: Wrench },
          { id: 'expenses', label: 'Shop Operating Expenses', icon: Receipt },
          { id: 'suppliers', label: 'Suppliers Directory', icon: Truck },
          { id: 'roles', label: 'User Roles & Duties', icon: ShieldCheck },
          { id: 'network', label: 'Multi-Computer LAN Setup', icon: Network }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-amber-500 text-slate-950 font-bold shadow'
                  : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* SUB-TAB 1: FINANCIALS & PARTNER CAPITAL */}
      {activeSubTab === 'financials' && (
        <div className="space-y-6">
          {/* Executive P&L Snapshot */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
              <span className="text-xs font-semibold text-slate-400 uppercase">Gross Revenue (Cash & M-Pesa)</span>
              <div className="text-2xl font-bold text-emerald-400 font-mono-numbers mt-1.5">
                {formatKES(totalRevenue)}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Total collections from customers</p>
            </div>

            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
              <span className="text-xs font-semibold text-slate-400 uppercase">Operating Expenses</span>
              <div className="text-2xl font-bold text-rose-400 font-mono-numbers mt-1.5">
                {formatKES(totalExpenses)}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Rent, electricity, transport, parts</p>
            </div>

            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
              <span className="text-xs font-semibold text-slate-400 uppercase">Net Operating Balance</span>
              <div className={`text-2xl font-bold font-mono-numbers mt-1.5 ${netShopProfit >= 0 ? 'text-amber-400' : 'text-rose-500'}`}>
                {formatKES(netShopProfit)}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">After deducting shop operating expenses</p>
            </div>
          </div>

          {/* Trevor & Peter Direct Capital Split */}
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Partner Equity & Capital In Circulation
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Exact breakdown of cash advanced by Peter vs Trevor and collections received.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Trevor Card */}
              <div className="p-5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-extrabold text-amber-400 text-base">Trevor Mbugua</h4>
                    <span className="text-xs text-slate-400">Co-Director & Senior Partner</span>
                  </div>
                  <span className="text-xs font-mono bg-amber-500/10 border border-amber-500/30 text-amber-300 px-2 py-0.5 rounded">
                    50% Stake
                  </span>
                </div>

                <div className="space-y-2 text-xs divide-y divide-slate-800/80">
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-400">Total Capital Disbursed:</span>
                    <span className="font-mono-numbers font-bold text-white">{formatKES(trevorDisbursed)}</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-400">Payments Collected by Trevor:</span>
                    <span className="font-mono-numbers font-bold text-emerald-400">{formatKES(trevorCollections)}</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-400">Net Position:</span>
                    <span className="font-mono-numbers font-bold text-amber-300">
                      {formatKES(trevorCollections - trevorDisbursed)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Peter Card */}
              <div className="p-5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-extrabold text-amber-400 text-base">Peter Kamau</h4>
                    <span className="text-xs text-slate-400">Co-Director & Senior Partner</span>
                  </div>
                  <span className="text-xs font-mono bg-amber-500/10 border border-amber-500/30 text-amber-300 px-2 py-0.5 rounded">
                    50% Stake
                  </span>
                </div>

                <div className="space-y-2 text-xs divide-y divide-slate-800/80">
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-400">Total Capital Disbursed:</span>
                    <span className="font-mono-numbers font-bold text-white">{formatKES(peterDisbursed)}</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-400">Payments Collected by Peter:</span>
                    <span className="font-mono-numbers font-bold text-emerald-400">{formatKES(peterCollections)}</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-400">Net Position:</span>
                    <span className="font-mono-numbers font-bold text-amber-300">
                      {formatKES(peterCollections - peterDisbursed)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: TECHNICIAN PERFORMANCE */}
      {activeSubTab === 'technicians' && (
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Technician Productivity & Repair Revenue
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Workload allocation, completed repairs turnaround, and handling revenue by technician.
            </p>
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
                    <span className="font-bold text-white font-mono-numbers">{stat.total}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Repairs Completed:</span>
                    <span className="font-bold text-emerald-400 font-mono-numbers">{stat.completed}</span>
                  </div>
                  <div className="flex justify-between text-slate-400 pt-1 border-t border-slate-800">
                    <span>Service Revenue:</span>
                    <span className="font-bold text-amber-400 font-mono-numbers">{formatKES(stat.revenue)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-TAB 3: EXPENSES */}
      {activeSubTab === 'expenses' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Shop Operating Expense Records
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
                    <th className="py-3 px-4">Payment Method</th>
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
                        <td className="py-3 px-4 text-right font-mono-numbers font-bold text-rose-400 whitespace-nowrap">
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

      {/* SUB-TAB 4: SUPPLIERS */}
      {activeSubTab === 'suppliers' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Parts & Equipment Suppliers Directory
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
                    {s.category}
                  </span>
                </div>
                <div className="space-y-1 text-slate-300">
                  <div>
                    <span className="text-slate-400">Contact Person:</span> {s.contact_person}
                  </div>
                  <div>
                    <span className="text-slate-400">Phone:</span> <span className="font-mono text-amber-300">{s.phone}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Location:</span> {s.address}
                  </div>
                  <div>
                    <span className="text-slate-400">Payment Terms:</span> <span className="text-emerald-400">{s.payment_terms}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-TAB 5: USER ROLES & DUTIES */}
      {activeSubTab === 'roles' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                User-Level Duty & Role Management
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Assign granular permissions to team members based on counter duties.
              </p>
            </div>
            <button
              onClick={() => setIsAddUserOpen(true)}
              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Staff User</span>
            </button>
          </div>

          {/* Users Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase text-[11px] font-semibold bg-slate-950/40">
                    <th className="py-3 px-4">Operator Name</th>
                    <th className="py-3 px-4">Username</th>
                    <th className="py-3 px-4">Phone / Contact</th>
                    <th className="py-3 px-4">Assigned Duty Role</th>
                    <th className="py-3 px-4">Security Level</th>
                    <th className="py-3 px-4">Last Activity</th>
                    <th className="py-3 px-4 text-right">Duty Assignment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-bold text-white whitespace-nowrap">{u.full_name}</td>
                      <td className="py-3 px-4 font-mono text-amber-400 whitespace-nowrap">{u.username}</td>
                      <td className="py-3 px-4 font-mono text-slate-400 whitespace-nowrap">{u.phone}</td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="inline-block bg-slate-800 text-slate-200 border border-slate-700 px-2.5 py-0.5 rounded text-[11px] font-medium">
                          {u.role_title}
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-mono text-emerald-400 text-[11px]">
                          SHA-256 Hashed
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400 whitespace-nowrap text-[11px]">
                        {u.last_login || 'Never'}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <select
                          value={u.role_id}
                          onChange={(e) => updateUserRole(u.id, e.target.value)}
                          className="py-1 px-2 bg-slate-950 border border-slate-700 rounded text-slate-200 text-xs focus:ring-1 focus:ring-amber-500 cursor-pointer"
                        >
                          {roles.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Role Permissions Matrix */}
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Permission Hierarchy Matrix
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              {roles.map((r) => (
                <div key={r.id} className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2">
                  <div className="font-bold text-amber-400 text-sm">{r.name}</div>
                  <p className="text-[11px] text-slate-400">{r.description}</p>
                  <ul className="space-y-1 pt-2 border-t border-slate-800/80 text-[11px]">
                    {Object.entries(r.permissions).map(([perm, allowed]) => (
                      <li key={perm} className="flex items-center justify-between text-slate-300">
                        <span>{perm.replace(/^can_/, '').replace(/_/g, ' ')}:</span>
                        <span className={allowed ? 'text-emerald-400 font-bold' : 'text-slate-600'}>
                          {allowed ? 'Allowed' : 'Restricted'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 6: MULTI-COMPUTER NETWORK SETUP */}
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
              <p className="text-[11px] text-slate-400">
                Tip: Set a static local IP on your shop router for the primary computer so the bookmark never changes.
              </p>
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
                <li>Store the downloaded <span className="font-mono text-amber-400">PEKASA_Database_YYYY-MM-DD.sqlite</span> on a secure USB drive or Google Drive.</li>
                <li>If any terminal fails or a new computer is introduced, click <strong>Restore Database</strong> and upload the file. Full recovery takes under 2 seconds.</li>
              </ul>
            </div>
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
              <div>
                <label className="block font-bold text-slate-300 mb-1">Expense Category</label>
                <select
                  value={expenseCategory}
                  onChange={(e) => setExpenseCategory(e.target.value)}
                  className="w-full py-2 px-3 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-amber-500 cursor-pointer"
                >
                  <option value="Rent">Shop Rent</option>
                  <option value="Electricity/Tokens">Electricity / Tokens (KPLC)</option>
                  <option value="Transport">Transport / Delivery Spares</option>
                  <option value="Spares/Tools">Tools & Workshop Consumables</option>
                  <option value="Internet">Shop Internet & Airtime</option>
                  <option value="Lunch/Welfare">Lunch / Welfare</option>
                  <option value="Misc">Miscellaneous</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-white mb-1">Amount (KES)</label>
                  <input
                    type="number"
                    min="1"
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(Number(e.target.value))}
                    className="w-full py-2 px-3 bg-slate-950 border border-slate-700 rounded-lg text-rose-400 font-bold font-mono text-xs focus:ring-1 focus:ring-amber-500"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Paid By</label>
                  <select
                    value={expensePaidBy}
                    onChange={(e) => setExpensePaidBy(e.target.value as any)}
                    className="w-full py-2 px-3 bg-slate-950 border border-slate-700 rounded-lg text-amber-300 font-bold text-xs focus:ring-1 focus:ring-amber-500 cursor-pointer"
                  >
                    <option value="Trevor">Trevor (From Trevor's Pocket)</option>
                    <option value="Peter">Peter (From Peter's Pocket)</option>
                    <option value="Shop Petty Cash">Shop Petty Cash</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Payment Method</label>
                  <select
                    value={expenseMethod}
                    onChange={(e) => setExpenseMethod(e.target.value as PaymentMethod)}
                    className="w-full py-2 px-3 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-amber-500 cursor-pointer"
                  >
                    <option value="M-Pesa">M-Pesa</option>
                    <option value="Cash">Cash</option>
                    <option value="Bank">Bank</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">M-Pesa / Receipt Ref</label>
                  <input
                    type="text"
                    value={expenseRef}
                    onChange={(e) => setExpenseRef(e.target.value)}
                    placeholder="e.g. QHK82910X"
                    className="w-full py-2 px-3 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono text-xs focus:ring-1 focus:ring-amber-500"
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

              <div>
                <label className="block font-bold text-slate-300 mb-1">Category Supplied</label>
                <input
                  type="text"
                  value={supplierCategory}
                  onChange={(e) => setSupplierCategory(e.target.value)}
                  placeholder="e.g. TV Boards, Compressor Relays, Heating Elements"
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

      {/* ADD STAFF USER MODAL */}
      {isAddUserOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-sm">Add Staff Operator Account</h3>
              <button onClick={() => setIsAddUserOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateStaffUser} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">Username (Login ID)</label>
                <input
                  type="text"
                  value={newStaffUsername}
                  onChange={(e) => setNewStaffUsername(e.target.value)}
                  placeholder="e.g. technician1 or cashier"
                  className="w-full py-2 px-3 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono text-xs focus:ring-1 focus:ring-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  value={newStaffFullName}
                  onChange={(e) => setNewStaffFullName(e.target.value)}
                  placeholder="e.g. Dennis Kariuki"
                  className="w-full py-2 px-3 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-amber-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Password</label>
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
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Phone Number</label>
                <input
                  type="text"
                  value={newStaffPhone}
                  onChange={(e) => setNewStaffPhone(e.target.value)}
                  placeholder="+254 7..."
                  className="w-full py-2 px-3 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono text-xs focus:ring-1 focus:ring-amber-500"
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
                  Create Hashed Staff Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
