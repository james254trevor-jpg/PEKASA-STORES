import React, { useState } from 'react';
import { sqliteService } from '../db/sqlite';
import { Part, StockMovement, Supplier, Appliance } from '../types';
import { formatKES } from '../utils/numbering';
import { useAuth } from '../context/AuthContext';
import { 
  Wrench, 
  Package, 
  Plus, 
  Search, 
  AlertTriangle, 
  ArrowDownCircle, 
  ArrowUpCircle, 
  SlidersHorizontal, 
  X, 
  Check, 
  Layers, 
  Truck,
  RotateCcw
} from 'lucide-react';

export const InventoryPartsView: React.FC = () => {
  const { currentUser } = useAuth();
  const parts = sqliteService.getParts();
  const suppliers = sqliteService.getSuppliers();
  const stockMovements = sqliteService.getStockMovements();
  const appliances = sqliteService.getAppliances();

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [onlyLowStock, setOnlyLowStock] = useState(false);
  const [isNewPartModalOpen, setIsNewPartModalOpen] = useState(false);
  const [isStockMovementModalOpen, setIsStockMovementModalOpen] = useState(false);
  const [selectedPartForMovement, setSelectedPartForMovement] = useState<Part | null>(null);

  // New Part State
  const [sku, setSku] = useState('PRT-' + Math.floor(100 + Math.random() * 900));
  const [partName, setPartName] = useState('');
  const [category, setCategory] = useState('Electronics');
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id || '');
  const [costPrice, setCostPrice] = useState<number>(1500);
  const [sellingPrice, setSellingPrice] = useState<number>(2800);
  const [quantity, setQuantity] = useState<number>(10);
  const [reorderLevel, setReorderLevel] = useState<number>(3);

  // Stock Movement Form State
  const [movementType, setMovementType] = useState<'IN' | 'OUT' | 'ADJUSTMENT'>('IN');
  const [moveQuantity, setMoveQuantity] = useState<number>(5);
  const [moveReason, setMoveReason] = useState('Bulk shipment received');

  // Filter Parts
  const filteredParts = parts.filter((p) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      p.sku.toLowerCase().includes(q) ||
      p.name.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q);

    const matchesCat = categoryFilter === 'ALL' || p.category === categoryFilter;
    const matchesLowStock = !onlyLowStock || p.quantity <= p.reorder_level;

    return matchesSearch && matchesCat && matchesLowStock;
  });

  const handleCreatePart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!partName || !sku) return;

    const id = 'prt-' + Date.now();
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);

    try {
      sqliteService.run(
        `INSERT INTO parts (id, sku, part_name, category, supplier_id, cost_price, selling_price, quantity, reorder_level, created_at, updated_at)
         VALUES (:id, :sku, :pn, :cat, :sid, :cp, :sp, :qty, :rl, :ca, :ca)`,
        {
          ':id': id,
          ':sku': sku.toUpperCase(),
          ':pn': partName,
          ':cat': category,
          ':sid': supplierId || null,
          ':cp': Number(costPrice),
          ':sp': Number(sellingPrice),
          ':qty': Number(quantity),
          ':rl': Number(reorderLevel),
          ':ca': nowStr
        }
      );

      // Log initial movement
      sqliteService.run(
        `INSERT INTO stock_movements (id, part_id, movement_type, quantity, reason, appliance_id, performed_by, created_at)
         VALUES (:id, :pid, 'IN', :qty, 'Initial stock entry', NULL, :pb, :ca)`,
        {
          ':id': 'mov-' + Date.now(),
          ':pid': id,
          ':qty': Number(quantity),
          ':pb': currentUser?.full_name || 'Admin',
          ':ca': nowStr
        }
      );

      setIsNewPartModalOpen(false);
      setPartName('');
      setSku('PRT-' + Math.floor(100 + Math.random() * 900));
    } catch (err: any) {
      alert('Error creating part: ' + err.message);
    }
  };

  const handleStockMovementSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPartForMovement) return;

    try {
      sqliteService.recordStockMovement(
        selectedPartForMovement.id,
        movementType,
        moveQuantity,
        moveReason,
        currentUser?.full_name || 'Admin'
      );
      setIsStockMovementModalOpen(false);
      setSelectedPartForMovement(null);
    } catch (err: any) {
      alert('Error updating stock: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Parts & Stock Inventory</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            SKU management, cost vs selling price margins, low-stock threshold alarms, and appliance repairs link.
          </p>
        </div>

        <button
          onClick={() => setIsNewPartModalOpen(true)}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-md"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Spare Part</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative md:col-span-2">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by SKU, part name, or category..."
              className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          <div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full py-2 px-3 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:ring-1 focus:ring-amber-500 cursor-pointer"
            >
              <option value="ALL">All Categories</option>
              <option value="Electronics">Electronics</option>
              <option value="Refrigeration">Refrigeration</option>
              <option value="Gas & Cooking">Gas & Cooking</option>
              <option value="Appliances">Appliances & Mechanical</option>
              <option value="General Spares">General Spares</option>
            </select>
          </div>

          <div className="flex items-center">
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={onlyLowStock}
                onChange={(e) => setOnlyLowStock(e.target.checked)}
                className="rounded border-slate-700 text-amber-500 focus:ring-amber-500"
              />
              <span className="font-semibold text-amber-400">Show Low-Stock Only</span>
            </label>
          </div>
        </div>
      </div>

      {/* Parts Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase text-[11px] font-semibold bg-slate-950/40">
                <th className="py-3 px-4">SKU</th>
                <th className="py-3 px-4">Part Description</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Supplier</th>
                <th className="py-3 px-4 text-right">Cost Price</th>
                <th className="py-3 px-4 text-right">Selling Price</th>
                <th className="py-3 px-4 text-right">In Stock</th>
                <th className="py-3 px-4 text-right">Reorder Min</th>
                <th className="py-3 px-4">Stock Status</th>
                <th className="py-3 px-4 text-right">Stock Adjust</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredParts.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500">
                    No parts matching filter criteria.
                  </td>
                </tr>
              ) : (
                filteredParts.map((p) => {
                  const sup = suppliers.find((s) => s.id === p.supplier_id);
                  const isLow = p.quantity <= p.reorder_level;
                  return (
                    <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-amber-400 whitespace-nowrap">
                        {p.sku}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap font-medium text-white">
                        {p.part_name}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-400">
                        {p.category}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-300">
                        {sup?.name || 'Local Market'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono-numbers text-slate-400 whitespace-nowrap">
                        {formatKES(p.cost_price)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono-numbers font-bold text-emerald-400 whitespace-nowrap">
                        {formatKES(p.selling_price)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono-numbers font-bold text-white text-sm whitespace-nowrap">
                        {p.quantity}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono-numbers text-slate-400 whitespace-nowrap">
                        {p.reorder_level}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {isLow ? (
                          <span className="inline-flex items-center gap-1 text-rose-400 font-semibold bg-rose-950/60 border border-rose-800/60 px-2 py-0.5 rounded text-[11px]">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Low Stock ({p.quantity} left)</span>
                          </span>
                        ) : (
                          <span className="inline-block text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded text-[11px]">
                            In Stock
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => {
                            setSelectedPartForMovement(p);
                            setIsStockMovementModalOpen(true);
                          }}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-[11px] font-medium transition-colors cursor-pointer"
                        >
                          Stock IN / OUT
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Stock Movements Log */}
      <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-amber-400" />
          <span>Stock Movement Audit Trail (IN / OUT / Repairs)</span>
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                <th className="py-2 px-3">Date</th>
                <th className="py-2 px-3">Part SKU</th>
                <th className="py-2 px-3">Type</th>
                <th className="py-2 px-3 text-right">Quantity</th>
                <th className="py-2 px-3">Reason / Details</th>
                <th className="py-2 px-3">Appliance Link</th>
                <th className="py-2 px-3">Operator</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {stockMovements.slice(0, 8).map((m) => {
                const p = parts.find((pt) => pt.id === m.part_id);
                const app = m.appliance_id ? appliances.find((a) => a.id === m.appliance_id) : null;
                return (
                  <tr key={m.id} className="hover:bg-slate-800/30">
                    <td className="py-2.5 px-3 font-mono text-slate-400 whitespace-nowrap">{m.created_at}</td>
                    <td className="py-2.5 px-3 font-mono font-semibold text-amber-400 whitespace-nowrap">
                      {p?.sku || 'N/A'}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span
                        className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                          m.movement_type === 'IN'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : m.movement_type === 'OUT'
                            ? 'bg-rose-950 text-rose-400 border border-rose-800'
                            : 'bg-amber-950 text-amber-400 border border-amber-800'
                        }`}
                      >
                        {m.movement_type}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono-numbers font-bold text-white whitespace-nowrap">
                      {m.quantity}
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">{m.reason}</td>
                    <td className="py-2.5 px-3 font-mono text-amber-300 text-[11px] whitespace-nowrap">
                      {app ? app.appliance_number : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">{m.performed_by}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* NEW PART MODAL */}
      {isNewPartModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-amber-400" />
                <span>Add Spare Part to Inventory</span>
              </h2>
              <button onClick={() => setIsNewPartModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePart} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Part SKU Code</label>
                  <input
                    type="text"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className="w-full py-2 px-3 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono text-xs focus:ring-1 focus:ring-amber-500"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full py-2 px-3 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-amber-500 cursor-pointer"
                  >
                    <option value="Electronics">Electronics</option>
                    <option value="Refrigeration">Refrigeration</option>
                    <option value="Gas & Cooking">Gas & Cooking</option>
                    <option value="Appliances">Appliances & Mechanical</option>
                    <option value="General Spares">General Spares</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Part Name & Specification</label>
                <input
                  type="text"
                  value={partName}
                  onChange={(e) => setPartName(e.target.value)}
                  placeholder="e.g. 55-inch Universal LED Backlight Strip"
                  className="w-full py-2 px-3 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Supplier</label>
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="w-full py-2 px-3 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-amber-500 cursor-pointer"
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.category})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Buying Cost (KES)</label>
                  <input
                    type="number"
                    value={costPrice}
                    onChange={(e) => setCostPrice(Number(e.target.value))}
                    className="w-full py-2 px-3 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono text-xs focus:ring-1 focus:ring-amber-500"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-white mb-1">Selling / Repair Price (KES)</label>
                  <input
                    type="number"
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(Number(e.target.value))}
                    className="w-full py-2 px-3 bg-slate-950 border border-slate-700 rounded-lg text-emerald-400 font-bold font-mono text-xs focus:ring-1 focus:ring-amber-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Initial Quantity In Stock</label>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="w-full py-2 px-3 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono text-xs focus:ring-1 focus:ring-amber-500"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Low Stock Alert Level</label>
                  <input
                    type="number"
                    value={reorderLevel}
                    onChange={(e) => setReorderLevel(Number(e.target.value))}
                    className="w-full py-2 px-3 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono text-xs focus:ring-1 focus:ring-amber-500"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsNewPartModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs cursor-pointer shadow-md"
                >
                  Save Part to Inventory
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STOCK MOVEMENT MODAL */}
      {isStockMovementModalOpen && selectedPartForMovement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-white text-sm">Stock Movement</h3>
                <p className="text-[11px] text-amber-400 font-mono">
                  {selectedPartForMovement.sku} · {selectedPartForMovement.name}
                </p>
              </div>
              <button onClick={() => setIsStockMovementModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleStockMovementSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">Movement Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['IN', 'OUT', 'ADJUSTMENT'] as const).map((t) => (
                    <button
                      type="button"
                      key={t}
                      onClick={() => setMovementType(t)}
                      className={`py-2 px-3 rounded-lg font-bold text-xs transition-colors cursor-pointer border ${
                        movementType === t
                          ? 'bg-amber-500 text-slate-950 border-amber-400'
                          : 'bg-slate-950 text-slate-300 border-slate-700'
                      }`}
                    >
                      {t === 'IN' ? 'Stock IN (+)' : t === 'OUT' ? 'Stock OUT (-)' : 'Reset / Adjust'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  {movementType === 'ADJUSTMENT' ? 'New Total Quantity' : 'Quantity to Add / Deduct'}
                </label>
                <input
                  type="number"
                  min="1"
                  value={moveQuantity}
                  onChange={(e) => setMoveQuantity(Number(e.target.value))}
                  className="w-full py-2 px-3 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono text-xs focus:ring-1 focus:ring-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Reason / Note</label>
                <input
                  type="text"
                  value={moveReason}
                  onChange={(e) => setMoveReason(e.target.value)}
                  placeholder="e.g. New delivery, damaged unit, counter adjustment"
                  className="w-full py-2 px-3 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs focus:ring-1 focus:ring-amber-500"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsStockMovementModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs cursor-pointer shadow-md"
                >
                  Record Movement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
