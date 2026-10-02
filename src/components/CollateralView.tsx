import React, { useState } from 'react';
import { sqliteService } from '../db/sqlite';
import { 
  CollateralItem, 
  CollateralCategory, 
  COLLATERAL_CATEGORIES, 
  Customer, 
  STORE_NAME 
} from '../types';
import { formatKES } from '../utils/numbering';
import { 
  Package, 
  Plus, 
  Search, 
  MapPin, 
  Camera, 
  AlertTriangle, 
  CheckCircle2, 
  Tv, 
  Laptop, 
  Smartphone, 
  Cpu, 
  ShieldCheck, 
  Tag, 
  X, 
  Upload, 
  Layers, 
  FileText,
  Eye,
  Trash2,
  Users
} from 'lucide-react';

interface CollateralViewProps {
  selectedBranchId: string;
  initialSelectedCollateralId?: string | null;
  onSelectCustomer?: (customerId: string) => void;
  onOpenNewLoanForCollateral?: (collateralId: string) => void;
  onOpenAddCustomerWithItems?: () => void;
}

export const CollateralView: React.FC<CollateralViewProps> = ({
  selectedBranchId,
  initialSelectedCollateralId,
  onSelectCustomer,
  onOpenNewLoanForCollateral,
  onOpenAddCustomerWithItems
}) => {
  const collaterals = sqliteService.getCollaterals(selectedBranchId);
  const customers = sqliteService.getCustomers();
  const branches = sqliteService.getBranches();

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedCollateralId, setSelectedCollateralId] = useState<string | null>(
    initialSelectedCollateralId || collaterals[0]?.id || null
  );

  // New Collateral Modal State
  const [isIntakeModalOpen, setIsIntakeModalOpen] = useState(false);
  const [newCustomerId, setNewCustomerId] = useState<string>(customers[0]?.id || '');
  const [newCategory, setNewCategory] = useState<CollateralCategory>('TV');
  const [newCustomCategory, setNewCustomCategory] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [newBrand, setNewBrand] = useState('');
  const [newModel, setNewModel] = useState('');
  const [newSerialNumber, setNewSerialNumber] = useState('');
  const [newImei1, setNewImei1] = useState('');
  const [newImei2, setNewImei2] = useState('');
  const [newColour, setNewColour] = useState('');
  const [newCondition, setNewCondition] = useState('Fully functional, normal cosmetic wear');
  const [newAge, setNewAge] = useState('Approx. 1 Year');
  const [newAccessories, setNewAccessories] = useState('Original power cable, remote, desktop stand');

  // TV specific
  const [newTvScreenSize, setNewTvScreenSize] = useState('55 inch');
  const [newTvRemoteIncluded, setNewTvRemoteIncluded] = useState(true);
  const [newTvStandIncluded, setNewTvStandIncluded] = useState(true);

  // Laptop specific
  const [newLaptopProcessor, setNewLaptopProcessor] = useState('Intel Core i5 11th Gen');
  const [newLaptopRam, setNewLaptopRam] = useState('16GB DDR4');
  const [newLaptopStorage, setNewLaptopStorage] = useState('512GB NVMe SSD');
  const [newLaptopCharger, setNewLaptopCharger] = useState(true);
  const [newLaptopBatteryCondition, setNewLaptopBatteryCondition] = useState('Good (4+ hours backup)');

  // Valuation & LTV
  const [newMarketValue, setNewMarketValue] = useState<number>(45000);
  const [newAmountOffered, setNewAmountOffered] = useState<number>(25000);
  const [newOriginalPurchasePrice, setNewOriginalPurchasePrice] = useState<number>(65000);

  // Physical Location
  const [newStorageRoom, setNewStorageRoom] = useState('Warehouse A');
  const [newRackShelf, setNewRackShelf] = useState('Rack B3 / Shelf 7');
  const [newSecurityTag, setNewSecurityTag] = useState('SEC-' + Math.floor(1000 + Math.random() * 9000));

  // Photos
  const [photoFront, setPhotoFront] = useState<string>('');
  const [photoBack, setPhotoBack] = useState<string>('');
  const [photoSerial, setPhotoSerial] = useState<string>('');
  const [photoDamage, setPhotoDamage] = useState<string>('');
  const [photoAccessories, setPhotoAccessories] = useState<string>('');

  // Duplicate IMEI / Serial detection
  const duplicateCheck = sqliteService.checkDuplicateSerialOrImei(newSerialNumber, newImei1);

  // LTV calculation
  const ltvValuation = sqliteService.calculateMaxLoan(newCategory, newMarketValue);
  const isAboveLTV = newAmountOffered > ltvValuation.maxAllowedLoan;

  const selectedItem = collaterals.find((c) => c.id === selectedCollateralId);
  const selectedItemCustomer = selectedItem ? customers.find((c) => c.id === selectedItem.customer_id) : null;

  const filteredCollaterals = collaterals.filter((item) => {
    const cust = customers.find((c) => c.id === item.customer_id);
    const q = searchQuery.toLowerCase().trim();

    const matchesSearch = !q ||
      item.collateral_number.toLowerCase().includes(q) ||
      item.item_name.toLowerCase().includes(q) ||
      item.brand.toLowerCase().includes(q) ||
      item.model.toLowerCase().includes(q) ||
      item.rack_shelf.toLowerCase().includes(q) ||
      (item.serial_number && item.serial_number.toLowerCase().includes(q)) ||
      (item.imei_1 && item.imei_1.includes(q)) ||
      (cust && (cust.name.toLowerCase().includes(q) || cust.phone.includes(q)));

    const matchesCat = categoryFilter === 'ALL' || item.category === categoryFilter;
    const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter;

    return matchesSearch && matchesCat && matchesStatus;
  });

  const handleCreateCollateral = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerId || !newBrand.trim() || !newModel.trim()) {
      alert('Please fill in Customer, Brand, and Model.');
      return;
    }

    const colId = 'col-' + Date.now();
    const colCode = sqliteService.getNextSequence('COL');
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const today = new Date().toISOString().split('T')[0];

    const fullName = newItemName.trim() || `${newBrand.trim()} ${newModel.trim()} (${newCategory})`;

    try {
      sqliteService.run(
        `INSERT INTO collateral_items (
          id, collateral_number, customer_id, branch_id, category, custom_category, item_name, brand, model,
          serial_number, imei_1, imei_2, colour, condition, age, accessories_included,
          tv_screen_size, tv_remote_included, tv_stand_included,
          laptop_processor, laptop_ram, laptop_storage, laptop_charger, laptop_battery_condition,
          original_purchase_price, market_value, estimated_resale_value, max_allowed_loan, amount_offered,
          storage_room, rack_shelf, security_tag, photo_front, photo_back, photo_serial, photo_damage, photo_accessories,
          status, date_received, created_at, updated_at
        ) VALUES (
          :id, :col_num, :cid, :brid, :cat, :ccat, :name, :brand, :model,
          :serial, :imei1, :imei2, :colour, :cond, :age, :acc,
          :tv_size, :tv_rem, :tv_stand,
          :lap_cpu, :lap_ram, :lap_sto, :lap_chg, :lap_bat,
          :orig_pr, :mkt_val, :resale_val, :max_loan, :amt_off,
          :room, :rack, :tag, :p_front, :p_back, :p_serial, :p_damage, :p_acc,
          'Held (Active Loan)', :d_recv, :now, :now
        )`,
        {
          ':id': colId,
          ':col_num': colCode,
          ':cid': newCustomerId,
          ':brid': selectedBranchId === 'ALL' ? 'br-nairobi' : selectedBranchId,
          ':cat': newCategory,
          ':ccat': newCategory === 'Other Collateral' ? newCustomCategory : null,
          ':name': fullName,
          ':brand': newBrand.trim(),
          ':model': newModel.trim(),
          ':serial': newSerialNumber.trim() || null,
          ':imei1': newImei1.trim() || null,
          ':imei2': newImei2.trim() || null,
          ':colour': newColour.trim() || null,
          ':cond': newCondition.trim(),
          ':age': newAge.trim() || null,
          ':acc': newAccessories.trim() || 'None',
          ':tv_size': newCategory === 'TV' ? newTvScreenSize : null,
          ':tv_rem': newCategory === 'TV' && newTvRemoteIncluded ? 1 : 0,
          ':tv_stand': newCategory === 'TV' && newTvStandIncluded ? 1 : 0,
          ':lap_cpu': newCategory === 'Laptop/PC' ? newLaptopProcessor : null,
          ':lap_ram': newCategory === 'Laptop/PC' ? newLaptopRam : null,
          ':lap_sto': newCategory === 'Laptop/PC' ? newLaptopStorage : null,
          ':lap_chg': newCategory === 'Laptop/PC' && newLaptopCharger ? 1 : 0,
          ':lap_bat': newCategory === 'Laptop/PC' ? newLaptopBatteryCondition : null,
          ':orig_pr': Number(newOriginalPurchasePrice) || null,
          ':mkt_val': Number(newMarketValue),
          ':resale_val': Math.round(Number(newMarketValue) * 0.85),
          ':max_loan': ltvValuation.maxAllowedLoan,
          ':amt_off': Number(newAmountOffered),
          ':room': newStorageRoom,
          ':rack': newRackShelf,
          ':tag': newSecurityTag,
          ':p_front': photoFront || null,
          ':p_back': photoBack || null,
          ':p_serial': photoSerial || null,
          ':p_damage': photoDamage || null,
          ':p_acc': photoAccessories || null,
          ':d_recv': today,
          ':now': nowStr
        }
      );

      sqliteService.logAudit(
        'Staff',
        'INTAKE_COLLATERAL',
        'COLLATERAL',
        colId,
        `Intaked collateral ${colCode}: ${fullName}. Location: ${newStorageRoom} -> ${newRackShelf}`
      );

      setIsIntakeModalOpen(false);
      setSelectedCollateralId(colId);

      alert(`Collateral Item ${colCode} registered successfully in ${newStorageRoom} (${newRackShelf})!`);
    } catch (err: any) {
      alert('Error saving collateral item: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-panel p-5 rounded-3xl border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black tracking-tight text-white uppercase">
              Collateral Storage Vault & Valuation
            </h1>
            <span className="text-[11px] font-mono font-bold text-[#0ABAB5] bg-[#0ABAB5]/10 border border-[#0ABAB5]/30 px-2.5 py-0.5 rounded-full">
              {collaterals.length} Items in Custody
            </span>
          </div>
          <p className="text-xs text-slate-300 mt-1">
            Exact shelf/rack storage locations, category electronics specs, IMEI duplicate protection, and condition evidence photos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {onOpenAddCustomerWithItems && (
            <button
              onClick={onOpenAddCustomerWithItems}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-extrabold rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer border border-white/15"
              title="Add Customer Details & Intake Collateral in One Screen"
            >
              <Users className="w-4 h-4 text-[#0ABAB5]" />
              <span>+ Add Customer & Item</span>
            </button>
          )}

          <button
            onClick={() => setIsIntakeModalOpen(true)}
            className="px-4 py-2.5 bg-[#0ABAB5] hover:bg-[#1FD2CD] text-black font-extrabold rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-[#0ABAB5]/20"
          >
            <Plus className="w-4 h-4" />
            <span>Intake New Collateral Item</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-panel p-4 rounded-2xl border border-white/10 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative md:col-span-2">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Collateral (COL-...), Serial, IMEI, Rack Shelf (e.g. Rack B3), Brand, Customer..."
              className="w-full pl-10 pr-4 py-2.5 glass-input rounded-xl text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-[#0ABAB5]"
            />
          </div>

          <div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full py-2.5 px-3 glass-input rounded-xl text-xs text-white focus:outline-none focus:border-[#0ABAB5] cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900">All Categories</option>
              {COLLATERAL_CATEGORIES.map((cat) => (
                <option key={cat} value={cat} className="bg-slate-900">{cat}</option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full py-2.5 px-3 glass-input rounded-xl text-xs text-white focus:outline-none focus:border-[#0ABAB5] cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900">All Custody Statuses</option>
              <option value="Held (Active Loan)" className="bg-slate-900">Held (Active Loan)</option>
              <option value="Redeemed" className="bg-slate-900">Redeemed</option>
              <option value="Available for Sale" className="bg-slate-900">Available for Sale</option>
              <option value="Sold" className="bg-slate-900">Sold</option>
            </select>
          </div>
        </div>
      </div>

      {/* Split Grid: Collateral Catalog on Left, Storage & Spec Card on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 space-y-3">
          <div className="glass-panel rounded-2xl overflow-hidden border border-white/10 divide-y divide-white/5 max-h-[720px] overflow-y-auto">
            {filteredCollaterals.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                No collateral items found matching criteria.
              </div>
            ) : (
              filteredCollaterals.map((item) => {
                const isSelected = item.id === selectedCollateralId;
                const cust = customers.find((c) => c.id === item.customer_id);

                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedCollateralId(item.id)}
                    className={`p-4 cursor-pointer transition-all flex items-center justify-between gap-3 ${
                      isSelected ? 'bg-[#0ABAB5]/15 border-l-4 border-[#0ABAB5]' : 'hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-[#0ABAB5] text-xs">{item.collateral_number}</span>
                        <span className="font-bold text-white text-xs truncate">{item.item_name}</span>
                      </div>

                      <div className="text-[11px] text-slate-300 flex items-center gap-2">
                        <span className="bg-white/5 px-2 py-0.5 rounded font-mono text-slate-300 border border-white/10">{item.category}</span>
                        <span className="text-slate-400 truncate">Client: <strong className="text-white">{cust?.name || 'Customer'}</strong></span>
                      </div>

                      <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5 pt-0.5">
                        <MapPin className="w-3 h-3 text-[#0ABAB5]" />
                        <span>{item.storage_room} → <strong className="text-white">{item.rack_shelf}</strong></span>
                        {item.security_tag && <span className="text-[#0ABAB5]">[{item.security_tag}]</span>}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full block mb-1 ${
                        item.status === 'Held (Active Loan)' ? 'bg-emerald-500/20 text-emerald-300' :
                        item.status === 'Available for Sale' ? 'bg-purple-500/20 text-purple-300' :
                        item.status === 'Redeemed' ? 'bg-blue-500/20 text-blue-300' :
                        'bg-white/10 text-slate-300'
                      }`}>
                        {item.status}
                      </span>
                      <div className="text-xs font-mono-numbers font-black text-white">
                        {formatKES(item.market_value)}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Detail Card: Specs, Photos, Exact Physical Location */}
        <div className="lg:col-span-6">
          {selectedItem ? (
            <div className="glass-panel p-6 rounded-3xl border border-white/10 space-y-5">
              <div className="flex items-start justify-between border-b border-white/10 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-black text-white">{selectedItem.item_name}</span>
                    <span className="font-mono text-xs font-bold text-[#0ABAB5] bg-[#0ABAB5]/10 px-2 py-0.5 rounded border border-[#0ABAB5]/30">
                      {selectedItem.collateral_number}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Category: <strong className="text-white">{selectedItem.category}</strong> · Brand: {selectedItem.brand} {selectedItem.model}
                  </p>
                </div>

                <span className={`px-2.5 py-1 rounded-xl text-xs font-bold font-mono ${
                  selectedItem.status === 'Held (Active Loan)' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                  selectedItem.status === 'Available for Sale' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' :
                  'bg-white/10 text-slate-300'
                }`}>
                  {selectedItem.status}
                </span>
              </div>

              {/* Physical Storage Location Box */}
              <div className="p-4 rounded-2xl bg-black/40 border border-[#0ABAB5]/30 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#0ABAB5]/15 border border-[#0ABAB5]/30 flex items-center justify-center text-[#0ABAB5]">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Physical Custody Location:</span>
                    <div className="text-sm font-black text-white font-mono">
                      {selectedItem.storage_room} → {selectedItem.rack_shelf}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-slate-400 uppercase block">Security Tag Code:</span>
                  <span className="font-mono font-bold text-[#0ABAB5] text-xs">
                    {selectedItem.security_tag || 'SEC-VERIFIED'}
                  </span>
                </div>
              </div>

              {/* Technical Specifications */}
              <div className="p-4 rounded-2xl bg-black/30 border border-white/10 space-y-2 text-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Detailed Item Specifications & Accessories
                </span>

                <div className="grid grid-cols-2 gap-2 text-slate-300">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Serial Number:</span>
                    <strong className="font-mono text-white">{selectedItem.serial_number || 'N/A'}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">IMEI 1 / IMEI 2:</span>
                    <strong className="font-mono text-white">{selectedItem.imei_1 || 'N/A'} {selectedItem.imei_2 ? `· ${selectedItem.imei_2}` : ''}</strong>
                  </div>
                  {selectedItem.category === 'TV' && (
                    <>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Screen Size:</span>
                        <strong className="text-white">{selectedItem.tv_screen_size || 'N/A'}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Accessories Included:</span>
                        <strong className="text-white">{selectedItem.tv_remote_included ? 'Remote Included · ' : ''} {selectedItem.tv_stand_included ? 'Stand Included' : ''}</strong>
                      </div>
                    </>
                  )}
                  {selectedItem.category === 'Laptop/PC' && (
                    <>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Processor & RAM:</span>
                        <strong className="text-white">{selectedItem.laptop_processor} · {selectedItem.laptop_ram}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Storage & Battery:</span>
                        <strong className="text-white">{selectedItem.laptop_storage} · {selectedItem.laptop_battery_condition}</strong>
                      </div>
                    </>
                  )}
                </div>

                <div className="pt-2 border-t border-white/10 text-slate-300">
                  <span className="text-[10px] text-slate-400 block">Physical Condition Inspection:</span>
                  <p className="italic">"{selectedItem.condition}"</p>
                </div>
              </div>

              {/* Valuation & LTV Limits */}
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-black/40 border border-white/10">
                  <span className="text-[10px] text-slate-400 block">Market Valuation:</span>
                  <div className="font-mono-numbers font-black text-white text-sm mt-0.5">
                    {formatKES(selectedItem.market_value)}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-black/40 border border-white/10">
                  <span className="text-[10px] text-slate-400 block">Max Allowable Loan:</span>
                  <div className="font-mono-numbers font-black text-[#0ABAB5] text-sm mt-0.5">
                    {formatKES(selectedItem.max_allowed_loan)}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-black/40 border border-white/10">
                  <span className="text-[10px] text-slate-400 block">Amount Offered:</span>
                  <div className="font-mono-numbers font-black text-emerald-400 text-sm mt-0.5">
                    {formatKES(selectedItem.amount_offered)}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="glass-panel p-12 rounded-3xl border border-white/10 text-center text-slate-400">
              <Package className="w-12 h-12 mx-auto mb-3 text-slate-600" />
              <p className="text-sm">Select an item from the catalog to inspect physical storage and specs.</p>
            </div>
          )}
        </div>
      </div>

      {/* INTAKE NEW COLLATERAL MODAL */}
      {isIntakeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xl p-4 overflow-y-auto">
          <div className="w-full max-w-2xl glass-panel border border-white/20 rounded-3xl shadow-2xl p-6 space-y-5 my-6 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-[#0ABAB5]" />
                <h3 className="font-extrabold text-white text-base">Intake Collateral Item into Storage Vault</h3>
              </div>
              <button onClick={() => setIsIntakeModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCollateral} className="space-y-4 text-xs">
              {/* Pawner Selection */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-bold text-slate-300">Select Pawner / Customer *</label>
                  {onOpenAddCustomerWithItems && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsIntakeModalOpen(false);
                        onOpenAddCustomerWithItems();
                      }}
                      className="text-[10px] text-[#0ABAB5] hover:underline font-bold font-mono cursor-pointer"
                    >
                      + Register New Customer & Item Together
                    </button>
                  )}
                </div>
                <select
                  value={newCustomerId}
                  onChange={(e) => setNewCustomerId(e.target.value)}
                  className="w-full py-2.5 px-3 glass-input rounded-xl text-white text-xs focus:outline-none focus:border-[#0ABAB5] cursor-pointer"
                  required
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id} className="bg-slate-900 text-white">
                      {c.name} (ID: {c.id_number} · Tel: {c.phone})
                    </option>
                  ))}
                </select>
              </div>

              {/* Category */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Collateral Category *</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as CollateralCategory)}
                    className="w-full py-2.5 px-3 glass-input rounded-xl text-white text-xs focus:outline-none focus:border-[#0ABAB5] cursor-pointer"
                  >
                    {COLLATERAL_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat} className="bg-slate-900">{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Brand Name *</label>
                  <input
                    type="text"
                    value={newBrand}
                    onChange={(e) => setNewBrand(e.target.value)}
                    placeholder="e.g. Samsung, HP, Sony, Ramtons, Apple"
                    className="w-full py-2.5 px-3 glass-input rounded-xl text-white text-xs focus:outline-none focus:border-[#0ABAB5]"
                    required
                  />
                </div>
              </div>

              {/* Model & Colour */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Model / Specification *</label>
                  <input
                    type="text"
                    value={newModel}
                    onChange={(e) => setNewModel(e.target.value)}
                    placeholder="e.g. 55-inch 4K UHD Smart / EliteBook 840 G6"
                    className="w-full py-2.5 px-3 glass-input rounded-xl text-white text-xs focus:outline-none focus:border-[#0ABAB5]"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Colour / Finish</label>
                  <input
                    type="text"
                    value={newColour}
                    onChange={(e) => setNewColour(e.target.value)}
                    placeholder="e.g. Black, Silver Metal, Space Grey"
                    className="w-full py-2.5 px-3 glass-input rounded-xl text-white text-xs focus:outline-none focus:border-[#0ABAB5]"
                  />
                </div>
              </div>

              {/* Serial & IMEI with Real-time Duplicate Detection */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Serial Number (Electronics)</label>
                  <input
                    type="text"
                    value={newSerialNumber}
                    onChange={(e) => setNewSerialNumber(e.target.value)}
                    placeholder="e.g. SN-98124982"
                    className="w-full py-2.5 px-3 glass-input rounded-xl text-white font-mono text-xs focus:outline-none focus:border-[#0ABAB5]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">IMEI 1 (Smartphones/Tablets)</label>
                  <input
                    type="text"
                    value={newImei1}
                    onChange={(e) => setNewImei1(e.target.value)}
                    placeholder="e.g. 354891028471928"
                    className="w-full py-2.5 px-3 glass-input rounded-xl text-white font-mono text-xs focus:outline-none focus:border-[#0ABAB5]"
                  />
                </div>
              </div>

              {/* Duplicate Detection Warning Banner */}
              {duplicateCheck.hasDuplicate && (
                <div className="p-3 bg-rose-950/60 border border-rose-500 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400" />
                  <span>{duplicateCheck.message}</span>
                </div>
              )}

              {/* Category-Specific Electronics Fields */}
              {newCategory === 'TV' && (
                <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Screen Size</label>
                    <input
                      type="text"
                      value={newTvScreenSize}
                      onChange={(e) => setNewTvScreenSize(e.target.value)}
                      placeholder="e.g. 43 inch, 55 inch"
                      className="w-full py-2 px-2.5 glass-input rounded-lg text-white text-xs"
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-4">
                    <input
                      type="checkbox"
                      id="remoteCheck"
                      checked={newTvRemoteIncluded}
                      onChange={(e) => setNewTvRemoteIncluded(e.target.checked)}
                      className="w-4 h-4 accent-[#0ABAB5]"
                    />
                    <label htmlFor="remoteCheck" className="text-white text-xs cursor-pointer font-bold">Remote Included</label>
                  </div>
                  <div className="flex items-center gap-2 pt-4">
                    <input
                      type="checkbox"
                      id="standCheck"
                      checked={newTvStandIncluded}
                      onChange={(e) => setNewTvStandIncluded(e.target.checked)}
                      className="w-4 h-4 accent-[#0ABAB5]"
                    />
                    <label htmlFor="standCheck" className="text-white text-xs cursor-pointer font-bold">Stand Included</label>
                  </div>
                </div>
              )}

              {newCategory === 'Laptop/PC' && (
                <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Processor</label>
                    <input
                      type="text"
                      value={newLaptopProcessor}
                      onChange={(e) => setNewLaptopProcessor(e.target.value)}
                      className="w-full py-1.5 px-2 glass-input rounded text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">RAM</label>
                    <input
                      type="text"
                      value={newLaptopRam}
                      onChange={(e) => setNewLaptopRam(e.target.value)}
                      className="w-full py-1.5 px-2 glass-input rounded text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Storage</label>
                    <input
                      type="text"
                      value={newLaptopStorage}
                      onChange={(e) => setNewLaptopStorage(e.target.value)}
                      className="w-full py-1.5 px-2 glass-input rounded text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Battery</label>
                    <input
                      type="text"
                      value={newLaptopBatteryCondition}
                      onChange={(e) => setNewLaptopBatteryCondition(e.target.value)}
                      className="w-full py-1.5 px-2 glass-input rounded text-xs text-white"
                    />
                  </div>
                </div>
              )}

              {/* Valuation & Safe LTV Calculation */}
              <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white uppercase text-[11px]">Item Valuation & Max Loan Limit</span>
                  <span className="text-[11px] font-mono text-[#0ABAB5] font-bold">Category LTV: {ltvValuation.maxLTVPercent}%</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-bold mb-1">Current Market Value (KES) *</label>
                    <input
                      type="number"
                      value={newMarketValue}
                      onChange={(e) => setNewMarketValue(Number(e.target.value))}
                      className="w-full py-2.5 px-3 glass-input rounded-xl text-white font-mono text-sm font-bold focus:outline-none focus:border-[#0ABAB5]"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-bold mb-1">Loan Amount Offered (KES) *</label>
                    <input
                      type="number"
                      value={newAmountOffered}
                      onChange={(e) => setNewAmountOffered(Number(e.target.value))}
                      className="w-full py-2.5 px-3 glass-input rounded-xl text-[#0ABAB5] font-mono font-black text-sm focus:outline-none focus:border-[#0ABAB5]"
                      required
                    />
                  </div>
                </div>

                {isAboveLTV && (
                  <div className="text-rose-300 font-bold text-[11px] flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    <span>⚠️ Loan of {formatKES(newAmountOffered)} is above configured {ltvValuation.maxLTVPercent}% limit (Max: {formatKES(ltvValuation.maxAllowedLoan)}).</span>
                  </div>
                )}
              </div>

              {/* Physical Storage Assignment */}
              <div className="p-4 rounded-2xl bg-black/40 border border-[#0ABAB5]/30 space-y-3">
                <span className="font-bold text-white uppercase text-[11px] flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-[#0ABAB5]" />
                  <span>Physical Storage Assignment (In-Store Location) *</span>
                </span>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-300 mb-1">Storage Room / Safe</label>
                    <input
                      type="text"
                      value={newStorageRoom}
                      onChange={(e) => setNewStorageRoom(e.target.value)}
                      placeholder="Warehouse A, Safe 02"
                      className="w-full py-2 px-2.5 glass-input rounded-xl text-white text-xs"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1">Shelf / Rack / Locker Number</label>
                    <input
                      type="text"
                      value={newRackShelf}
                      onChange={(e) => setNewRackShelf(e.target.value)}
                      placeholder="Rack B3 / Shelf 7"
                      className="w-full py-2 px-2.5 glass-input rounded-xl text-white text-xs"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1">Security Tag</label>
                    <input
                      type="text"
                      value={newSecurityTag}
                      onChange={(e) => setNewSecurityTag(e.target.value)}
                      placeholder="SEC-9842"
                      className="w-full py-2 px-2.5 glass-input rounded-xl text-white font-mono text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsIntakeModalOpen(false)}
                  className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold cursor-pointer border border-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-[#0ABAB5] hover:bg-[#1FD2CD] text-black font-extrabold rounded-xl text-xs cursor-pointer shadow-lg shadow-[#0ABAB5]/20 flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm Vault Intake</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
