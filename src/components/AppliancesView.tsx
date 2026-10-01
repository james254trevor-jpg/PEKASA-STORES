import React, { useState, useRef } from 'react';
import { sqliteService } from '../db/sqlite';
import { 
  Appliance, 
  Customer, 
  ApplianceCategory, 
  ApplianceStatus, 
  APPLIANCE_CATEGORIES,
  AppliancePhoto,
  Part
} from '../types';
import { formatKES, calculateDueDate } from '../utils/numbering';
import { downloadReceiptPDF, downloadInvoicePDF } from '../utils/pdfGenerator';
import { generateWhatsAppLink, createDueReminderMessage, createRepairReadyMessage } from '../utils/messaging';
import { useAuth } from '../context/AuthContext';
import { 
  Tv, 
  Search, 
  Filter, 
  Plus, 
  Camera, 
  Image, 
  Calendar, 
  DollarSign, 
  Clock, 
  User, 
  Wrench, 
  FileText, 
  Download, 
  MessageSquare, 
  X, 
  Check, 
  AlertCircle,
  Eye,
  Trash2,
  Package,
  Users,
  CheckCircle2
} from 'lucide-react';

interface AppliancesViewProps {
  selectedApplianceId: string | null;
  initialSearchQuery?: string;
  onClearSelectedAppliance: () => void;
  onOpenPaymentForAppliance: (appliance: Appliance) => void;
}

export const AppliancesView: React.FC<AppliancesViewProps> = ({
  selectedApplianceId,
  initialSearchQuery = '',
  onClearSelectedAppliance,
  onOpenPaymentForAppliance
}) => {
  const { currentUser, hasPermission } = useAuth();
  const appliances = sqliteService.getAppliances();
  const customers = sqliteService.getCustomers();
  const parts = sqliteService.getParts();

  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [funderFilter, setFunderFilter] = useState<string>('ALL');

  // Modal States
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [detailApplianceId, setDetailApplianceId] = useState<string | null>(selectedApplianceId);
  const [isIssuePartOpen, setIsIssuePartOpen] = useState(false);
  const [isQuickAddCustomerOpen, setIsQuickAddCustomerOpen] = useState(false);

  // Quick Add Customer State
  const [quickCustName, setQuickCustName] = useState('');
  const [quickCustIdNumber, setQuickCustIdNumber] = useState('');
  const [quickCustPhone, setQuickCustPhone] = useState('');
  const [quickCustAddress, setQuickCustAddress] = useState('');

  // Sync selected appliance from parent
  React.useEffect(() => {
    if (selectedApplianceId) {
      setDetailApplianceId(selectedApplianceId);
    }
  }, [selectedApplianceId]);

  // Sync initialSearchQuery from parent
  React.useEffect(() => {
    if (initialSearchQuery !== undefined) {
      setSearchQuery(initialSearchQuery);
    }
  }, [initialSearchQuery]);

  // New Appliance Form State
  const [newCustomerId, setNewCustomerId] = useState(customers[0]?.id || '');
  const [newCategory, setNewCategory] = useState<ApplianceCategory>('TV');
  const [newCustomCategory, setNewCustomCategory] = useState('');
  const [newBrand, setNewBrand] = useState('');
  const [newModel, setNewModel] = useState('');
  const [newSerialNumber, setNewSerialNumber] = useState('');
  const [newCondition, setNewCondition] = useState('Good working condition, complete accessories');
  const [newMarketValue, setNewMarketValue] = useState<number>(30000);
  const [newAmountReceived, setNewAmountReceived] = useState<number>(10000);
  const [newFunder, setNewFunder] = useState<'Trevor' | 'Peter'>('Trevor');
  const [newDateReceived, setNewDateReceived] = useState(new Date().toISOString().split('T')[0]);
  const [newInterestCharges, setNewInterestCharges] = useState<number>(1000);
  const [newTechnician, setNewTechnician] = useState('Trevor');
  const [newNotes, setNewNotes] = useState('');
  const [newPhotos, setNewPhotos] = useState<string[]>([]);

  // Issue Part State
  const [selectedPartId, setSelectedPartId] = useState<string>(parts[0]?.id || '');
  const [issueQuantity, setIssueQuantity] = useState<number>(1);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filtered Appliances
  const filteredAppliances = appliances.filter((app) => {
    const cust = customers.find((c) => c.id === app.customer_id);
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch =
      app.appliance_number.toLowerCase().includes(searchLower) ||
      app.brand.toLowerCase().includes(searchLower) ||
      app.model.toLowerCase().includes(searchLower) ||
      (app.serial_number && app.serial_number.toLowerCase().includes(searchLower)) ||
      (cust && cust.name.toLowerCase().includes(searchLower)) ||
      (cust && cust.phone.includes(searchLower)) ||
      (cust && cust.id_number.includes(searchLower));

    const matchesCat = categoryFilter === 'ALL' || app.category === categoryFilter;
    const matchesStatus = statusFilter === 'ALL' || app.status === statusFilter;
    const matchesFunder = funderFilter === 'ALL' || app.funder === funderFilter;

    return matchesSearch && matchesCat && matchesStatus && matchesFunder;
  });

  const detailAppliance = appliances.find((a) => a.id === detailApplianceId);
  const detailCustomer = detailAppliance
    ? customers.find((c) => c.id === detailAppliance.customer_id)
    : null;
  const detailPhotos = detailApplianceId
    ? sqliteService.getAppliancePhotos(detailApplianceId)
    : [];
  const detailPayments = detailApplianceId
    ? sqliteService.getPaymentsForAppliance(detailApplianceId)
    : [];

  // Handle Photo Upload
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        const result = uploadEvent.target?.result as string;
        if (result) {
          setNewPhotos((prev) => [...prev, result]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  // Submit New Appliance
  const handleCreateAppliance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerId || !newBrand || !newModel) {
      alert('Please select a customer and provide brand/model details.');
      return;
    }

    const calculatedDue = calculateDueDate(newDateReceived);
    const newCode = sqliteService.getNextSequence('APP');
    const appId = 'app-' + Date.now();
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);

    sqliteService.run(
      `INSERT INTO appliances (
        id, appliance_number, customer_id, category, custom_category, brand, model,
        serial_number, condition, market_value, amount_received, funder, date_received,
        due_date, status, technician_name, interest_charges, notes, created_at, updated_at
      ) VALUES (
        :id, :appliance_number, :customer_id, :category, :custom_category, :brand, :model,
        :serial_number, :condition, :market_value, :amount_received, :funder, :date_received,
        :due_date, :status, :technician_name, :interest_charges, :notes, :created_at, :updated_at
      )`,
      {
        ':id': appId,
        ':appliance_number': newCode,
        ':customer_id': newCustomerId,
        ':category': newCategory,
        ':custom_category': newCategory === 'Other appliances' ? newCustomCategory : null,
        ':brand': newBrand,
        ':model': newModel,
        ':serial_number': newSerialNumber,
        ':condition': newCondition,
        ':market_value': Number(newMarketValue) || 0,
        ':amount_received': Number(newAmountReceived) || 0,
        ':funder': newFunder,
        ':date_received': newDateReceived,
        ':due_date': calculatedDue,
        ':status': 'Active Collateral / Pawn',
        ':technician_name': newTechnician,
        ':interest_charges': Number(newInterestCharges) || 0,
        ':notes': newNotes,
        ':created_at': nowStr,
        ':updated_at': nowStr
      }
    );

    // Save photos
    newPhotos.forEach((photoUrl, idx) => {
      sqliteService.run(
        `INSERT INTO appliance_photos (id, appliance_id, photo_url, caption, uploaded_at)
         VALUES (:id, :aid, :purl, :cap, :ua)`,
        {
          ':id': `pht-${Date.now()}-${idx}`,
          ':aid': appId,
          ':purl': photoUrl,
          ':cap': `Intake photo ${idx + 1}`,
          ':ua': nowStr
        }
      );
    });

    // Create initial invoice
    const invCode = sqliteService.getNextSequence('INV');
    const invId = 'inv-' + Date.now();
    const totalInv = Number(newAmountReceived) + Number(newInterestCharges);

    sqliteService.run(
      `INSERT INTO invoices (
        id, invoice_number, appliance_id, customer_id, issue_date, due_date,
        subtotal, tax, total_amount, status, notes, created_at
      ) VALUES (
        :id, :invoice_number, :appliance_id, :customer_id, :issue_date, :due_date,
        :subtotal, :tax, :total_amount, :status, :notes, :created_at
      )`,
      {
        ':id': invId,
        ':invoice_number': invCode,
        ':appliance_id': appId,
        ':customer_id': newCustomerId,
        ':issue_date': newDateReceived,
        ':due_date': calculatedDue,
        ':subtotal': totalInv,
        ':tax': 0,
        ':total_amount': totalInv,
        ':status': 'Unpaid',
        ':notes': `Initial pawn invoice for ${newCategory} (${newBrand} ${newModel})`,
        ':created_at': nowStr
      }
    );

    sqliteService.run(
      `INSERT INTO invoice_items (id, invoice_id, part_id, description, quantity, unit_price, total_price)
       VALUES (:id, :iid, NULL, :desc, 1, :pr, :pr)`,
      {
        ':id': 'itm-' + Date.now(),
        ':iid': invId,
        ':desc': `Cash Advance Disbursed by ${newFunder}`,
        ':pr': Number(newAmountReceived)
      }
    );

    sqliteService.logAudit(
      currentUser?.full_name || 'Admin',
      'CREATE_APPLIANCE',
      'APPLIANCE',
      appId,
      `Intake ${newCode}: ${newCategory} (${newBrand} ${newModel}) funded by ${newFunder} KES ${newAmountReceived}`
    );

    setIsNewModalOpen(false);
    setNewPhotos([]);
    setDetailApplianceId(appId);
  };

  // Quick Add Customer Handler
  const handleQuickAddCustomerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickCustName.trim() || !quickCustIdNumber.trim() || !quickCustPhone.trim()) {
      alert('Please fill in Name, National ID, and Phone Number.');
      return;
    }
    const id = 'cust-' + Date.now();
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
    try {
      sqliteService.run(
        `INSERT INTO customers (id, name, id_number, phone, email, address, photo_url, notes, created_at, updated_at)
         VALUES (:id, :name, :id_number, :phone, NULL, :address, NULL, 'Registered during collateral loan intake', :created_at, :updated_at)`,
        {
          ':id': id,
          ':name': quickCustName.trim(),
          ':id_number': quickCustIdNumber.trim(),
          ':phone': quickCustPhone.trim(),
          ':address': quickCustAddress.trim() || null,
          ':created_at': nowStr,
          ':updated_at': nowStr
        }
      );
      sqliteService.logAudit(currentUser?.full_name || 'Admin', 'CREATE_CUSTOMER', 'CUSTOMER', id, `Registered customer ${quickCustName} (${quickCustPhone})`);
      setNewCustomerId(id);
      setIsQuickAddCustomerOpen(false);
      setQuickCustName('');
      setQuickCustIdNumber('');
      setQuickCustPhone('');
      setQuickCustAddress('');
    } catch (err: any) {
      alert('Error creating customer: ' + err.message);
    }
  };

  // Issue Part Handler
  const handleIssuePartSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailApplianceId || !selectedPartId) return;

    try {
      sqliteService.issuePartToAppliance(
        selectedPartId,
        detailApplianceId,
        issueQuantity,
        currentUser?.full_name || 'Technician'
      );
      setIsIssuePartOpen(false);
      alert('Part successfully issued to appliance and deducted from inventory!');
    } catch (err: any) {
      alert('Failed to issue part: ' + err.message);
    }
  };

  const handleUpdateStatus = (appId: string, status: ApplianceStatus) => {
    sqliteService.run('UPDATE appliances SET status = :st, updated_at = :u WHERE id = :id', {
      ':st': status,
      ':u': new Date().toISOString().replace('T', ' ').substring(0, 19),
      ':id': appId
    });
    sqliteService.logAudit(
      currentUser?.full_name || 'Admin',
      'UPDATE_STATUS',
      'APPLIANCE',
      appId,
      `Status changed to: ${status}`
    );
  };

  return (
    <div className="space-y-6">
      {/* Title & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Appliance & Collateral Inventory</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Full tracking with automatic numbering (APP-2026-XXXXX), 14-day due dates, photos, and valuation.
          </p>
        </div>

        <button
          onClick={() => setIsNewModalOpen(true)}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-md"
        >
          <Plus className="w-4 h-4" />
          <span>Intake New Appliance</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Search Box */}
          <div className="relative md:col-span-2">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tag (APP-2026-...), brand, customer name, phone, or ID..."
              className="w-full pl-9 pr-4 py-2 bg-slate-950/80 border border-slate-700/80 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
            />
          </div>

          {/* Category Dropdown */}
          <div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full py-2 px-3 bg-slate-950/80 border border-slate-700/80 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
            >
              <option value="ALL">All Categories ({APPLIANCE_CATEGORIES.length})</option>
              {APPLIANCE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Status Dropdown */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full py-2 px-3 bg-slate-950/80 border border-slate-700/80 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="Active Collateral / Pawn">Active Collateral / Pawn</option>
              <option value="Under Evaluation">Under Evaluation</option>
              <option value="In Repair">In Repair</option>
              <option value="Ready for Collection">Ready for Collection</option>
              <option value="Redeemed">Redeemed</option>
              <option value="Defaulted">Defaulted</option>
              <option value="Sold">Sold</option>
            </select>
          </div>
        </div>

        {/* Funder Quick Filter Tabs */}
        <div className="flex items-center gap-2 pt-1 border-t border-slate-800/80 text-xs">
          <span className="text-slate-400 font-medium">Funder Split:</span>
          {['ALL', 'Trevor', 'Peter'].map((f) => (
            <button
              key={f}
              onClick={() => setFunderFilter(f)}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                funderFilter === f
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {f === 'ALL' ? 'All Funders' : `Funded by ${f}`}
            </button>
          ))}
          <span className="ml-auto text-slate-500 font-mono text-[11px]">
            Found {filteredAppliances.length} items
          </span>
        </div>
      </div>

      {/* Appliances Table (Data grid with tabular figures) */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase text-[11px] font-semibold bg-slate-950/40">
                <th className="py-3 px-4">Tag Code</th>
                <th className="py-3 px-4">Category & Spec</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4 text-right">Market Value</th>
                <th className="py-3 px-4 text-right">Amount Received</th>
                <th className="py-3 px-4 text-right">Balance Due</th>
                <th className="py-3 px-4">Funder</th>
                <th className="py-3 px-4">Due Date</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredAppliances.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500">
                    No appliances matching filter criteria.
                  </td>
                </tr>
              ) : (
                filteredAppliances.map((app) => {
                  const cust = customers.find((c) => c.id === app.customer_id);
                  const { balanceRemaining } = sqliteService.calculateApplianceBalance(app);
                  const isOverdue = app.due_date < new Date().toISOString().split('T')[0] && app.status !== 'Redeemed' && app.status !== 'Sold';

                  return (
                    <tr
                      key={app.id}
                      className="hover:bg-slate-800/40 transition-colors cursor-pointer"
                      onClick={() => setDetailApplianceId(app.id)}
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-amber-400 whitespace-nowrap">
                        {app.appliance_number}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-semibold text-white">{app.category}</div>
                        <div className="text-[11px] text-slate-400">
                          {app.brand} {app.model} {app.serial_number ? `(${app.serial_number})` : ''}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="text-slate-200">{cust?.name || 'Unknown'}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{cust?.phone}</div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono-numbers text-slate-300 whitespace-nowrap">
                        {formatKES(app.market_value)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono-numbers font-medium text-white whitespace-nowrap">
                        {formatKES(app.amount_received)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono-numbers font-bold text-rose-300 whitespace-nowrap">
                        {formatKES(balanceRemaining)}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap font-mono text-[11px]">
                        <span className={app.funder === 'Trevor' ? 'text-blue-400' : 'text-amber-400'}>
                          {app.funder}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className={`font-mono text-xs ${isOverdue ? 'text-rose-400 font-bold' : 'text-slate-300'}`}>
                          {app.due_date}
                        </div>
                        {isOverdue && (
                          <div className="text-[10px] text-rose-400 font-semibold">Overdue (2w cycle)</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${
                            app.status === 'Redeemed'
                              ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                              : app.status === 'In Repair'
                              ? 'bg-sky-950/80 text-sky-300 border border-sky-800'
                              : app.status === 'Defaulted'
                              ? 'bg-rose-950/80 text-rose-300 border border-rose-800'
                              : 'bg-amber-950/80 text-amber-300 border border-amber-800'
                          }`}
                        >
                          {app.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onOpenPaymentForAppliance(app)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-semibold transition-colors cursor-pointer"
                            title="Record payment / Pay balance"
                          >
                            Pay
                          </button>
                          <button
                            onClick={() => setDetailApplianceId(app.id)}
                            className="p-1 text-slate-400 hover:text-white rounded transition-colors cursor-pointer"
                            title="View details & photos"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* APPLIANCE DETAIL DRAWER / MODAL */}
      {detailAppliance && detailCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8">
            {/* Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-3">
                <span className="text-xl font-bold font-mono text-amber-400">
                  {detailAppliance.appliance_number}
                </span>
                <span className="text-sm font-semibold text-white">
                  {detailAppliance.category} · {detailAppliance.brand} {detailAppliance.model}
                </span>
              </div>
              <button
                onClick={() => setDetailApplianceId(null)}
                className="p-1 text-slate-400 hover:text-white rounded transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto text-xs text-slate-300">
              {/* Status and Action Ribbon */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-950/80 border border-slate-800 rounded-xl">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Current Status:</span>
                  <select
                    value={detailAppliance.status}
                    onChange={(e) => handleUpdateStatus(detailAppliance.id, e.target.value as ApplianceStatus)}
                    className="py-1 px-2.5 bg-slate-900 border border-slate-700 rounded text-amber-300 font-semibold focus:outline-none cursor-pointer"
                  >
                    <option value="Active Collateral / Pawn">Active Collateral / Pawn</option>
                    <option value="Under Evaluation">Under Evaluation</option>
                    <option value="In Repair">In Repair</option>
                    <option value="Ready for Collection">Ready for Collection</option>
                    <option value="Redeemed">Redeemed</option>
                    <option value="Defaulted">Defaulted</option>
                    <option value="Sold">Sold</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const msg = createRepairReadyMessage({
                        customerName: detailCustomer.name,
                        applianceCode: detailAppliance.appliance_number,
                        applianceItem: `${detailAppliance.brand} ${detailAppliance.category}`,
                        repairCost: sqliteService.calculateApplianceBalance(detailAppliance).balanceRemaining
                      });
                      const link = generateWhatsAppLink(detailCustomer.phone, msg);
                      window.open(link, '_blank');
                    }}
                    className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium flex items-center gap-1 cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>WhatsApp Ready Alert</span>
                  </button>

                  <button
                    onClick={() => setIsIssuePartOpen(true)}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-xs font-medium flex items-center gap-1 cursor-pointer"
                  >
                    <Wrench className="w-3.5 h-3.5 text-amber-400" />
                    <span>Issue Part from Stock</span>
                  </button>
                </div>
              </div>

              {/* Photos Gallery */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold uppercase tracking-wider text-slate-400 text-[11px] flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-amber-400" />
                    <span>Appliance Photographs ({detailPhotos.length})</span>
                  </h3>
                </div>

                {detailPhotos.length === 0 ? (
                  <div className="p-6 bg-slate-950/40 border border-dashed border-slate-800 rounded-xl text-center text-slate-500">
                    No intake photos uploaded for this record.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {detailPhotos.map((p) => (
                      <div key={p.id} className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950 group">
                        <img
                          src={p.photo_url}
                          alt={p.caption || 'Appliance'}
                          className="w-full h-36 object-cover"
                        />
                        <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-2 text-center text-[10px] text-white">
                          {p.caption || 'Intake Photo'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Two Column Specs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Financial Ledger */}
                <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
                  <h4 className="font-bold text-white text-xs uppercase tracking-wider border-b border-slate-800 pb-1.5">
                    Financial Summary
                  </h4>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-400">Market Value:</span>
                    <span className="font-mono-numbers font-semibold text-slate-200">
                      {formatKES(detailAppliance.market_value)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-400">Amount Received from {detailAppliance.funder}:</span>
                    <span className="font-mono-numbers font-bold text-white">
                      {formatKES(detailAppliance.amount_received)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-400">Interest / Storage Charges:</span>
                    <span className="font-mono-numbers text-slate-300">
                      {formatKES(detailAppliance.interest_charges)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-t border-slate-800">
                    <span className="text-slate-400">Total Payments Received:</span>
                    <span className="font-mono-numbers font-bold text-emerald-400">
                      {formatKES(sqliteService.calculateApplianceBalance(detailAppliance).totalPaid)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 border-t border-slate-800 text-sm">
                    <span className="font-bold text-rose-400">Outstanding Balance:</span>
                    <span className="font-mono-numbers font-black text-rose-400">
                      {formatKES(sqliteService.calculateApplianceBalance(detailAppliance).balanceRemaining)}
                    </span>
                  </div>
                </div>

                {/* Timeline & Customer Details with Customer Photo */}
                <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                    <h4 className="font-bold text-white text-xs uppercase tracking-wider">
                      Customer & Custody Timeline
                    </h4>
                    <span className="text-[10px] text-[#0ABAB5] font-mono bg-[#0ABAB5]/10 border border-[#0ABAB5]/30 px-2 py-0.5 rounded-full font-bold">
                      Marked to Client
                    </span>
                  </div>

                  {/* Customer Photo & Verification Block */}
                  <div className="flex items-center gap-3 p-2 bg-black/40 rounded-lg border border-white/5">
                    {detailCustomer.photo_url ? (
                      <img
                        src={detailCustomer.photo_url}
                        alt={detailCustomer.name}
                        className="w-12 h-12 rounded-xl object-cover border border-[#0ABAB5]/40 shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-slate-800 border border-white/10 flex items-center justify-center text-[#0ABAB5] font-extrabold text-xs shrink-0">
                        {detailCustomer.name.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="font-bold text-white text-xs">{detailCustomer.name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">ID: {detailCustomer.id_number}</div>
                      <div className="text-[11px] text-[#0ABAB5] font-mono">{detailCustomer.phone}</div>
                    </div>
                  </div>

                  <div className="flex justify-between py-1 border-t border-slate-800/80">
                    <span className="text-slate-400">Date Received:</span>
                    <span className="font-mono text-slate-300">{detailAppliance.date_received}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-400 font-semibold text-[#0ABAB5]">Due Date (2 Weeks):</span>
                    <span className="font-mono font-bold text-[#0ABAB5]">{detailAppliance.due_date}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-400">Assigned Technician:</span>
                    <span className="text-slate-300">{detailAppliance.technician_name || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Physical Condition & Notes */}
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1.5">
                <span className="font-bold text-slate-400 uppercase text-[11px]">Condition & Inspection Notes:</span>
                <p className="text-slate-300">{detailAppliance.condition || 'N/A'}</p>
                {detailAppliance.notes && (
                  <p className="text-slate-400 text-[11px] italic pt-1 border-t border-slate-800">
                    "{detailAppliance.notes}"
                  </p>
                )}
              </div>

              {/* Payments History for this Appliance */}
              <div className="space-y-2">
                <h4 className="font-bold uppercase tracking-wider text-slate-400 text-[11px]">
                  Payment History & Receipts
                </h4>
                {detailPayments.length === 0 ? (
                  <div className="p-3 bg-slate-950/40 border border-slate-800 rounded-lg text-slate-500 text-center">
                    No payments logged yet for this appliance.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800 border border-slate-800 rounded-lg overflow-hidden">
                    {detailPayments.map((p) => (
                      <div key={p.id} className="p-3 bg-slate-950 flex items-center justify-between">
                        <div>
                          <div className="font-mono font-bold text-amber-400">{p.receipt_number}</div>
                          <div className="text-[11px] text-slate-400">
                            {p.payment_date} · {p.payment_method}
                            {p.mpesa_code && <span className="font-mono text-emerald-400 ml-1">[{p.mpesa_code}]</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono-numbers font-bold text-white">{formatKES(p.amount)}</span>
                          <button
                            onClick={() => downloadReceiptPDF(p, detailCustomer, detailAppliance)}
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] flex items-center gap-1 cursor-pointer"
                          >
                            <Download className="w-3 h-3 text-amber-400" />
                            <span>PDF</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-end gap-2">
              <button
                onClick={() => setDetailApplianceId(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ISSUE PART MODAL */}
      {isIssuePartOpen && detailAppliance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Wrench className="w-4 h-4 text-amber-400" />
                <h3 className="font-bold text-white text-sm">Issue Spare Part to Repair</h3>
              </div>
              <button onClick={() => setIsIssuePartOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleIssuePartSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Select Inventory Part</label>
                <select
                  value={selectedPartId}
                  onChange={(e) => setSelectedPartId(e.target.value)}
                  className="w-full py-2 px-3 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-amber-500 cursor-pointer"
                >
                  {parts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.sku} - {p.part_name} (Stock: {p.quantity} | KES {p.selling_price})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Quantity</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={issueQuantity}
                  onChange={(e) => setIssueQuantity(parseInt(e.target.value, 10) || 1)}
                  className="w-full py-2 px-3 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono text-xs focus:ring-1 focus:ring-amber-500"
                  required
                />
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-slate-400 text-[11px]">
                Issuing this part will automatically deduct inventory quantity and record an audit stock movement against{' '}
                <span className="font-mono text-amber-400">{detailAppliance.appliance_number}</span>.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsIssuePartOpen(false)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded text-xs cursor-pointer"
                >
                  Confirm Issue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* NEW APPLIANCE INTAKE MODAL */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-amber-400" />
                <span>Intake Appliance / Pawn Record</span>
              </h2>
              <button
                onClick={() => setIsNewModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAppliance} className="p-6 space-y-4 text-xs">
              {/* Customer Selector with Quick Add */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-bold text-slate-300">Customer / Depositor *</label>
                  <button
                    type="button"
                    onClick={() => setIsQuickAddCustomerOpen(true)}
                    className="text-xs font-bold text-[#0ABAB5] hover:text-[#1FD2CD] flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add New Customer</span>
                  </button>
                </div>
                <select
                  value={newCustomerId}
                  onChange={(e) => setNewCustomerId(e.target.value)}
                  className="w-full py-2.5 px-3 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-[#0ABAB5] cursor-pointer"
                  required
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} (ID: {c.id_number} · Tel: {c.phone})
                    </option>
                  ))}
                </select>
              </div>

              {/* Category & Custom Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Appliance Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as ApplianceCategory)}
                    className="w-full py-2 px-3 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-amber-500 cursor-pointer"
                  >
                    {APPLIANCE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {newCategory === 'Other appliances' && (
                  <div>
                    <label className="block font-bold text-slate-300 mb-1">Specify Other Appliance</label>
                    <input
                      type="text"
                      value={newCustomCategory}
                      onChange={(e) => setNewCustomCategory(e.target.value)}
                      placeholder="e.g. Generator, Blender, Water Dispenser"
                      className="w-full py-2 px-3 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-amber-500"
                      required
                    />
                  </div>
                )}

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Brand Name</label>
                  <input
                    type="text"
                    value={newBrand}
                    onChange={(e) => setNewBrand(e.target.value)}
                    placeholder="e.g. Samsung, Sony, Ramtons, Mika"
                    className="w-full py-2 px-3 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-amber-500"
                    required
                  />
                </div>
              </div>

              {/* Model & Serial Number */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Model / Size Specification</label>
                  <input
                    type="text"
                    value={newModel}
                    onChange={(e) => setNewModel(e.target.value)}
                    placeholder="e.g. 55-inch 4K Smart, 213L Double Door, 13kg cylinder"
                    className="w-full py-2 px-3 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-amber-500"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Serial Number (Optional)</label>
                  <input
                    type="text"
                    value={newSerialNumber}
                    onChange={(e) => setNewSerialNumber(e.target.value)}
                    placeholder="e.g. SN-8921829"
                    className="w-full py-2 px-3 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono text-xs focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Valuation & Money Disbursed */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Market Value (KES)</label>
                  <input
                    type="number"
                    value={newMarketValue}
                    onChange={(e) => setNewMarketValue(Number(e.target.value))}
                    className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-xs focus:ring-1 focus:ring-amber-500"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-white mb-1">Amount Disbursed (KES)</label>
                  <input
                    type="number"
                    value={newAmountReceived}
                    onChange={(e) => setNewAmountReceived(Number(e.target.value))}
                    className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-lg text-amber-400 font-bold font-mono text-xs focus:ring-1 focus:ring-amber-500"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Funder (Disbursed By)</label>
                  <select
                    value={newFunder}
                    onChange={(e) => setNewFunder(e.target.value as 'Trevor' | 'Peter')}
                    className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-lg text-amber-300 font-bold text-xs focus:ring-1 focus:ring-amber-500 cursor-pointer"
                  >
                    <option value="Trevor">Trevor (Disbursed by Trevor)</option>
                    <option value="Peter">Peter (Disbursed by Peter)</option>
                  </select>
                </div>
              </div>

              {/* Date Received & Calculated 2-Week Due Date */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Date Disbursed</label>
                  <input
                    type="date"
                    value={newDateReceived}
                    onChange={(e) => setNewDateReceived(e.target.value)}
                    className="w-full py-2 px-3 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono text-xs focus:ring-1 focus:ring-amber-500 cursor-pointer"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-amber-400 mb-1">Due Date (Strictly 2 Weeks)</label>
                  <div className="py-2 px-3 bg-slate-950 border border-amber-500/40 rounded-lg text-amber-400 font-bold font-mono text-xs">
                    {calculateDueDate(newDateReceived)}
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Handling / Safekeeping Fee</label>
                  <input
                    type="number"
                    value={newInterestCharges}
                    onChange={(e) => setNewInterestCharges(Number(e.target.value))}
                    className="w-full py-2 px-3 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono text-xs focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Condition & Notes */}
              <div>
                <label className="block font-bold text-slate-300 mb-1">Condition Description</label>
                <input
                  type="text"
                  value={newCondition}
                  onChange={(e) => setNewCondition(e.target.value)}
                  placeholder="e.g. Scratches on back cover, power cable included, tested functional"
                  className="w-full py-2 px-3 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-amber-500"
                />
              </div>

              {/* Photos Direct Upload */}
              <div className="space-y-2">
                <label className="block font-bold text-slate-300">Upload Appliance Photos Directly</label>
                <div className="flex items-center gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-semibold text-slate-200 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Camera className="w-4 h-4 text-amber-400" />
                    <span>Choose Photos / Camera Capture</span>
                  </button>
                  <span className="text-slate-400 text-xs">
                    {newPhotos.length} photo(s) selected
                  </span>
                </div>

                {newPhotos.length > 0 && (
                  <div className="flex items-center gap-2 overflow-x-auto py-2">
                    {newPhotos.map((p, idx) => (
                      <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-700 shrink-0">
                        <img src={p} alt="preview" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setNewPhotos(newPhotos.filter((_, i) => i !== idx))}
                          className="absolute top-0.5 right-0.5 bg-rose-600 text-white rounded-full p-0.5 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Modal Buttons */}
              <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs cursor-pointer shadow-md"
                >
                  Record Intake & Generate Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* QUICK ADD CUSTOMER MODAL */}
      {isQuickAddCustomerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl p-4 overflow-y-auto">
          <div className="w-full max-w-md glass-panel border border-white/20 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-[#0ABAB5]" />
                <h3 className="font-extrabold text-white text-base">Quick Register Customer</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsQuickAddCustomerOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleQuickAddCustomerSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">Full Customer Name *</label>
                <input
                  type="text"
                  value={quickCustName}
                  onChange={(e) => setQuickCustName(e.target.value)}
                  placeholder="e.g. Peter Njuguna Kariuki"
                  className="w-full py-2.5 px-3 glass-input rounded-xl text-white text-xs focus:outline-none focus:border-[#0ABAB5]"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">National ID / Passport Number *</label>
                <input
                  type="text"
                  value={quickCustIdNumber}
                  onChange={(e) => setQuickCustIdNumber(e.target.value)}
                  placeholder="e.g. 29481920"
                  className="w-full py-2.5 px-3 glass-input rounded-xl text-white font-mono text-xs focus:outline-none focus:border-[#0ABAB5]"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Customer Phone / Tel Number *</label>
                <input
                  type="text"
                  value={quickCustPhone}
                  onChange={(e) => setQuickCustPhone(e.target.value)}
                  placeholder="e.g. 0727108749 or 0180366344"
                  className="w-full py-2.5 px-3 glass-input rounded-xl text-white font-mono text-xs focus:outline-none focus:border-[#0ABAB5]"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Residential Address / Estate (Optional)</label>
                <input
                  type="text"
                  value={quickCustAddress}
                  onChange={(e) => setQuickCustAddress(e.target.value)}
                  placeholder="e.g. Kasarani, Nairobi"
                  className="w-full py-2.5 px-3 glass-input rounded-xl text-white text-xs focus:outline-none focus:border-[#0ABAB5]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsQuickAddCustomerOpen(false)}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold cursor-pointer border border-white/15"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0ABAB5] hover:bg-[#1FD2CD] text-black font-extrabold rounded-xl text-xs cursor-pointer shadow-lg shadow-[#0ABAB5]/20 flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Save & Select Customer</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
