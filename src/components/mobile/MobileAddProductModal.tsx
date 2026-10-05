import React, { useState } from 'react';
import { X, Package, Check, Camera, DollarSign, Tag } from 'lucide-react';
import { COLLATERAL_CATEGORIES, CollateralCategory, STORE_NAME } from '../../types';
import { sqliteService } from '../../db/sqlite';
import { useAuth } from '../../context/AuthContext';

interface MobileAddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newItem: any) => void;
}

export const MobileAddProductModal: React.FC<MobileAddProductModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const { currentUser } = useAuth();

  const [itemName, setItemName] = useState('');
  const [category, setCategory] = useState<CollateralCategory>('TV');
  const [condition, setCondition] = useState('Good Condition');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [rackLocation, setRackLocation] = useState('Shelf A1');
  const [photoFront, setPhotoFront] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setPhotoFront(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim()) {
      setError('Please enter the product name.');
      return;
    }

    const priceNum = Number(sellingPrice) || 0;
    const purchaseNum = Number(purchasePrice) || 0;
    if (priceNum <= 0) {
      setError('Please enter a valid selling price.');
      return;
    }

    const itemId = 'col-' + Date.now();
    const colNumber = sqliteService.getNextSequence('COL');
    const today = new Date().toISOString().split('T')[0];
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);

    try {
      sqliteService.run(
        `INSERT INTO collateral_items (
          id, collateral_number, customer_id, branch_id, category, item_name,
          brand, model, condition, accessories_included, original_purchase_price,
          market_value, estimated_resale_value, max_allowed_loan, amount_offered,
          storage_room, rack_shelf, security_tag, photo_front, status, date_received,
          notes, created_at, updated_at
        ) VALUES (
          :id, :cnum, :cid, :bid, :cat, :name,
          :brand, :model, :cond, :acc, :opp,
          :mv, :erv, :mal, :ao,
          :room, :shelf, :tag, :photo, :status, :dr,
          :notes, :ca, :ua
        )`,
        {
          ':id': itemId,
          ':cnum': colNumber,
          ':cid': 'cus-stock',
          ':bid': 'br-nairobi',
          ':cat': category,
          ':name': itemName.trim(),
          ':brand': brand.trim() || 'N/A',
          ':model': model.trim() || 'N/A',
          ':cond': condition,
          ':acc': 'Standard accessories included',
          ':opp': purchaseNum,
          ':mv': priceNum,
          ':erv': priceNum,
          ':mal': Math.round(priceNum * 0.5),
          ':ao': purchaseNum,
          ':room': 'Main Vault',
          ':shelf': rackLocation,
          ':tag': colNumber,
          ':photo': photoFront || null,
          ':status': 'Available for Sale',
          ':dr': today,
          ':notes': notes.trim() || 'Intake directly via mobile terminal',
          ':ca': nowStr,
          ':ua': nowStr
        }
      );

      const newItem = sqliteService.getCollateralById(itemId);
      onSuccess(newItem);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save product');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="flex-1" onClick={onClose} />

      <div className="w-full max-h-[90vh] bg-slate-900 border-t border-white/15 rounded-t-3xl shadow-2xl flex flex-col overflow-hidden backdrop-blur-xl animate-in slide-in-from-bottom duration-300">
        <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mt-3 mb-1" />

        <div className="px-5 py-3.5 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-[#0ABAB5]" />
            <h3 className="text-base font-extrabold text-white">Add Product to Inventory</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 font-semibold">
              {error}
            </div>
          )}

          {/* Photo Upload Area */}
          <div className="space-y-1.5">
            <label className="font-bold uppercase tracking-wider text-slate-400">
              Product Photo (Optional)
            </label>
            <div className="flex items-center gap-3">
              <div className="w-20 h-20 rounded-2xl bg-slate-800 border border-white/15 flex items-center justify-center overflow-hidden shrink-0">
                {photoFront ? (
                  <img src={photoFront} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Package className="w-8 h-8 text-slate-500" />
                )}
              </div>
              <label className="cursor-pointer px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white font-bold flex items-center gap-2">
                <Camera className="w-4 h-4 text-[#0ABAB5]" />
                <span>Upload Photo</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Product Name */}
          <div className="space-y-1.5">
            <label className="font-bold uppercase tracking-wider text-slate-400">
              Product Name *
            </label>
            <input
              type="text"
              required
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder='e.g. Samsung 55" 4K Smart TV'
              className="w-full px-3.5 py-3 rounded-xl bg-slate-950 border border-white/15 text-sm text-white focus:outline-none focus:border-[#0ABAB5]"
            />
          </div>

          {/* Category & Condition */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="font-bold uppercase tracking-wider text-slate-400">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full px-3 py-3 rounded-xl bg-slate-950 border border-white/15 text-xs text-white focus:outline-none focus:border-[#0ABAB5]"
              >
                {COLLATERAL_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold uppercase tracking-wider text-slate-400">
                Condition
              </label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                className="w-full px-3 py-3 rounded-xl bg-slate-950 border border-white/15 text-xs text-white focus:outline-none focus:border-[#0ABAB5]"
              >
                <option value="Like New">Like New</option>
                <option value="Good Condition">Good Condition</option>
                <option value="Fair Condition">Fair Condition</option>
                <option value="Refurbished">Refurbished</option>
              </select>
            </div>
          </div>

          {/* Pricing */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="font-bold uppercase tracking-wider text-slate-400">
                Selling Price (KSh) *
              </label>
              <input
                type="number"
                required
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
                placeholder="45000"
                className="w-full px-3.5 py-3 rounded-xl bg-slate-950 border border-white/15 text-sm font-bold text-white focus:outline-none focus:border-[#0ABAB5]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold uppercase tracking-wider text-slate-400">
                Purchase Cost (KSh)
              </label>
              <input
                type="number"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                placeholder="30000"
                className="w-full px-3.5 py-3 rounded-xl bg-slate-950 border border-white/15 text-sm font-bold text-white focus:outline-none focus:border-[#0ABAB5]"
              />
            </div>
          </div>

          {/* Brand & Model */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="font-bold uppercase tracking-wider text-slate-400">
                Brand
              </label>
              <input
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="e.g. Sony"
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-xs text-white focus:outline-none focus:border-[#0ABAB5]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold uppercase tracking-wider text-slate-400">
                Shelf Location
              </label>
              <input
                type="text"
                value={rackLocation}
                onChange={(e) => setRackLocation(e.target.value)}
                placeholder="Rack B1"
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-xs text-white focus:outline-none focus:border-[#0ABAB5]"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="font-bold uppercase tracking-wider text-slate-400">
              Notes & Inclusions
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Includes remote control, wall bracket and power cable..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-xs text-white focus:outline-none focus:border-[#0ABAB5]"
            />
          </div>

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-4 rounded-xl bg-[#0ABAB5] hover:bg-[#1FD2CD] text-black font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#0ABAB5]/20 active:scale-98 transition-all"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>Save & Add to Stock</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
