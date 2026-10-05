import React, { useState } from 'react';
import { X, Users, Check, Phone, User, MapPin } from 'lucide-react';
import { sqliteService } from '../../db/sqlite';
import { Customer } from '../../types';

interface MobileAddCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newCust: Customer) => void;
}

export const MobileAddCustomerModal: React.FC<MobileAddCustomerModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [address, setAddress] = useState('Nairobi');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter the customer name.');
      return;
    }
    if (!phone.trim()) {
      setError('Please enter the customer phone number.');
      return;
    }

    const custId = 'cus-' + Date.now();
    const custNumber = sqliteService.getNextSequence('CUS');
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);

    try {
      sqliteService.run(
        `INSERT INTO customers (
          id, customer_number, name, id_number, phone, alt_phone, email,
          address, county, photo_url, id_photo_url, status, notes,
          previous_loans_count, total_borrowed, total_repaid, current_balance,
          defaults_count, created_at, updated_at
        ) VALUES (
          :id, :cnum, :name, :id_number, :phone, :alt_phone, :email,
          :address, :county, :photo, :id_photo, :status, :notes,
          0, 0, 0, 0, 0, :ca, :ua
        )`,
        {
          ':id': custId,
          ':cnum': custNumber,
          ':name': name.trim(),
          ':id_number': idNumber.trim() || 'N/A',
          ':phone': phone.trim(),
          ':alt_phone': 'N/A',
          ':email': '',
          ':address': address.trim() || 'Nairobi, Kenya',
          ':county': 'Nairobi',
          ':photo': null,
          ':id_photo': null,
          ':status': 'Good Standing',
          ':notes': notes.trim() || 'Registered via mobile interface',
          ':ca': nowStr,
          ':ua': nowStr
        }
      );

      const created = sqliteService.getCustomerById(custId);
      if (created) onSuccess(created);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to register customer');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="flex-1" onClick={onClose} />

      <div className="w-full max-h-[85vh] bg-slate-900 border-t border-white/15 rounded-t-3xl shadow-2xl flex flex-col overflow-hidden backdrop-blur-xl animate-in slide-in-from-bottom duration-300">
        <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mt-3 mb-1" />

        <div className="px-5 py-3.5 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-[#0ABAB5]" />
            <h3 className="text-base font-extrabold text-white">Register New Customer</h3>
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

          <div className="space-y-1.5">
            <label className="font-bold uppercase tracking-wider text-slate-400">
              Full Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. John Kamau Mwangi"
              className="w-full px-3.5 py-3 rounded-xl bg-slate-950 border border-white/15 text-sm text-white focus:outline-none focus:border-[#0ABAB5]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="font-bold uppercase tracking-wider text-slate-400">
              Phone Number *
            </label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0722000000"
              className="w-full px-3.5 py-3 rounded-xl bg-slate-950 border border-white/15 text-sm text-white focus:outline-none focus:border-[#0ABAB5]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="font-bold uppercase tracking-wider text-slate-400">
              National ID / Passport Number
            </label>
            <input
              type="text"
              value={idNumber}
              onChange={(e) => setIdNumber(e.target.value)}
              placeholder="e.g. 29384756"
              className="w-full px-3.5 py-3 rounded-xl bg-slate-950 border border-white/15 text-sm text-white focus:outline-none focus:border-[#0ABAB5]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="font-bold uppercase tracking-wider text-slate-400">
              Residential Area / Address
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. Kasarani, Nairobi"
              className="w-full px-3.5 py-3 rounded-xl bg-slate-950 border border-white/15 text-sm text-white focus:outline-none focus:border-[#0ABAB5]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="font-bold uppercase tracking-wider text-slate-400">
              Customer Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any client preferences or notes..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-xs text-white focus:outline-none focus:border-[#0ABAB5]"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-4 rounded-xl bg-[#0ABAB5] hover:bg-[#1FD2CD] text-black font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#0ABAB5]/20 active:scale-98 transition-all"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>Register Customer</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
