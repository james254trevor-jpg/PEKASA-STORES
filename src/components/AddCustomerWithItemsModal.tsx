import React, { useState, useRef } from 'react';
import { sqliteService } from '../db/sqlite';
import { 
  Customer, 
  CollateralCategory, 
  COLLATERAL_CATEGORIES, 
  STORE_NAME, 
  STORE_TEL 
} from '../types';
import { formatKES, calculateLoanDueDate, calculateMaturityDate } from '../utils/numbering';
import { downloadPawnTicketPDF } from '../utils/pdfGenerator';
import { generateWhatsAppLink, createLoanDisbursalMessage } from '../utils/messaging';
import { useAuth } from '../context/AuthContext';
import { 
  Users, 
  Package, 
  Coins, 
  Camera, 
  Clock, 
  Calendar, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  MapPin, 
  Printer, 
  X, 
  Upload, 
  Trash2, 
  DollarSign,
  Tv,
  Laptop,
  CreditCard,
  MessageSquare
} from 'lucide-react';

interface AddCustomerWithItemsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (customerId: string, loanId: string, collateralId: string) => void;
  defaultBranchId?: string;
}

export const AddCustomerWithItemsModal: React.FC<AddCustomerWithItemsModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  defaultBranchId = 'br-nairobi'
}) => {
  const { currentUser } = useAuth();

  // Active step / tab in the modal: 1 = Customer, 2 = Collateral, 3 = Valuation & Loan
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);

  // Success modal state with created objects
  const [createdData, setCreatedData] = useState<{
    customer: Customer;
    collateral: any;
    loan: any;
  } | null>(null);

  // Hidden file inputs
  const customerPhotoRef = useRef<HTMLInputElement>(null);
  const customerPhotoCameraRef = useRef<HTMLInputElement>(null);
  const idDocumentPhotoRef = useRef<HTMLInputElement>(null);
  const idDocumentCameraRef = useRef<HTMLInputElement>(null);
  const photoFrontRef = useRef<HTMLInputElement>(null);
  const photoFrontCameraRef = useRef<HTMLInputElement>(null);
  const photoBackRef = useRef<HTMLInputElement>(null);
  const photoSerialRef = useRef<HTMLInputElement>(null);
  const photoDamageRef = useRef<HTMLInputElement>(null);

  // Image compressor helper
  const processImageFile = (file: File, callback: (base64Url: string) => void) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 500;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.82);
          callback(compressed);
        } else {
          callback(e.target?.result as string);
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // --- STEP 1: CUSTOMER DETAILS ---
  const [name, setName] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [phone, setPhone] = useState('+254 ');
  const [altPhone, setAltPhone] = useState('N/A');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('Kombani');
  const [county, setCounty] = useState('Kwale');
  const [notes, setNotes] = useState('');
  const [customerPhoto, setCustomerPhoto] = useState<string>('');
  const [idPhoto, setIdPhoto] = useState<string>('');
  
  // Previous loan history options with N/A
  const [isPrevLoansNA, setIsPrevLoansNA] = useState(true);
  const [prevLoansCount, setPrevLoansCount] = useState<number>(0);
  const [isTotalBorrowedNA, setIsTotalBorrowedNA] = useState(true);
  const [totalBorrowedAmount, setTotalBorrowedAmount] = useState<number>(0);
  const [isTotalRepaidNA, setIsTotalRepaidNA] = useState(true);
  const [totalRepaidAmount, setTotalRepaidAmount] = useState<number>(0);

  // --- STEP 2: COLLATERAL ITEM DETAILS ---
  const [category, setCategory] = useState<CollateralCategory>('TV');
  const [customCategory, setCustomCategory] = useState('');
  const [itemName, setItemName] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [imei1, setImei1] = useState('');
  const [imei2, setImei2] = useState('');
  const [colour, setColour] = useState('');
  const [condition, setCondition] = useState('Good working condition, tested at counter');
  const [age, setAge] = useState('Approx. 1 Year');
  const [accessories, setAccessories] = useState('Original power cable, remote / accessories');
  
  // Electronics specific
  const [tvScreenSize, setTvScreenSize] = useState('55 inch');
  const [tvRemoteIncluded, setTvRemoteIncluded] = useState(true);
  const [tvStandIncluded, setTvStandIncluded] = useState(true);

  const [laptopProcessor, setLaptopProcessor] = useState('Intel Core i5');
  const [laptopRam, setLaptopRam] = useState('8GB DDR4');
  const [laptopStorage, setLaptopStorage] = useState('256GB SSD');
  const [laptopCharger, setLaptopCharger] = useState(true);
  const [laptopBattery, setLaptopBattery] = useState('Good (3+ hours backup)');

  // Physical Location in Store
  const [storageRoom, setStorageRoom] = useState('Warehouse A');
  const [rackShelf, setRackShelf] = useState('Rack B3 / Shelf 7');
  const [securityTag, setSecurityTag] = useState('SEC-' + Math.floor(1000 + Math.random() * 9000));

  // Collateral Photos
  const [photoFront, setPhotoFront] = useState<string>('');
  const [photoBack, setPhotoBack] = useState<string>('');
  const [photoSerial, setPhotoSerial] = useState<string>('');
  const [photoDamage, setPhotoDamage] = useState<string>('');

  // Duplicate IMEI / Serial detection
  const duplicateCheck = sqliteService.checkDuplicateSerialOrImei(serialNumber, imei1);

  // --- STEP 3: VALUATION, STRICT 2-WEEK LOAN & 30% INTEREST ---
  const [marketValue, setMarketValue] = useState<number>(40000);
  const [loanPrincipal, setLoanPrincipal] = useState<number>(20000);
  
  // STRICT REQUIREMENT: Standard 30% per two-week cycle
  const [interestRatePercent, setInterestRatePercent] = useState<number>(30); // 30% per 2 weeks
  const [storageFee, setStorageFee] = useState<number>(0);
  
  // STRICT REQUIREMENT: Maximum 2 weeks (14 days)
  const [termDays, setTermDays] = useState<number>(14); // Strictly max 14 days
  const [dateReceived, setDateReceived] = useState<string>(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState<string>(calculateLoanDueDate(new Date().toISOString().split('T')[0], 14));
  const [gracePeriodDays, setGracePeriodDays] = useState<number>(7);

  // Capital Funder & Disbursement
  const [funder, setFunder] = useState<'Trevor' | 'Peter'>(
    currentUser?.username?.toLowerCase() === 'peter' ? 'Peter' : 'Trevor'
  );
  const [disbursementMethod, setDisbursementMethod] = useState<'Cash' | 'M-Pesa' | 'Bank'>('M-Pesa');
  const [disbursementRef, setDisbursementRef] = useState<string>(
    'QHK' + Math.floor(1000000 + Math.random() * 9000000)
  );

  // LTV calculation
  const ltvValuation = sqliteService.calculateMaxLoan(category, marketValue);
  const isAboveLTV = loanPrincipal > ltvValuation.maxAllowedLoan;

  // Real-time automatic calculations for 30% interest and 2 weeks
  const calculatedInterestAmount = Math.round((loanPrincipal * interestRatePercent) / 100);
  const calculatedTotalDue = Number(loanPrincipal) + calculatedInterestAmount + Number(storageFee);
  const calculatedMaturityDate = calculateMaturityDate(dueDate, gracePeriodDays);

  // When principal changes, recalculate default 30% interest
  const handlePrincipalChange = (val: number) => {
    setLoanPrincipal(val);
  };

  // When market value changes, suggest 50% as safe starting principal
  const handleMarketValueChange = (val: number) => {
    setMarketValue(val);
    const suggested = Math.round(val * 0.5);
    setLoanPrincipal(suggested);
  };

  // Date received changes -> strictly recalculate due date with capped term days (max 14 days)
  const handleDateReceivedChange = (dateVal: string) => {
    setDateReceived(dateVal);
    setDueDate(calculateLoanDueDate(dateVal, termDays));
  };

  // Term days changed: strictly capped at maximum 14 days (2 weeks)
  const handleTermDaysChange = (days: number) => {
    const capped = Math.min(14, Math.max(1, days));
    setTermDays(capped);
    setDueDate(calculateLoanDueDate(dateReceived, capped));
  };

  // Submission Handler
  const handleSubmitAll = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !idNumber.trim() || !phone.trim()) {
      alert('Please fill in Customer Full Name, National ID, and Phone Number.');
      setActiveStep(1);
      return;
    }

    if (!brand.trim() || !model.trim()) {
      alert('Please enter Brand Name and Model for the collateral item.');
      setActiveStep(2);
      return;
    }

    if (loanPrincipal <= 0) {
      alert('Please specify a valid loan principal amount.');
      setActiveStep(3);
      return;
    }

    // STRICT CHECK: Collateral term must not exceed 14 days (2 weeks)
    if (termDays > 14) {
      alert('Collateral term cannot exceed the maximum allowed period of 2 weeks (14 days).');
      setTermDays(14);
      return;
    }

    try {
      const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
      const custId = 'cust-' + Date.now();
      const colId = 'col-' + Date.now();
      const loanId = 'ln-' + Date.now();
      const appId = 'app-' + Date.now();

      const custCode = sqliteService.getNextSequence('CUS');
      const colCode = sqliteService.getNextSequence('COL');
      const loanCode = sqliteService.getNextSequence('LN');
      const appCode = sqliteService.getNextSequence('APP');
      const txnCode = sqliteService.getNextSequence('TXN');
      const rctCode = sqliteService.getNextSequence('RCT');

      const fullItemTitle = itemName.trim() || `${brand.trim()} ${model.trim()} ${category}`;
      const branchId = defaultBranchId === 'ALL' ? 'br-nairobi' : defaultBranchId;

      // 1. Insert Customer
      sqliteService.run(
        `INSERT INTO customers (
          id, customer_number, name, id_number, phone, alt_phone, email, address, county,
          photo_url, id_photo_url, status, notes, previous_loans_count, total_borrowed,
          total_repaid, current_balance, defaults_count, created_at, updated_at
        ) VALUES (
          :id, :cnum, :name, :id_number, :phone, :alt_phone, :email, :address, :county,
          :photo_url, :id_photo_url, :status, :notes, :plc, :tb, :tr, :cb, :dc, :created_at, :updated_at
        )`,
        {
          ':id': custId,
          ':cnum': custCode,
          ':name': name.trim(),
          ':id_number': idNumber.trim(),
          ':phone': phone.trim(),
          ':alt_phone': altPhone.trim() || 'N/A',
          ':email': email.trim() || null,
          ':address': address.trim() || null,
          ':county': county.trim() || 'Nairobi',
          ':photo_url': customerPhoto || null,
          ':id_photo_url': idPhoto || null,
          ':status': 'Good Standing',
          ':notes': notes.trim() || null,
          ':plc': isPrevLoansNA ? 1 : prevLoansCount + 1,
          ':tb': isTotalBorrowedNA ? Number(loanPrincipal) : totalBorrowedAmount + Number(loanPrincipal),
          ':tr': isTotalRepaidNA ? 0 : totalRepaidAmount,
          ':cb': calculatedTotalDue,
          ':dc': 0,
          ':created_at': nowStr,
          ':updated_at': nowStr
        }
      );

      // 2. Insert Collateral Item in Vault
      sqliteService.run(
        `INSERT INTO collateral_items (
          id, collateral_number, customer_id, branch_id, category, custom_category, item_name, brand, model,
          serial_number, imei_1, imei_2, colour, condition, age, accessories_included,
          tv_screen_size, tv_remote_included, tv_stand_included,
          laptop_processor, laptop_ram, laptop_storage, laptop_charger, laptop_battery_condition,
          original_purchase_price, market_value, estimated_resale_value, max_allowed_loan, amount_offered,
          storage_room, rack_shelf, security_tag, photo_front, photo_back, photo_serial, photo_damage,
          status, date_received, notes, created_at, updated_at
        ) VALUES (
          :id, :col_num, :cid, :brid, :cat, :ccat, :name, :brand, :model,
          :serial, :imei1, :imei2, :colour, :cond, :age, :acc,
          :tv_size, :tv_rem, :tv_stand,
          :lap_cpu, :lap_ram, :lap_sto, :lap_chg, :lap_bat,
          :orig_pr, :mkt_val, :resale_val, :max_loan, :amt_off,
          :room, :rack, :tag, :p_front, :p_back, :p_serial, :p_damage,
          'Held (Active Loan)', :d_recv, :notes, :now, :now
        )`,
        {
          ':id': colId,
          ':col_num': colCode,
          ':cid': custId,
          ':brid': branchId,
          ':cat': category,
          ':ccat': category === 'Other Collateral' ? customCategory : null,
          ':name': fullItemTitle,
          ':brand': brand.trim(),
          ':model': model.trim(),
          ':serial': serialNumber.trim() || null,
          ':imei1': imei1.trim() || null,
          ':imei2': imei2.trim() || null,
          ':colour': colour.trim() || null,
          ':cond': condition.trim(),
          ':age': age.trim() || null,
          ':acc': accessories.trim() || 'None',
          ':tv_size': category === 'TV' ? tvScreenSize : null,
          ':tv_rem': category === 'TV' && tvRemoteIncluded ? 1 : 0,
          ':tv_stand': category === 'TV' && tvStandIncluded ? 1 : 0,
          ':lap_cpu': category === 'Laptop/PC' ? laptopProcessor : null,
          ':lap_ram': category === 'Laptop/PC' ? laptopRam : null,
          ':lap_sto': category === 'Laptop/PC' ? laptopStorage : null,
          ':lap_chg': category === 'Laptop/PC' && laptopCharger ? 1 : 0,
          ':lap_bat': category === 'Laptop/PC' ? laptopBattery : null,
          ':orig_pr': Math.round(Number(marketValue) * 1.3),
          ':mkt_val': Number(marketValue),
          ':resale_val': Math.round(Number(marketValue) * 0.85),
          ':max_loan': ltvValuation.maxAllowedLoan,
          ':amt_off': Number(loanPrincipal),
          ':room': storageRoom,
          ':rack': rackShelf,
          ':tag': securityTag,
          ':p_front': photoFront || null,
          ':p_back': photoBack || null,
          ':p_serial': photoSerial || null,
          ':p_damage': photoDamage || null,
          ':d_recv': dateReceived,
          ':notes': `Intake handled by Director ${funder}`,
          ':now': nowStr
        }
      );

      // 3. Insert Rehani Loan (Strict 30% interest per 2 weeks & max 14 days)
      sqliteService.run(
        `INSERT INTO rehani_loans (
          id, loan_number, customer_id, collateral_id, branch_id, principal_amount,
          interest_rate_percent, interest_amount, storage_fee, total_amount_due,
          amount_paid, balance_remaining, term_days, issue_date, due_date,
          grace_period_days, maturity_date, funder, disbursement_method,
          disbursement_reference, status, staff_issuer, notes, created_at, updated_at
        ) VALUES (
          :id, :lnum, :cid, :colid, :brid, :principal,
          :irate, :iamt, :sfee, :tdue,
          0, :bal, :tdays, :idate, :ddate,
          :gdays, :mdate, :funder, :dmethod,
          :dref, 'ACTIVE', :staff, :notes, :now, :now
        )`,
        {
          ':id': loanId,
          ':lnum': loanCode,
          ':cid': custId,
          ':colid': colId,
          ':brid': branchId,
          ':principal': Number(loanPrincipal),
          ':irate': interestRatePercent,
          ':iamt': calculatedInterestAmount,
          ':sfee': Number(storageFee),
          ':tdue': calculatedTotalDue,
          ':bal': calculatedTotalDue,
          ':tdays': termDays,
          ':idate': dateReceived,
          ':ddate': dueDate,
          ':gdays': gracePeriodDays,
          ':mdate': calculatedMaturityDate,
          ':funder': funder,
          ':dmethod': disbursementMethod,
          ':dref': disbursementRef,
          ':staff': funder,
          ':notes': `Loan issued by ${funder} for ${fullItemTitle}. 30% 2-week interest rate applied.`,
          ':now': nowStr
        }
      );

      // 4. Insert into Appliances table (Backward compatibility)
      sqliteService.run(
        `INSERT INTO appliances (
          id, appliance_number, customer_id, category, custom_category, brand, model,
          serial_number, condition, market_value, amount_received, funder, date_received,
          due_date, status, technician_name, interest_charges, notes, created_at, updated_at
        ) VALUES (
          :id, :app_num, :cid, :cat, :ccat, :brand, :model,
          :serial, :cond, :mkt_val, :amt_recv, :funder, :d_recv,
          :due_date, 'Active Collateral / Pawn', :funder, :icharge, :notes, :now, :now
        )`,
        {
          ':id': appId,
          ':app_num': appCode,
          ':cid': custId,
          ':cat': category,
          ':ccat': category === 'Other Collateral' ? customCategory : null,
          ':brand': brand.trim(),
          ':model': model.trim(),
          ':serial': serialNumber.trim() || null,
          ':cond': condition.trim(),
          ':mkt_val': Number(marketValue),
          ':amt_recv': Number(loanPrincipal),
          ':funder': funder,
          ':d_recv': dateReceived,
          ':due_date': dueDate,
          ':icharge': calculatedInterestAmount,
          ':notes': notes.trim() || null,
          ':now': nowStr
        }
      );

      // 5. Insert Ledger Transaction (Disbursal record)
      sqliteService.run(
        `INSERT INTO ledger_transactions (
          id, transaction_number, receipt_number, loan_id, collateral_id, customer_id,
          branch_id, transaction_type, amount, principal_portion, interest_portion,
          balance_after, payment_method, mpesa_reference, received_by, notes, transaction_date, created_at
        ) VALUES (
          :id, :tnum, :rnum, :lid, :colid, :cid,
          :brid, 'Loan Disbursed', :amt, :amt, 0,
          :bal, :method, :mref, :recv, :notes, :tdate, :now
        )`,
        {
          ':id': 'txn-' + Date.now(),
          ':tnum': txnCode,
          ':rnum': rctCode,
          ':lid': loanId,
          ':colid': colId,
          ':cid': custId,
          ':brid': branchId,
          ':amt': Number(loanPrincipal),
          ':bal': calculatedTotalDue,
          ':method': disbursementMethod,
          ':mref': disbursementRef,
          ':recv': funder,
          ':notes': `Cash/M-Pesa advance of KES ${loanPrincipal} disbursed by Director ${funder}`,
          ':tdate': dateReceived,
          ':now': nowStr
        }
      );

      // 6. Log Audit Trail
      sqliteService.logAudit(
        funder,
        'INTAKE_CUSTOMER_AND_COLLATERAL',
        'LOAN',
        loanId,
        `Director ${funder} onboarded customer ${name} (${custCode}), registered collateral ${colCode} (${fullItemTitle} at ${storageRoom} -> ${rackShelf}), and disbursed loan ${loanCode} KES ${loanPrincipal} (30% interest: KES ${calculatedInterestAmount}, Term: ${termDays} days, Due: ${dueDate})`
      );

      // Set created data for instant receipt download / ticket printing
      const createdCustomerObj: Customer = {
        id: custId,
        customer_number: custCode,
        name: name.trim(),
        id_number: idNumber.trim(),
        phone: phone.trim(),
        alt_phone: altPhone.trim() || 'N/A',
        email: email.trim(),
        address: address.trim(),
        county: county.trim(),
        status: 'Good Standing',
        notes: notes.trim(),
        previous_loans_count: 1,
        total_borrowed: Number(loanPrincipal),
        total_repaid: 0,
        current_balance: calculatedTotalDue,
        defaults_count: 0,
        created_at: nowStr,
        updated_at: nowStr
      };

      const createdCollateralObj = {
        id: colId,
        collateral_number: colCode,
        customer_id: custId,
        branch_id: branchId,
        category: category,
        item_name: fullItemTitle,
        brand: brand.trim(),
        model: model.trim(),
        serial_number: serialNumber.trim(),
        imei_1: imei1.trim(),
        market_value: Number(marketValue),
        storage_room: storageRoom,
        rack_shelf: rackShelf,
        security_tag: securityTag,
        status: 'Held (Active Loan)',
        date_received: dateReceived,
        created_at: nowStr,
        updated_at: nowStr
      };

      const createdLoanObj = {
        id: loanId,
        loan_number: loanCode,
        customer_id: custId,
        collateral_id: colId,
        branch_id: branchId,
        principal_amount: Number(loanPrincipal),
        interest_rate_percent: interestRatePercent,
        interest_amount: calculatedInterestAmount,
        storage_fee: Number(storageFee),
        total_amount_due: calculatedTotalDue,
        amount_paid: 0,
        balance_remaining: calculatedTotalDue,
        term_days: termDays,
        issue_date: dateReceived,
        due_date: dueDate,
        grace_period_days: gracePeriodDays,
        maturity_date: calculatedMaturityDate,
        funder: funder,
        disbursement_method: disbursementMethod,
        disbursement_reference: disbursementRef,
        status: 'ACTIVE' as const,
        renewals_count: 0,
        staff_issuer: funder,
        notes: notes.trim(),
        created_at: nowStr,
        updated_at: nowStr
      };

      setCreatedData({
        customer: createdCustomerObj,
        collateral: createdCollateralObj,
        loan: createdLoanObj
      });

      if (onSuccess) {
        onSuccess(custId, loanId, colId);
      }

    } catch (err: any) {
      alert('Error registering customer and collateral: ' + err.message);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xl p-0 sm:p-4 overflow-y-auto">
      <div className="w-full h-full sm:h-auto max-w-4xl glass-panel border border-white/20 sm:rounded-3xl shadow-2xl p-4 sm:p-6 space-y-6 sm:my-6 max-h-screen sm:max-h-[94vh] overflow-y-auto">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-[#0ABAB5]/15 border border-[#0ABAB5]/40 flex items-center justify-center text-[#0ABAB5]">
                <Package className="w-4 h-4" />
              </span>
              <div>
                <h2 className="text-lg font-black text-white uppercase tracking-tight">
                  Add Customer Details & Intake Collateral
                </h2>
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <span>Rehani / Pawn Management Flow</span>
                  <span>·</span>
                  <span className="text-[#0ABAB5] font-bold font-mono">Max 2 Weeks Term · 30% Interest</span>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/10 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* If successfully created, show complete summary & Pawn Ticket Download */}
        {createdData ? (
          <div className="space-y-6 text-center py-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center mx-auto text-emerald-400">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-black text-white">
                Rehani Onboarding Complete!
              </h3>
              <p className="text-xs text-slate-300 max-w-md mx-auto">
                Customer, collateral vault storage, and Rehani loan have been registered permanently into SQLite.
              </p>
            </div>

            {/* Generated Codes Matrix */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto text-left text-xs">
              <div className="p-3.5 bg-black/40 border border-white/10 rounded-2xl">
                <span className="text-[10px] text-slate-400 block uppercase">Customer Number</span>
                <span className="font-mono font-bold text-white text-sm">{createdData.customer.customer_number}</span>
                <div className="text-slate-300 font-semibold mt-1 truncate">{createdData.customer.name}</div>
              </div>

              <div className="p-3.5 bg-black/40 border border-[#0ABAB5]/30 rounded-2xl">
                <span className="text-[10px] text-[#0ABAB5] block uppercase font-bold">Collateral Tag</span>
                <span className="font-mono font-bold text-[#0ABAB5] text-sm">{createdData.collateral.collateral_number}</span>
                <div className="text-slate-300 text-[11px] mt-1 truncate">{createdData.collateral.item_name}</div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">{createdData.collateral.storage_room} → {createdData.collateral.rack_shelf}</div>
              </div>

              <div className="p-3.5 bg-black/40 border border-white/10 rounded-2xl">
                <span className="text-[10px] text-amber-400 block uppercase font-bold">Loan Number</span>
                <span className="font-mono font-bold text-white text-sm">{createdData.loan.loan_number}</span>
                <div className="text-emerald-400 font-mono font-bold mt-1">KES {formatKES(createdData.loan.principal_amount)} (30% Int)</div>
                <div className="text-[10px] text-rose-400 font-mono mt-0.5">Due: {createdData.loan.due_date} (Max 14 Days)</div>
              </div>
            </div>

            {/* Print & Action Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
              <button
                onClick={() => downloadPawnTicketPDF(createdData.loan, createdData.customer, createdData.collateral)}
                className="px-5 py-2.5 bg-[#0ABAB5] hover:bg-[#1FD2CD] text-black font-black rounded-xl text-xs flex items-center gap-2 cursor-pointer shadow-lg shadow-[#0ABAB5]/20"
              >
                <Printer className="w-4 h-4" />
                <span>Download / Print Official Pawn Ticket</span>
              </button>

              <button
                onClick={() => {
                  const msg = createLoanDisbursalMessage({
                    customerName: createdData.customer.name,
                    loanNumber: createdData.loan.loan_number,
                    collateralNumber: createdData.collateral.collateral_number,
                    collateralItem: createdData.collateral.item_name,
                    principalAmount: createdData.loan.principal_amount,
                    funder: createdData.loan.funder,
                    dueDate: createdData.loan.due_date,
                    maturityDate: createdData.loan.maturity_date,
                    totalDue: createdData.loan.total_amount_due
                  });
                  window.open(generateWhatsAppLink(createdData.customer.phone, msg), '_blank');
                }}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 cursor-pointer shadow-md"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Send WhatsApp Ticket to Client</span>
              </button>

              <button
                onClick={onClose}
                className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl text-xs cursor-pointer border border-white/10"
              >
                Done / Close
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmitAll} className="space-y-6 text-xs">
            {/* Step Selector Tabs */}
            <div className="flex items-center justify-between p-1 bg-black/40 border border-white/10 rounded-2xl">
              <button
                type="button"
                onClick={() => setActiveStep(1)}
                className={`flex-1 py-2 rounded-xl font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                  activeStep === 1
                    ? 'bg-[#0ABAB5] text-black shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>1. Customer Profile</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveStep(2)}
                className={`flex-1 py-2 rounded-xl font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                  activeStep === 2
                    ? 'bg-[#0ABAB5] text-black shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                <span>2. Collateral Details & Storage</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveStep(3)}
                className={`flex-1 py-2 rounded-xl font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                  activeStep === 3
                    ? 'bg-[#0ABAB5] text-black shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Coins className="w-3.5 h-3.5" />
                <span>3. 2-Week Loan & 30% Interest</span>
              </button>
            </div>

            {/* TAB 1: CUSTOMER INFORMATION */}
            {activeStep === 1 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <span className="font-extrabold text-sm text-white uppercase tracking-wider flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#0ABAB5] text-black text-xs font-black flex items-center justify-center">1</span>
                    <span>Customer Personal Details & National Identity</span>
                  </span>
                  <span className="text-[10px] text-[#0ABAB5] font-mono font-bold">CUS Permanent Profile</span>
                </div>

                {/* Photos Row: Customer Portrait & ID Document Photo */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Customer Portrait */}
                  <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 flex items-center gap-3">
                    <div className="w-16 h-16 rounded-xl border border-dashed border-[#0ABAB5]/50 bg-slate-900 flex items-center justify-center overflow-hidden shrink-0 relative group">
                      {customerPhoto ? (
                        <>
                          <img src={customerPhoto} alt="Customer" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setCustomerPhoto('')}
                            className="absolute inset-0 bg-black/70 flex items-center justify-center text-rose-400 opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <Users className="w-6 h-6 text-slate-600" />
                      )}
                    </div>
                    <div className="space-y-1 flex-1">
                      <span className="font-bold text-white text-[11px] block">Customer Photo</span>
                      <button
                        type="button"
                        onClick={() => customerPhotoCameraRef.current?.click()}
                        className="px-2.5 py-1 bg-[#0ABAB5] hover:bg-[#1FD2CD] text-black font-bold rounded-lg text-[11px] cursor-pointer inline-flex items-center gap-1"
                      >
                        <Camera className="w-3 h-3" /> Camera
                      </button>
                      <button type="button" onClick={() => customerPhotoRef.current?.click()} className="px-2.5 py-1 bg-white/15 hover:bg-white/25 text-white font-bold rounded-lg text-[11px] cursor-pointer inline-flex items-center gap-1"><Upload className="w-3 h-3" /> Upload</button>
                      <input ref={customerPhotoCameraRef} type="file" accept="image/*" capture="user" onChange={(e) => { const f = e.target.files?.[0]; if (f) processImageFile(f, setCustomerPhoto); }} className="hidden" />
                      <input ref={customerPhotoRef} type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) processImageFile(f, setCustomerPhoto); }} className="hidden" />
                    </div>
                  </div>

                  {/* ID Document Photo */}
                  <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 flex items-center gap-3">
                    <div className="w-16 h-16 rounded-xl border border-dashed border-white/30 bg-slate-900 flex items-center justify-center overflow-hidden shrink-0 relative group">
                      {idPhoto ? (
                        <>
                          <img src={idPhoto} alt="ID Document" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setIdPhoto('')}
                            className="absolute inset-0 bg-black/70 flex items-center justify-center text-rose-400 opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <ShieldCheck className="w-6 h-6 text-slate-600" />
                      )}
                    </div>
                    <div className="space-y-1 flex-1">
                      <span className="font-bold text-white text-[11px] block">ID / Passport Document Photo</span>
                      <button
                        type="button"
                        onClick={() => idDocumentCameraRef.current?.click()}
                        className="px-2.5 py-1 bg-[#0ABAB5] hover:bg-[#1FD2CD] text-black font-bold rounded-lg text-[11px] cursor-pointer inline-flex items-center gap-1"
                      >
                        <Camera className="w-3 h-3" /> Camera
                      </button>
                      <button type="button" onClick={() => idDocumentPhotoRef.current?.click()} className="px-2.5 py-1 bg-white/15 hover:bg-white/25 text-white font-bold rounded-lg text-[11px] cursor-pointer inline-flex items-center gap-1"><Upload className="w-3 h-3" /> Upload</button>
                      <input ref={idDocumentCameraRef} type="file" accept="image/*" capture="environment" onChange={(e) => { const f = e.target.files?.[0]; if (f) processImageFile(f, setIdPhoto); }} className="hidden" />
                      <input ref={idDocumentPhotoRef} type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) processImageFile(f, setIdPhoto); }} className="hidden" />
                    </div>
                  </div>
                </div>

                {/* Name & ID Number */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-300 mb-1">Customer Full Name *</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. John Mwangi Kariuki"
                      className="w-full py-2.5 px-3 glass-input rounded-xl text-white text-xs focus:outline-none focus:border-[#0ABAB5]"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-300 mb-1">National ID / Passport Number *</label>
                    <input
                      type="text"
                      value={idNumber}
                      onChange={(e) => setIdNumber(e.target.value)}
                      placeholder="e.g. 28994120"
                      className="w-full py-2.5 px-3 glass-input rounded-xl text-white font-mono text-xs focus:outline-none focus:border-[#0ABAB5]"
                      required
                    />
                  </div>
                </div>

                {/* Phone & Alternative Phone with N/A option */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-300 mb-1">Phone Number (M-Pesa) *</label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="e.g. 0712345678"
                      className="w-full py-2.5 px-3 glass-input rounded-xl text-white font-mono text-xs focus:outline-none focus:border-[#0ABAB5]"
                      required
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block font-bold text-slate-300">Alternative Phone</label>
                      <button
                        type="button"
                        onClick={() => setAltPhone(altPhone === 'N/A' ? '+254 ' : 'N/A')}
                        className="text-[10px] text-[#0ABAB5] hover:underline font-mono cursor-pointer"
                      >
                        {altPhone === 'N/A' ? '+ Enter Number' : 'Set as N/A'}
                      </button>
                    </div>
                    <input
                      type="text"
                      value={altPhone}
                      onChange={(e) => setAltPhone(e.target.value)}
                      placeholder="e.g. 0733889900 or N/A"
                      className="w-full py-2.5 px-3 glass-input rounded-xl text-white font-mono text-xs focus:outline-none focus:border-[#0ABAB5]"
                    />
                  </div>
                </div>

                {/* Address & County */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-300 mb-1">Physical Residential Address</label>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="e.g. Kasarani Seasons / Kahawa West"
                      className="w-full py-2.5 px-3 glass-input rounded-xl text-white text-xs focus:outline-none focus:border-[#0ABAB5]"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-300 mb-1">County</label>
                    <select
                      value={county}
                      onChange={(e) => setCounty(e.target.value)}
                      className="w-full py-2.5 px-3 glass-input rounded-xl text-white text-xs focus:outline-none focus:border-[#0ABAB5] cursor-pointer"
                    >
                      <option value="Nairobi" className="bg-slate-900">Nairobi</option>
                      <option value="Kiambu" className="bg-slate-900">Kiambu</option>
                      <option value="Mombasa" className="bg-slate-900">Mombasa</option>
                      <option value="Kwale" className="bg-slate-900">Kwale</option>
                      <option value="Nakuru" className="bg-slate-900">Nakuru</option>
                      <option value="Eldoret / Uasin Gishu" className="bg-slate-900">Eldoret / Uasin Gishu</option>
                      <option value="Machakos" className="bg-slate-900">Machakos</option>
                      <option value="Kajiado" className="bg-slate-900">Kajiado</option>
                      <option value="Other County" className="bg-slate-900">Other County</option>
                    </select>
                  </div>
                </div>

                {/* History Metrics & N/A toggles */}
                <div className="p-3.5 bg-black/40 border border-white/10 rounded-2xl space-y-2">
                  <span className="text-[11px] font-bold text-slate-300 block">
                    Customer Previous Borrowing History (Optional / New Client defaults to N/A)
                  </span>
                  
                  <div className="grid grid-cols-3 gap-3">
                    {/* Previous Loans */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-slate-400">Previous Loans:</span>
                        <button
                          type="button"
                          onClick={() => setIsPrevLoansNA(!isPrevLoansNA)}
                          className="text-[9px] text-[#0ABAB5] font-mono"
                        >
                          {isPrevLoansNA ? 'Enter Count' : 'Set N/A'}
                        </button>
                      </div>
                      {isPrevLoansNA ? (
                        <div className="py-2 px-2.5 bg-white/5 border border-white/10 rounded-lg text-slate-400 font-mono text-center">N/A</div>
                      ) : (
                        <input
                          type="number"
                          value={prevLoansCount}
                          onChange={(e) => setPrevLoansCount(Number(e.target.value))}
                          className="w-full py-1.5 px-2 glass-input rounded-lg text-white font-mono text-xs"
                        />
                      )}
                    </div>

                    {/* Total Borrowed */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-slate-400">Total Borrowed:</span>
                        <button
                          type="button"
                          onClick={() => setIsTotalBorrowedNA(!isTotalBorrowedNA)}
                          className="text-[9px] text-[#0ABAB5] font-mono"
                        >
                          {isTotalBorrowedNA ? 'Enter KES' : 'Set N/A'}
                        </button>
                      </div>
                      {isTotalBorrowedNA ? (
                        <div className="py-2 px-2.5 bg-white/5 border border-white/10 rounded-lg text-slate-400 font-mono text-center">N/A</div>
                      ) : (
                        <input
                          type="number"
                          value={totalBorrowedAmount}
                          onChange={(e) => setTotalBorrowedAmount(Number(e.target.value))}
                          className="w-full py-1.5 px-2 glass-input rounded-lg text-white font-mono text-xs"
                        />
                      )}
                    </div>

                    {/* Total Repaid */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-slate-400">Total Repaid:</span>
                        <button
                          type="button"
                          onClick={() => setIsTotalRepaidNA(!isTotalRepaidNA)}
                          className="text-[9px] text-[#0ABAB5] font-mono"
                        >
                          {isTotalRepaidNA ? 'Enter KES' : 'Set N/A'}
                        </button>
                      </div>
                      {isTotalRepaidNA ? (
                        <div className="py-2 px-2.5 bg-white/5 border border-white/10 rounded-lg text-slate-400 font-mono text-center">N/A</div>
                      ) : (
                        <input
                          type="number"
                          value={totalRepaidAmount}
                          onChange={(e) => setTotalRepaidAmount(Number(e.target.value))}
                          className="w-full py-1.5 px-2 glass-input rounded-lg text-white font-mono text-xs"
                        />
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!name.trim() || !idNumber.trim() || !phone.trim()) {
                        alert('Please fill in Customer Name, National ID, and Phone.');
                        return;
                      }
                      setActiveStep(2);
                    }}
                    className="px-5 py-2.5 bg-[#0ABAB5] hover:bg-[#1FD2CD] text-black font-extrabold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-md"
                  >
                    <span>Proceed to Collateral Details →</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: COLLATERAL ITEM & STORAGE */}
            {activeStep === 2 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <span className="font-extrabold text-sm text-white uppercase tracking-wider flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#0ABAB5] text-black text-xs font-black flex items-center justify-center">2</span>
                    <span>Pledged Collateral Specification & Vault Storage</span>
                  </span>
                  <span className="text-[10px] text-[#0ABAB5] font-mono font-bold">COL Unique Identifier</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 flex items-center gap-3">
                  <div className="w-16 h-16 rounded-xl border border-dashed border-[#0ABAB5]/50 bg-slate-900 flex items-center justify-center overflow-hidden shrink-0">
                    {photoFront ? <img src={photoFront} alt="Collateral item" className="w-full h-full object-cover" /> : <Package className="w-6 h-6 text-slate-600" />}
                  </div>
                  <div className="space-y-2">
                    <span className="font-bold text-white text-[11px] block">Item Photo</span>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => photoFrontCameraRef.current?.click()} className="px-2.5 py-1 bg-[#0ABAB5] text-black font-bold rounded-lg text-[11px] inline-flex items-center gap-1"><Camera className="w-3 h-3" /> Camera</button>
                      <button type="button" onClick={() => photoFrontRef.current?.click()} className="px-2.5 py-1 bg-white/15 text-white font-bold rounded-lg text-[11px] inline-flex items-center gap-1"><Upload className="w-3 h-3" /> Upload</button>
                    </div>
                    <input ref={photoFrontCameraRef} type="file" accept="image/*" capture="environment" onChange={(e) => { const f = e.target.files?.[0]; if (f) processImageFile(f, setPhotoFront); }} className="hidden" />
                    <input ref={photoFrontRef} type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) processImageFile(f, setPhotoFront); }} className="hidden" />
                  </div>
                </div>

                {/* Category & Custom Category */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-300 mb-1">Collateral Category *</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as CollateralCategory)}
                      className="w-full py-2.5 px-3 glass-input rounded-xl text-white text-xs focus:outline-none focus:border-[#0ABAB5] cursor-pointer"
                    >
                      {COLLATERAL_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat} className="bg-slate-900">{cat}</option>
                      ))}
                    </select>
                  </div>

                  {category === 'Other Collateral' ? (
                    <div>
                      <label className="block font-bold text-slate-300 mb-1">Specify Item Category *</label>
                      <input
                        type="text"
                        value={customCategory}
                        onChange={(e) => setCustomCategory(e.target.value)}
                        placeholder="e.g. Generator, Musical Keyboard, Bicycle"
                        className="w-full py-2.5 px-3 glass-input rounded-xl text-white text-xs focus:outline-none focus:border-[#0ABAB5]"
                        required
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block font-bold text-slate-300 mb-1">Brand Name *</label>
                      <input
                        type="text"
                        value={brand}
                        onChange={(e) => setBrand(e.target.value)}
                        placeholder="e.g. Samsung, Sony, HP, Ramtons, Apple"
                        className="w-full py-2.5 px-3 glass-input rounded-xl text-white text-xs focus:outline-none focus:border-[#0ABAB5]"
                        required
                      />
                    </div>
                  )}
                </div>

                {category === 'Other Collateral' && (
                  <div>
                    <label className="block font-bold text-slate-300 mb-1">Brand Name *</label>
                    <input
                      type="text"
                      value={brand}
                      onChange={(e) => setBrand(e.target.value)}
                      placeholder="e.g. Yamaha, Honda, Sony"
                      className="w-full py-2.5 px-3 glass-input rounded-xl text-white text-xs focus:outline-none focus:border-[#0ABAB5]"
                      required
                    />
                  </div>
                )}

                {/* Model & Colour */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-300 mb-1">Model / Size Specification *</label>
                    <input
                      type="text"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      placeholder="e.g. 55-inch 4K Smart TV / EliteBook 840 G6"
                      className="w-full py-2.5 px-3 glass-input rounded-xl text-white text-xs focus:outline-none focus:border-[#0ABAB5]"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-300 mb-1">Colour / Finish</label>
                    <input
                      type="text"
                      value={colour}
                      onChange={(e) => setColour(e.target.value)}
                      placeholder="e.g. Black Glass, Metallic Silver"
                      className="w-full py-2.5 px-3 glass-input rounded-xl text-white text-xs focus:outline-none focus:border-[#0ABAB5]"
                    />
                  </div>
                </div>

                {/* Serial Number & IMEI with Real-time Duplicate Detection */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-300 mb-1">Serial Number (Electronics)</label>
                    <input
                      type="text"
                      value={serialNumber}
                      onChange={(e) => setSerialNumber(e.target.value)}
                      placeholder="e.g. SN-9481923"
                      className="w-full py-2.5 px-3 glass-input rounded-xl text-white font-mono text-xs focus:outline-none focus:border-[#0ABAB5]"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-300 mb-1">IMEI 1 (Smartphones/Tablets)</label>
                    <input
                      type="text"
                      value={imei1}
                      onChange={(e) => setImei1(e.target.value)}
                      placeholder="e.g. 354891028471928"
                      className="w-full py-2.5 px-3 glass-input rounded-xl text-white font-mono text-xs focus:outline-none focus:border-[#0ABAB5]"
                    />
                  </div>
                </div>

                {/* Duplicate Detection Warning Banner */}
                {duplicateCheck.hasDuplicate && (
                  <div className="p-3 bg-rose-950/70 border border-rose-500 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400" />
                    <span className="font-bold">{duplicateCheck.message}</span>
                  </div>
                )}

                {/* Category Specific specs */}
                {category === 'TV' && (
                  <div className="p-3.5 bg-black/40 border border-white/10 rounded-2xl space-y-2">
                    <span className="font-bold text-white text-[11px] block flex items-center gap-1.5">
                      <Tv className="w-3.5 h-3.5 text-[#0ABAB5]" />
                      <span>Television Specific Verification</span>
                    </span>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-1">Screen Size</label>
                        <input
                          type="text"
                          value={tvScreenSize}
                          onChange={(e) => setTvScreenSize(e.target.value)}
                          className="w-full py-1.5 px-2.5 glass-input rounded-lg text-white text-xs"
                        />
                      </div>
                      <label className="flex items-center gap-2 p-2 bg-white/5 rounded-lg cursor-pointer">
                        <input
                          type="checkbox"
                          checked={tvRemoteIncluded}
                          onChange={(e) => setTvRemoteIncluded(e.target.checked)}
                          className="accent-[#0ABAB5]"
                        />
                        <span className="text-white text-xs font-semibold">Remote Included</span>
                      </label>
                      <label className="flex items-center gap-2 p-2 bg-white/5 rounded-lg cursor-pointer">
                        <input
                          type="checkbox"
                          checked={tvStandIncluded}
                          onChange={(e) => setTvStandIncluded(e.target.checked)}
                          className="accent-[#0ABAB5]"
                        />
                        <span className="text-white text-xs font-semibold">Stand Included</span>
                      </label>
                    </div>
                  </div>
                )}

                {category === 'Laptop/PC' && (
                  <div className="p-3.5 bg-black/40 border border-white/10 rounded-2xl space-y-2">
                    <span className="font-bold text-white text-[11px] block flex items-center gap-1.5">
                      <Laptop className="w-3.5 h-3.5 text-[#0ABAB5]" />
                      <span>Laptop / PC Hardware Specs</span>
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-1">Processor</label>
                        <input
                          type="text"
                          value={laptopProcessor}
                          onChange={(e) => setLaptopProcessor(e.target.value)}
                          className="w-full py-1.5 px-2 glass-input rounded-lg text-white text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-1">RAM</label>
                        <input
                          type="text"
                          value={laptopRam}
                          onChange={(e) => setLaptopRam(e.target.value)}
                          className="w-full py-1.5 px-2 glass-input rounded-lg text-white text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-1">Storage</label>
                        <input
                          type="text"
                          value={laptopStorage}
                          onChange={(e) => setLaptopStorage(e.target.value)}
                          className="w-full py-1.5 px-2 glass-input rounded-lg text-white text-xs"
                        />
                      </div>
                      <label className="flex items-center gap-2 p-2 bg-white/5 rounded-lg cursor-pointer">
                        <input
                          type="checkbox"
                          checked={laptopCharger}
                          onChange={(e) => setLaptopCharger(e.target.checked)}
                          className="accent-[#0ABAB5]"
                        />
                        <span className="text-white text-xs font-semibold">Charger Present</span>
                      </label>
                    </div>
                  </div>
                )}

                {/* Condition & Accessories */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-300 mb-1">Physical Condition Inspection</label>
                    <input
                      type="text"
                      value={condition}
                      onChange={(e) => setCondition(e.target.value)}
                      placeholder="Tested at counter, working 100%"
                      className="w-full py-2.5 px-3 glass-input rounded-xl text-white text-xs focus:outline-none focus:border-[#0ABAB5]"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-300 mb-1">Accessories Included</label>
                    <input
                      type="text"
                      value={accessories}
                      onChange={(e) => setAccessories(e.target.value)}
                      placeholder="e.g. Remote, power cable, adapter"
                      className="w-full py-2.5 px-3 glass-input rounded-xl text-white text-xs focus:outline-none focus:border-[#0ABAB5]"
                    />
                  </div>
                </div>

                {/* Storage Location in Physical Vault */}
                <div className="p-3.5 bg-black/40 border border-[#0ABAB5]/40 rounded-2xl space-y-2">
                  <span className="font-extrabold text-white text-[11px] block flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#0ABAB5]" />
                    <span>Exact Store Physical Storage Location</span>
                  </span>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Storage Room / Area</label>
                      <select
                        value={storageRoom}
                        onChange={(e) => setStorageRoom(e.target.value)}
                        className="w-full py-2 px-2.5 glass-input rounded-xl text-white text-xs cursor-pointer"
                      >
                        <option value="Warehouse A" className="bg-slate-900">Warehouse A</option>
                        <option value="Safe 02 (High Value)" className="bg-slate-900">Safe 02 (High Value / Jewellery)</option>
                        <option value="Main Showroom Vault" className="bg-slate-900">Main Showroom Vault</option>
                        <option value="Back Storage Rack" className="bg-slate-900">Back Storage Rack</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Rack / Shelf / Locker No *</label>
                      <input
                        type="text"
                        value={rackShelf}
                        onChange={(e) => setRackShelf(e.target.value)}
                        placeholder="e.g. Rack B3 / Shelf 7"
                        className="w-full py-2 px-2.5 glass-input rounded-xl text-white font-mono text-xs focus:outline-none focus:border-[#0ABAB5]"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Security Seal / Tag</label>
                      <input
                        type="text"
                        value={securityTag}
                        onChange={(e) => setSecurityTag(e.target.value)}
                        placeholder="e.g. SEC-8291"
                        className="w-full py-2 px-2.5 glass-input rounded-xl text-white font-mono text-xs focus:outline-none focus:border-[#0ABAB5]"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveStep(1)}
                    className="px-4 py-2 bg-white/10 text-white rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    ← Back to Customer
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (!brand.trim() || !model.trim()) {
                        alert('Please fill in Brand and Model.');
                        return;
                      }
                      setActiveStep(3);
                    }}
                    className="px-5 py-2.5 bg-[#0ABAB5] hover:bg-[#1FD2CD] text-black font-extrabold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-md"
                  >
                    <span>Proceed to Valuation & Loan Terms →</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB 3: VALUATION, STRICT 2-WEEK LOAN & 30% INTEREST */}
            {activeStep === 3 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <span className="font-extrabold text-sm text-white uppercase tracking-wider flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#0ABAB5] text-black text-xs font-black flex items-center justify-center">3</span>
                    <span>Automatic Valuation, Strict 2-Week Collateral Term & 30% Interest</span>
                  </span>
                  <span className="text-[10px] text-rose-400 font-mono font-bold">Max 14 Days Capped</span>
                </div>

                {/* Valuation & Loan Calculation Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-slate-300 mb-1">Collateral Market Value (KES) *</label>
                    <input
                      type="number"
                      min="500"
                      value={marketValue}
                      onChange={(e) => handleMarketValueChange(Number(e.target.value))}
                      className="w-full py-2.5 px-3 glass-input rounded-xl text-white font-mono-numbers font-bold text-sm focus:outline-none focus:border-[#0ABAB5]"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-[#0ABAB5] mb-1">
                      Loan Amount Offered / Disbursed (KES) *
                    </label>
                    <input
                      type="number"
                      min="100"
                      value={loanPrincipal}
                      onChange={(e) => handlePrincipalChange(Number(e.target.value))}
                      className="w-full py-2.5 px-3 glass-input rounded-xl text-[#0ABAB5] font-mono-numbers font-black text-base focus:outline-none focus:border-[#0ABAB5]"
                      required
                    />
                  </div>

                  {/* LTV Safe Limit Box */}
                  <div className={`p-3 rounded-xl border flex flex-col justify-between ${
                    isAboveLTV
                      ? 'bg-rose-950/40 border-rose-500/50 text-rose-300'
                      : 'bg-[#0ABAB5]/10 border-[#0ABAB5]/30 text-slate-300'
                  }`}>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-white flex items-center gap-1">
                        {isAboveLTV ? <AlertTriangle className="w-3.5 h-3.5 text-rose-400" /> : <CheckCircle2 className="w-3.5 h-3.5 text-[#0ABAB5]" />}
                        <span>LTV Limit ({category})</span>
                      </span>
                      <span className="font-mono font-bold text-white">{ltvValuation.maxLTVPercent}%</span>
                    </div>
                    <div className="text-[11px] mt-1">
                      Max Recommended: <strong className="font-mono text-emerald-400">{formatKES(ltvValuation.maxAllowedLoan)}</strong>
                    </div>
                  </div>
                </div>

                {isAboveLTV && (
                  <div className="p-2.5 bg-rose-950/60 border border-rose-500 rounded-xl text-rose-300 text-xs font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>⚠️ WARNING: Loan of {formatKES(loanPrincipal)} is above your configured collateral limit ({formatKES(ltvValuation.maxAllowedLoan)}). Authorized by Director.</span>
                  </div>
                )}

                {/* STRICT REQUIREMENT: MAXIMUM 2 WEEKS & 30% INTEREST */}
                <div className="p-4 rounded-2xl bg-black/60 border border-[#0ABAB5]/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-white text-xs flex items-center gap-2">
                      <Clock className="w-4 h-4 text-[#0ABAB5]" />
                      <span>Collateral Term & 30% Interest Schedule</span>
                    </span>
                    <span className="text-[10px] bg-rose-950/80 text-rose-300 border border-rose-800/60 px-2.5 py-0.5 rounded-full font-bold">
                      Strictly Maximum 2 Weeks (14 Days)
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Term Selector strictly maximum 14 days */}
                    <div>
                      <label className="block text-slate-300 font-bold mb-1">
                        Collateral Period (Max 14 Days) *
                      </label>
                      <select
                        value={termDays}
                        onChange={(e) => handleTermDaysChange(Number(e.target.value))}
                        className="w-full py-2.5 px-3 glass-input rounded-xl text-white font-bold text-xs focus:outline-none focus:border-[#0ABAB5] cursor-pointer"
                      >
                        <option value="14" className="bg-slate-900">14 Days (2 Weeks - Maximum Term)</option>
                        <option value="7" className="bg-slate-900">7 Days (1 Week Term)</option>
                      </select>
                    </div>

                    {/* Interest Rate (Standard 30% per 2 weeks) */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-amber-400 font-bold">Interest Rate (% per 2 Wks) *</label>
                        <span className="text-[10px] text-amber-400 font-mono font-bold">30% Standard</span>
                      </div>
                      <input
                        type="number"
                        value={interestRatePercent}
                        onChange={(e) => setInterestRatePercent(Number(e.target.value))}
                        className="w-full py-2.5 px-3 glass-input rounded-xl text-amber-400 font-mono font-bold text-xs focus:outline-none focus:border-amber-400"
                        required
                      />
                    </div>

                    {/* Storage / Vault Fee */}
                    <div>
                      <label className="block text-slate-300 font-bold mb-1">Storage & Vault Fee (KES)</label>
                      <input
                        type="number"
                        value={storageFee}
                        onChange={(e) => setStorageFee(Number(e.target.value))}
                        className="w-full py-2.5 px-3 glass-input rounded-xl text-white font-mono text-xs focus:outline-none focus:border-[#0ABAB5]"
                      />
                    </div>
                  </div>

                  {/* Summary of Dates & Total Redemption Amount */}
                  <div className="p-3.5 bg-black/80 border border-white/10 rounded-xl grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase">Date Received:</span>
                      <strong className="font-mono text-white">{dateReceived}</strong>
                    </div>

                    <div>
                      <span className="text-[10px] text-rose-400 block uppercase font-bold">Due Date (Max 14D):</span>
                      <strong className="font-mono text-rose-400 text-sm font-black">{dueDate}</strong>
                    </div>

                    <div>
                      <span className="text-[10px] text-amber-400 block uppercase font-bold">30% Interest Fee:</span>
                      <strong className="font-mono text-amber-400 font-black">{formatKES(calculatedInterestAmount)}</strong>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-[#0ABAB5] block uppercase font-bold">Total to Redeem:</span>
                      <div className="font-mono-numbers font-black text-[#0ABAB5] text-base">
                        {formatKES(calculatedTotalDue)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Capital Funder & Disbursement Method */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-white mb-1.5">
                      Director Issuing Money (Capital Funder) *
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setFunder('Trevor')}
                        className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                          funder === 'Trevor'
                            ? 'bg-[#0ABAB5]/20 border-[#0ABAB5] text-white shadow-md'
                            : 'bg-white/5 border-white/10 text-slate-300'
                        }`}
                      >
                        <span className="font-bold block text-xs text-[#0ABAB5]">Trevor Mbugua</span>
                        <span className="text-[9px] text-slate-400">Co-Director</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setFunder('Peter')}
                        className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                          funder === 'Peter'
                            ? 'bg-white/20 border-white text-white shadow-md'
                            : 'bg-white/5 border-white/10 text-slate-300'
                        }`}
                      >
                        <span className="font-bold block text-xs text-white">Peter Kamau</span>
                        <span className="text-[9px] text-slate-400">Co-Director</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-300 mb-1.5">Disbursement Payment Method</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['M-Pesa', 'Cash', 'Bank'] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setDisbursementMethod(m)}
                          className={`py-2 rounded-xl text-xs font-bold border cursor-pointer ${
                            disbursementMethod === m
                              ? 'bg-[#0ABAB5] text-black border-[#0ABAB5]'
                              : 'bg-white/5 text-slate-300 border-white/10'
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-3 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setActiveStep(2)}
                    className="px-4 py-2 bg-white/10 text-white rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    ← Back to Collateral
                  </button>

                  <button
                    type="submit"
                    className="px-6 py-3 bg-[#0ABAB5] hover:bg-[#1FD2CD] text-black font-black rounded-xl text-xs flex items-center gap-2 cursor-pointer shadow-lg shadow-[#0ABAB5]/25"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Create Customer, Intake Collateral & Issue Loan</span>
                  </button>
                </div>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
};
