import React, { useState } from 'react';
import { 
  Search, 
  ShoppingBag, 
  Plus, 
  Minus, 
  Trash2, 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  CheckCircle2, 
  Printer, 
  Receipt, 
  RotateCcw, 
  Coins, 
  Smartphone, 
  CreditCard, 
  Banknote, 
  X, 
  Package 
} from 'lucide-react';
import { CollateralItem, Customer, PaymentMethod, STORE_NAME, STORE_MOTTO, STORE_TEL } from '../../types';
import { sqliteService } from '../../db/sqlite';
import { formatKES } from '../../utils/numbering';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

export interface CartItem {
  product: CollateralItem;
  quantity: number;
  unitPrice: number;
}

interface MobileSalesPOSProps {
  initialProduct?: CollateralItem | null;
  onClearInitialProduct?: () => void;
  onDone?: () => void;
}

export const MobileSalesPOS: React.FC<MobileSalesPOSProps> = ({
  initialProduct,
  onClearInitialProduct,
  onDone
}) => {
  const { currentUser, businessSettings } = useAuth();
  const { currentAccent } = useTheme();

  // Workflow Step: 'select' (1) -> 'cart' (2) -> 'payment' (3) -> 'completed' (4)
  const [step, setStep] = useState<'select' | 'cart' | 'payment' | 'completed'>(
    initialProduct ? 'cart' : 'select'
  );

  // Cart state
  const [cart, setCart] = useState<CartItem[]>(() => {
    if (initialProduct) {
      const price = Number(initialProduct.estimated_resale_value) || Number(initialProduct.market_value) || 0;
      return [{ product: initialProduct, quantity: 1, unitPrice: price }];
    }
    return [];
  });

  // Search in products
  const [searchQuery, setSearchQuery] = useState('');
  // Customer selection (optional)
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [buyerName, setBuyerName] = useState('Walk-in Customer');
  const [buyerPhone, setBuyerPhone] = useState('');

  // Discount
  const [discountAmount, setDiscountAmount] = useState<number>(0);

  // Payment method & cash received
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [amountReceived, setAmountReceived] = useState<string>('');
  const [mpesaReference, setMpesaReference] = useState('');

  // Completed receipt preview
  const [completedSaleData, setCompletedSaleData] = useState<{
    receiptNumber: string;
    items: CartItem[];
    total: number;
    paid: number;
    change: number;
    paymentMethod: string;
    date: string;
    buyer: string;
  } | null>(null);

  const [showReceiptModal, setShowReceiptModal] = useState(false);

  const allItems = sqliteService.getCollaterals();
  const allCustomers = sqliteService.getCustomers();

  // Filter available products
  const availableProducts = allItems.filter((item) => {
    if (item.status === 'Sold') return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.item_name.toLowerCase().includes(q) ||
      item.collateral_number.toLowerCase().includes(q) ||
      (item.category && item.category.toLowerCase().includes(q))
    );
  });

  const addToCart = (product: CollateralItem) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      const price = Number(product.estimated_resale_value) || Number(product.market_value) || 0;
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { product, quantity: 1, unitPrice: price }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.product.id === productId) {
            const newQty = i.quantity + delta;
            return newQty > 0 ? { ...i, quantity: newQty } : null;
          }
          return i;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((i) => i.product.id !== productId));
  };

  // Calculations
  const subtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const total = Math.max(0, subtotal - discountAmount);
  const parsedReceived = Number(amountReceived) || total;
  const balance = Math.max(0, parsedReceived - total);

  // Complete Sale
  const handleCompleteSale = () => {
    if (cart.length === 0) return;

    const receiptNumber = sqliteService.getNextSequence('RCT');
    const today = new Date().toISOString().split('T')[0];
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);

    try {
      // 1. Mark each product sold and record collateral sale / ledger entry
      cart.forEach((item) => {
        const saleId = 'sal-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
        const purchaseCost = Number(item.product.amount_offered) || Number(item.product.market_value * 0.5) || 0;
        const profit = item.unitPrice - purchaseCost;

        sqliteService.run(
          `INSERT INTO collateral_sales (
            id, sale_number, collateral_id, loan_id, customer_id, branch_id,
            original_market_value, outstanding_loan_balance, selling_price, profit_or_loss,
            buyer_name, buyer_phone, payment_method, payment_reference,
            authorized_by, disposition_reason, sale_date, notes
          ) VALUES (
            :id, :sale_number, :collateral_id, :loan_id, :customer_id, :branch_id,
            :original_market_value, :outstanding_loan_balance, :selling_price, :profit_or_loss,
            :buyer_name, :buyer_phone, :payment_method, :payment_reference,
            :authorized_by, :disposition_reason, :sale_date, :notes
          )`,
          {
            ':id': saleId,
            ':sale_number': sqliteService.getNextSequence('SAL'),
            ':collateral_id': item.product.id,
            ':loan_id': item.product.id,
            ':customer_id': selectedCustomerId || 'cus-walkin',
            ':branch_id': item.product.branch_id || 'br-nairobi',
            ':original_market_value': item.product.market_value || item.unitPrice,
            ':outstanding_loan_balance': 0,
            ':selling_price': item.unitPrice * item.quantity,
            ':profit_or_loss': profit * item.quantity,
            ':buyer_name': buyerName,
            ':buyer_phone': buyerPhone,
            ':payment_method': paymentMethod,
            ':payment_reference': mpesaReference || receiptNumber,
            ':authorized_by': currentUser?.full_name || 'Trevor',
            ':disposition_reason': 'Direct Retail / POS Sale',
            ':sale_date': today,
            ':notes': `POS sale of ${item.product.item_name}`
          }
        );

        // Update item status to Sold
        sqliteService.run('UPDATE collateral_items SET status = :st WHERE id = :id', {
          ':st': 'Sold',
          ':id': item.product.id
        });
      });

      // 2. Record ledger transaction
      sqliteService.run(
        `INSERT INTO ledger_transactions (
          id, transaction_number, receipt_number, branch_id, transaction_type,
          amount, principal_portion, interest_portion, balance_after, payment_method,
          mpesa_reference, received_by, notes, transaction_date, payment_date, created_at
        ) VALUES (
          :id, :txn, :rcpt, :br, :type,
          :amt, :pr, :int, :bal, :pm,
          :mref, :rcvd, :notes, :tdate, :pdate, :ca
        )`,
        {
          ':id': 'txn-' + Date.now(),
          ':txn': sqliteService.getNextSequence('TXN'),
          ':rcpt': receiptNumber,
          ':br': 'br-nairobi',
          ':type': 'COLLATERAL_SALE',
          ':amt': total,
          ':pr': total,
          ':int': 0,
          ':bal': 0,
          ':pm': paymentMethod,
          ':mref': mpesaReference || null,
          ':rcvd': currentUser?.full_name || 'Trevor',
          ':notes': `Mobile POS Sale to ${buyerName}`,
          ':tdate': today,
          ':pdate': today,
          ':ca': nowStr
        }
      );

      // Save completed data
      setCompletedSaleData({
        receiptNumber,
        items: [...cart],
        total,
        paid: parsedReceived,
        change: balance,
        paymentMethod,
        date: today,
        buyer: buyerName
      });

      setStep('completed');
    } catch (e) {
      console.error('POS Sale error:', e);
    }
  };

  const resetSale = () => {
    setCart([]);
    setDiscountAmount(0);
    setAmountReceived('');
    setMpesaReference('');
    setBuyerName('Walk-in Customer');
    setBuyerPhone('');
    setSelectedCustomerId('');
    setCompletedSaleData(null);
    setStep('select');
    if (onClearInitialProduct) onClearInitialProduct();
  };

  const storeName = businessSettings?.business_name || STORE_NAME;
  const storeMotto = businessSettings?.business_motto || STORE_MOTTO;
  const storePhone = businessSettings?.business_phone || STORE_TEL;
  const storeAddress = businessSettings?.business_address || 'Nairobi, Kenya';

  return (
    <div className="space-y-5 pb-28 pt-2">
      {/* Top Header / Progress Indicator */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          {step !== 'select' && step !== 'completed' && (
            <button
              onClick={() => {
                if (step === 'payment') setStep('cart');
                else if (step === 'cart') setStep('select');
              }}
              className="p-1 text-slate-400 hover:text-white rounded-lg -ml-1"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              {step === 'select' && 'New Sale'}
              {step === 'cart' && 'Review Cart'}
              {step === 'payment' && 'Payment'}
              {step === 'completed' && 'Sale Completed'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {step === 'select' && 'Search & select products to add'}
              {step === 'cart' && `${cart.length} product(s) selected`}
              {step === 'payment' && 'Choose payment method & finalize'}
              {step === 'completed' && 'Transaction recorded successfully'}
            </p>
          </div>
        </div>

        {cart.length > 0 && step === 'select' && (
          <button
            onClick={() => setStep('cart')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0ABAB5] text-black font-extrabold text-xs shadow-md shadow-[#0ABAB5]/20"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Cart ({cart.length})</span>
          </button>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SCREEN 1: NEW SALE (Product Selection) */}
      {/* ========================================================================= */}
      {step === 'select' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Product Search Field */}
          <div className="relative">
            <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products to sell..."
              className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-white/70 dark:bg-slate-900/80 border border-slate-200 dark:border-white/15 text-sm text-slate-900 dark:text-white placeholder:text-slate-500 focus:outline-none focus:border-[#0ABAB5] shadow-sm"
            />
          </div>

          {/* Product list */}
          <div className="space-y-3">
            {availableProducts.map((product) => {
              const inCartItem = cart.find((i) => i.product.id === product.id);
              const price = Number(product.estimated_resale_value) || Number(product.market_value) || 0;

              return (
                <div
                  key={product.id}
                  className="p-3.5 rounded-2xl bg-white/70 dark:bg-slate-900/80 border border-slate-200/80 dark:border-white/10 flex items-center justify-between gap-3 shadow-sm"
                >
                  <div className="w-14 h-14 rounded-xl bg-slate-800 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
                    {product.photo_front ? (
                      <img src={product.photo_front} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Package className="w-6 h-6 text-[#0ABAB5]" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-bold text-[#0ABAB5] uppercase tracking-wider">
                      {product.category}
                    </span>
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                      {product.item_name}
                    </h4>
                    <div className="font-black text-sm text-slate-900 dark:text-white mt-0.5">
                      {formatKES(price)}
                    </div>
                  </div>

                  <div>
                    {inCartItem ? (
                      <div className="flex items-center gap-1.5 bg-[#0ABAB5]/10 border border-[#0ABAB5]/30 rounded-xl p-1">
                        <button
                          onClick={() => updateQuantity(product.id, -1)}
                          className="w-7 h-7 rounded-lg bg-white/10 text-slate-200 flex items-center justify-center text-xs font-bold"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-6 text-center font-black text-xs text-[#0ABAB5]">
                          {inCartItem.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(product.id, 1)}
                          className="w-7 h-7 rounded-lg bg-[#0ABAB5] text-black flex items-center justify-center text-xs font-bold"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => addToCart(product)}
                        className="px-3 py-2 rounded-xl bg-white/10 dark:bg-slate-800 hover:bg-[#0ABAB5] hover:text-black border border-white/10 text-slate-200 text-xs font-bold flex items-center gap-1 transition-all active:scale-95"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Sticky Bottom Bar for Cart Checkout */}
          {cart.length > 0 && (
            <div className="fixed bottom-16 left-0 right-0 z-30 p-4 bg-slate-950/90 backdrop-blur-xl border-t border-white/15">
              <div className="max-w-md mx-auto flex items-center justify-between gap-3">
                <div>
                  <span className="text-[11px] text-slate-400 block font-medium">Total:</span>
                  <span className="text-xl font-black text-[#0ABAB5]">{formatKES(subtotal)}</span>
                </div>
                <button
                  onClick={() => setStep('cart')}
                  className="py-3 px-5 rounded-xl bg-[#0ABAB5] hover:bg-[#1FD2CD] text-black font-extrabold text-sm flex items-center gap-2 shadow-lg shadow-[#0ABAB5]/20 active:scale-95 transition-all"
                >
                  <span>Review Cart ({cart.length})</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SCREEN 2: CART (Review & Discount) */}
      {/* ========================================================================= */}
      {step === 'cart' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* Cart Item Cards */}
          <div className="space-y-3">
            {cart.map((item) => (
              <div
                key={item.product.id}
                className="p-4 rounded-2xl bg-white/70 dark:bg-slate-900/80 border border-slate-200 dark:border-white/10 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                      {item.product.item_name}
                    </h4>
                    <span className="text-xs text-slate-400 block">
                      {item.product.collateral_number}
                    </span>
                  </div>
                  <button
                    onClick={() => removeFromCart(item.product.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-white/5">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQuantity(item.product.id, -1)}
                      className="w-8 h-8 rounded-lg bg-white/10 dark:bg-slate-800 text-slate-200 flex items-center justify-center font-bold"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-6 text-center font-black text-sm text-slate-900 dark:text-white">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.product.id, 1)}
                      className="w-8 h-8 rounded-lg bg-[#0ABAB5] text-black flex items-center justify-center font-bold"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block">Subtotal</span>
                    <span className="text-sm font-black text-slate-900 dark:text-white">
                      {formatKES(item.unitPrice * item.quantity)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Customer Assignment (Optional) */}
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Customer Details (Optional)
            </label>
            <div className="space-y-2">
              <input
                type="text"
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
                placeholder="Customer Name"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/15 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#0ABAB5]"
              />
              <input
                type="tel"
                value={buyerPhone}
                onChange={(e) => setBuyerPhone(e.target.value)}
                placeholder="Phone Number (e.g. 07...)"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/15 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#0ABAB5]"
              />
            </div>
          </div>

          {/* Discount Input */}
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300">Discount (KSh):</span>
            <input
              type="number"
              min="0"
              value={discountAmount || ''}
              onChange={(e) => setDiscountAmount(Math.max(0, Number(e.target.value) || 0))}
              placeholder="0"
              className="w-28 px-3 py-1.5 text-right rounded-xl bg-slate-900 border border-white/15 text-sm font-bold text-white focus:outline-none focus:border-[#0ABAB5]"
            />
          </div>

          {/* Summary Card */}
          <div className="p-5 rounded-2xl bg-white/5 border border-white/15 space-y-2.5">
            <div className="flex justify-between text-xs text-slate-400">
              <span>Subtotal:</span>
              <span className="font-bold text-slate-200">{formatKES(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-xs text-rose-400">
                <span>Discount:</span>
                <span>-{formatKES(discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between items-baseline pt-2 border-t border-white/10">
              <span className="text-sm font-bold uppercase tracking-wider text-white">Total:</span>
              <span className="text-2xl font-black text-[#0ABAB5]">{formatKES(total)}</span>
            </div>
          </div>

          {/* Proceed to Payment Button */}
          <button
            onClick={() => setStep('payment')}
            className="w-full py-4 rounded-2xl bg-[#0ABAB5] hover:bg-[#1FD2CD] text-black font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#0ABAB5]/25 active:scale-98 transition-all"
          >
            <span>Proceed to Payment</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SCREEN 3: PAYMENT METHOD & FINAL SALE */}
      {/* ========================================================================= */}
      {step === 'payment' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* Total Due Banner */}
          <div className="p-6 rounded-3xl bg-slate-900 border border-white/15 text-center space-y-1">
            <span className="text-xs uppercase font-bold text-slate-400 tracking-wider">
              Total Amount Due
            </span>
            <div className="text-3xl font-black text-[#0ABAB5] tracking-tight">
              {formatKES(total)}
            </div>
          </div>

          {/* Choose Payment Method */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
              Select Payment Method
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { id: 'Cash', label: 'Cash', icon: Banknote },
                { id: 'M-Pesa', label: 'M-Pesa', icon: Smartphone },
                { id: 'Card', label: 'Card', icon: CreditCard },
                { id: 'Bank', label: 'Other', icon: Coins }
              ].map((m) => {
                const Icon = m.icon;
                const isSelected = paymentMethod === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setPaymentMethod(m.id as any)}
                    className={`p-4 rounded-2xl border text-left flex items-center gap-3 transition-all ${
                      isSelected
                        ? 'bg-[#0ABAB5] text-black border-[#0ABAB5] font-black shadow-lg shadow-[#0ABAB5]/20'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    <span className="text-sm font-bold">{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* M-Pesa Code Input if M-Pesa chosen */}
          {paymentMethod === 'M-Pesa' && (
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
              <label className="text-xs font-bold uppercase text-slate-400">
                M-Pesa Confirmation Code (Optional)
              </label>
              <input
                type="text"
                value={mpesaReference}
                onChange={(e) => setMpesaReference(e.target.value.toUpperCase())}
                placeholder="e.g. SLK8927891"
                className="w-full px-3.5 py-3 rounded-xl bg-slate-900 border border-white/15 text-sm text-white font-mono uppercase focus:outline-none focus:border-[#0ABAB5]"
              />
            </div>
          )}

          {/* Amount Received Input */}
          <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Amount Received (KSh)
            </label>
            <input
              type="number"
              value={amountReceived}
              onChange={(e) => setAmountReceived(e.target.value)}
              placeholder={total.toString()}
              className="w-full px-4 py-3.5 rounded-xl bg-slate-900 border border-white/15 text-xl font-black text-white focus:outline-none focus:border-[#0ABAB5]"
            />

            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/10 text-center text-xs">
              <div>
                <span className="text-slate-400 block text-[10px]">Total:</span>
                <span className="font-bold text-white mt-0.5 block">{formatKES(total)}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Paid:</span>
                <span className="font-bold text-white mt-0.5 block">{formatKES(parsedReceived)}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Balance / Change:</span>
                <span className="font-black text-emerald-400 mt-0.5 block">{formatKES(balance)}</span>
              </div>
            </div>
          </div>

          {/* Large Complete Sale Button */}
          <button
            onClick={handleCompleteSale}
            className="w-full py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-base flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20 active:scale-98 transition-all cursor-pointer"
          >
            <Check className="w-5 h-5 stroke-[3]" />
            <span>Complete Sale</span>
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SCREEN 4: SALE COMPLETED ✓ */}
      {/* ========================================================================= */}
      {step === 'completed' && completedSaleData && (
        <div className="space-y-6 animate-in zoom-in-95 duration-200 text-center py-4">
          <div className="w-16 h-16 rounded-full bg-emerald-500/15 border-2 border-emerald-500 text-emerald-400 flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/20">
            <Check className="w-8 h-8 stroke-[3]" />
          </div>

          <div className="space-y-1">
            <h3 className="text-2xl font-black text-white">Sale Completed ✓</h3>
            <p className="text-xs text-slate-400 font-mono">
              Receipt #{completedSaleData.receiptNumber}
            </p>
          </div>

          {/* Receipt quick summary card */}
          <div className="p-5 rounded-2xl bg-white/5 border border-white/10 text-left text-xs space-y-2 max-w-sm mx-auto">
            <div className="flex justify-between">
              <span className="text-slate-400">Total Paid:</span>
              <span className="font-black text-emerald-400 text-sm">
                {formatKES(completedSaleData.total)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Payment Method:</span>
              <span className="font-bold text-white">{completedSaleData.paymentMethod}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Customer:</span>
              <span className="font-bold text-white">{completedSaleData.buyer}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Items Sold:</span>
              <span className="font-bold text-white">{completedSaleData.items.length} item(s)</span>
            </div>
          </div>

          {/* Action Buttons: View Receipt, Print, New Sale */}
          <div className="space-y-2.5 max-w-sm mx-auto pt-2">
            <button
              onClick={() => setShowReceiptModal(true)}
              className="w-full py-3.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-bold text-xs flex items-center justify-center gap-2"
            >
              <Receipt className="w-4 h-4 text-[#0ABAB5]" />
              <span>View Receipt</span>
            </button>

            <button
              onClick={() => window.print()}
              className="w-full py-3.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-bold text-xs flex items-center justify-center gap-2"
            >
              <Printer className="w-4 h-4 text-amber-400" />
              <span>Print Receipt</span>
            </button>

            <button
              onClick={resetSale}
              className="w-full py-4 rounded-xl bg-[#0ABAB5] hover:bg-[#1FD2CD] text-black font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#0ABAB5]/20"
            >
              <Plus className="w-4 h-4" />
              <span>New Sale</span>
            </button>
          </div>
        </div>
      )}

      {/* Receipt Preview Modal */}
      {showReceiptModal && completedSaleData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in">
          <div className="w-full max-w-sm bg-white text-black p-6 rounded-3xl font-mono text-xs space-y-4 shadow-2xl relative">
            <button
              onClick={() => setShowReceiptModal(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-500 hover:text-black"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center space-y-1 border-b border-black pb-3">
              <h3 className="font-black text-base uppercase tracking-wider">{storeName}</h3>
              <p className="text-[10px] italic text-slate-700">"{storeMotto}"</p>
              <p className="text-[10px] font-bold">Tel: {storePhone} · {storeAddress}</p>
            </div>

            <div className="space-y-1 border-b border-dashed border-slate-400 pb-3">
              <div className="flex justify-between font-bold">
                <span>Receipt:</span>
                <span>{completedSaleData.receiptNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>Date:</span>
                <span>{completedSaleData.date}</span>
              </div>
              <div className="flex justify-between">
                <span>Customer:</span>
                <span>{completedSaleData.buyer}</span>
              </div>
              <div className="flex justify-between">
                <span>Method:</span>
                <span>{completedSaleData.paymentMethod}</span>
              </div>
            </div>

            <div className="space-y-1 border-b border-black pb-3">
              {completedSaleData.items.map((it) => (
                <div key={it.product.id} className="flex justify-between">
                  <span className="truncate max-w-[180px]">{it.product.item_name} x{it.quantity}</span>
                  <span className="font-bold">{formatKES(it.unitPrice * it.quantity)}</span>
                </div>
              ))}
            </div>

            <div className="space-y-1">
              <div className="flex justify-between font-black text-sm">
                <span>TOTAL:</span>
                <span>{formatKES(completedSaleData.total)}</span>
              </div>
              <div className="flex justify-between">
                <span>Paid:</span>
                <span>{formatKES(completedSaleData.paid)}</span>
              </div>
              <div className="flex justify-between">
                <span>Change:</span>
                <span>{formatKES(completedSaleData.change)}</span>
              </div>
            </div>

            <div className="text-center text-[10px] text-slate-600 pt-2 border-t border-dashed border-slate-400">
              <p>Thank you for choosing {storeName}!</p>
              <p>* Official System Receipt *</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
