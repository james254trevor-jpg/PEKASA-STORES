import React, { useState, useRef } from 'react';
import { sqliteService } from '../db/sqlite';
import { 
  Customer, 
  Appliance, 
  Payment, 
  STORE_NAME, 
  STORE_TEL, 
  ApplianceCategory, 
  APPLIANCE_CATEGORIES 
} from '../types';
import { formatKES, calculateDueDate, calculateLoanDueDate, calculateMaturityDate, formatSequenceCode } from '../utils/numbering';
import { generateWhatsAppLink, createPawnDisbursalMessage } from '../utils/messaging';
import { useAuth } from '../context/AuthContext';
import { 
  Users, 
  Search, 
  Plus, 
  Phone, 
  Mail, 
  MapPin, 
  FileText, 
  MessageSquare, 
  Clock, 
  DollarSign, 
  Tv, 
  X, 
  Edit2, 
  History, 
  ShieldAlert, 
  Camera, 
  Upload, 
  CheckCircle2, 
  Trash2, 
  UserCheck, 
  Image as ImageIcon, 
  Save, 
  Calendar, 
  Layers, 
  ArrowRight,
  ShieldCheck
} from 'lucide-react';

interface CustomersViewProps {
  selectedCustomerId?: string | null;
  initialSearchQuery?: string;
  onClearSelectedCustomer?: () => void;
  onSelectAppliance: (applianceId: string) => void;
  onOpenNewApplianceForCustomer: (customerId: string) => void;
}

export const CustomersView: React.FC<CustomersViewProps> = ({
  selectedCustomerId: externalSelectedCustomerId,
  initialSearchQuery = '',
  onClearSelectedCustomer,
  onSelectAppliance,
  onOpenNewApplianceForCustomer
}) => {
  const { currentUser } = useAuth();
  const customers = sqliteService.getCustomers();
  const appliances = sqliteService.getAppliances();
  const payments = sqliteService.getPayments();

  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(
    externalSelectedCustomerId || customers[0]?.id || null
  );
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [isEditCustomerOpen, setIsEditCustomerOpen] = useState(false);
  const [isUpdatingPhoto, setIsUpdatingPhoto] = useState(false);

  // Hidden file inputs
  const profilePhotoInputRef = useRef<HTMLInputElement>(null);
  const modalPhotoInputRef = useRef<HTMLInputElement>(null);
  const editModalPhotoInputRef = useRef<HTMLInputElement>(null);
  const appliancePhotoInputRef = useRef<HTMLInputElement>(null);

  // Sync when parent changes selected customer
  React.useEffect(() => {
    if (externalSelectedCustomerId) {
      setSelectedCustomerId(externalSelectedCustomerId);
    }
  }, [externalSelectedCustomerId]);

  // Sync when parent provides initialSearchQuery
  React.useEffect(() => {
    if (initialSearchQuery !== undefined) {
      setSearchQuery(initialSearchQuery);
    }
  }, [initialSearchQuery]);

  // --- Add Customer & Appliance Form State ---
  const [name, setName] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [phone, setPhone] = useState('+254 ');
  const [altPhone, setAltPhone] = useState('N/A');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [county, setCounty] = useState('Nairobi');
  const [notes, setNotes] = useState('');
  const [newCustomerPhoto, setNewCustomerPhoto] = useState<string>('');

  // Appliance intake within Customer registration
  const [includeAppliance, setIncludeAppliance] = useState(true);
  const [appFunder, setAppFunder] = useState<'Trevor' | 'Peter'>(
    currentUser?.username?.toLowerCase() === 'peter' ? 'Peter' : 'Trevor'
  );
  const [appCategory, setAppCategory] = useState<ApplianceCategory>('TV');
  const [appCustomCategory, setAppCustomCategory] = useState('');
  const [appBrand, setAppBrand] = useState('');
  const [appModel, setAppModel] = useState('');
  const [appSerialNumber, setAppSerialNumber] = useState('');
  const [appCondition, setAppCondition] = useState('Good working condition, tested at counter');
  const [appMarketValue, setAppMarketValue] = useState<number>(25000);
  const [appAmountDisbursed, setAppAmountDisbursed] = useState<number>(10000);
  const [appInterestRate, setAppInterestRate] = useState<number>(30); // 30% per 2 weeks
  const [appInterestCharges, setAppInterestCharges] = useState<number>(3000); // 30% of 10000
  const [appTermDays, setAppTermDays] = useState<number>(14); // Strictly maximum 14 days (2 weeks)
  const [appDateReceived, setAppDateReceived] = useState(new Date().toISOString().split('T')[0]);
  const [appDueDate, setAppDueDate] = useState(calculateDueDate(new Date().toISOString().split('T')[0]));
  const [appNotes, setAppNotes] = useState('');
  const [appPhotos, setAppPhotos] = useState<string[]>([]);

  // Update interest automatically based on 30% per two-week cycle
  const handleAmountDisbursedChange = (newAmount: number) => {
    setAppAmountDisbursed(newAmount);
    const calculatedInterest = Math.round((newAmount * appInterestRate) / 100);
    setAppInterestCharges(calculatedInterest);
  };

  const handleInterestRateChange = (newRate: number) => {
    setAppInterestRate(newRate);
    const calculatedInterest = Math.round((appAmountDisbursed * newRate) / 100);
    setAppInterestCharges(calculatedInterest);
  };

  // Change term days strictly capped at maximum 14 days (2 weeks)
  const handleTermDaysSelect = (days: number) => {
    const capped = Math.min(14, Math.max(1, days));
    setAppTermDays(capped);
    setAppDueDate(calculateLoanDueDate(appDateReceived, capped));
  };

  // Update due date automatically when date received changes
  const handleDateReceivedChange = (newDate: string) => {
    setAppDateReceived(newDate);
    setAppDueDate(calculateLoanDueDate(newDate, appTermDays));
  };

  // Guard against due dates exceeding the 2-week maximum
  const handleDueDateChange = (newDate: string) => {
    const maxDate = calculateLoanDueDate(appDateReceived, 14);
    if (newDate > maxDate) {
      alert(`Policy constraint: Maximum collateral duration is 2 weeks (14 days). Due date has been capped to ${maxDate}.`);
      setAppDueDate(maxDate);
      setAppTermDays(14);
    } else {
      setAppDueDate(newDate);
      const d1 = new Date(appDateReceived).getTime();
      const d2 = new Date(newDate).getTime();
      const diff = Math.max(1, Math.min(14, Math.round((d2 - d1) / (1000 * 3600 * 24))));
      setAppTermDays(diff);
    }
  };

  // --- Edit Customer Form State ---
  const [editName, setEditName] = useState('');
  const [editIdNumber, setEditIdNumber] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editPhoto, setEditPhoto] = useState<string>('');

  const filteredCustomers = customers.filter((c) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;

    const nameMatch = c.name.toLowerCase().includes(q);
    const idMatch = c.id_number.toLowerCase().includes(q);
    const phoneMatch = c.phone.includes(q);
    const addressMatch = c.address && c.address.toLowerCase().includes(q);

    const matchingAppliance = appliances.some(
      (a) => a.customer_id === c.id && (
        a.appliance_number.toLowerCase().includes(q) ||
        (a.serial_number && a.serial_number.toLowerCase().includes(q)) ||
        a.brand.toLowerCase().includes(q) ||
        a.model.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q)
      )
    );

    return nameMatch || idMatch || phoneMatch || addressMatch || matchingAppliance;
  });

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);
  const customerAppliances = appliances.filter((a) => a.customer_id === selectedCustomerId);
  const customerPayments = payments.filter((p) => p.customer_id === selectedCustomerId);

  // Financial calculations
  const totalDisbursed = customerAppliances.reduce((acc, a) => acc + (Number(a.amount_received) || 0), 0);
  const totalPaid = customerPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
  const totalOutstanding = customerAppliances
    .filter((a) => a.status !== 'Redeemed' && a.status !== 'Sold')
    .reduce((acc, a) => {
      const { balanceRemaining } = sqliteService.calculateApplianceBalance(a);
      return acc + balanceRemaining;
    }, 0);

  // Image compressor to Base64
  const processImageFile = (file: File, callback: (base64Url: string) => void) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 400;
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

  const handleModalPhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file, (base64) => {
        setNewCustomerPhoto(base64);
      });
    }
  };

  const handleAppliancePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach((f) => {
        processImageFile(f, (base64) => {
          setAppPhotos((prev) => [...prev, base64]);
        });
      });
    }
  };

  const handleEditModalPhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file, (base64) => {
        setEditPhoto(base64);
      });
    }
  };

  const handleProfilePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && selectedCustomer) {
      setIsUpdatingPhoto(true);
      processImageFile(file, (base64) => {
        try {
          sqliteService.updateCustomerPhoto(selectedCustomer.id, base64);
          setIsUpdatingPhoto(false);
        } catch (err: any) {
          alert('Error updating customer photo: ' + err.message);
          setIsUpdatingPhoto(false);
        }
      });
    }
  };

  // Submit combined Customer & Appliance
  const handleCreateCustomerAndAppliance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !idNumber.trim() || !phone.trim()) {
      alert('Please fill in Customer Full Name, National ID, and Phone Number.');
      return;
    }

    if (includeAppliance && (!appBrand.trim() || !appModel.trim())) {
      alert('Please fill in Brand Name and Model for the collateral appliance.');
      return;
    }

    const custId = 'cust-' + Date.now();
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);

    try {
      const custCode = sqliteService.getNextSequence('CUS');

      // 1. Insert Customer with permanent customer profile fields
      sqliteService.run(
        `INSERT INTO customers (
          id, customer_number, name, id_number, phone, alt_phone, email, address, county,
          photo_url, status, notes, previous_loans_count, total_borrowed, total_repaid,
          current_balance, defaults_count, created_at, updated_at
        ) VALUES (
          :id, :cnum, :name, :id_number, :phone, :alt_phone, :email, :address, :county,
          :photo_url, :status, :notes, :plc, :tb, :tr, :cb, :dc, :created_at, :updated_at
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
          ':photo_url': newCustomerPhoto || null,
          ':status': 'Good Standing',
          ':notes': notes.trim() || null,
          ':plc': includeAppliance ? 1 : 0,
          ':tb': includeAppliance ? Number(appAmountDisbursed) : 0,
          ':tr': 0,
          ':cb': includeAppliance ? (Number(appAmountDisbursed) + Number(appInterestCharges)) : 0,
          ':dc': 0,
          ':created_at': nowStr,
          ':updated_at': nowStr
        }
      );

      let createdApplianceCode = '';
      let createdLoanCode = '';

      // 2. If collateral item included, insert into appliances, collateral_items, and rehani_loans
      if (includeAppliance) {
        const appId = 'app-' + Date.now();
        const appCode = sqliteService.getNextSequence('APP');
        const colId = 'col-' + Date.now();
        const colCode = sqliteService.getNextSequence('COL');
        const loanId = 'ln-' + Date.now();
        const loanCode = sqliteService.getNextSequence('LN');
        createdApplianceCode = appCode;
        createdLoanCode = loanCode;

        const calculatedMaturity = calculateMaturityDate(appDueDate, 7);
        const itemFullName = `${appBrand.trim()} ${appModel.trim()} ${appCategory}`;

        // Insert into appliances (backward compatibility table)
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
            ':appliance_number': appCode,
            ':customer_id': custId,
            ':category': appCategory,
            ':custom_category': ((appCategory as string) === 'Other appliances' || (appCategory as string) === 'Other Collateral') ? appCustomCategory.trim() : null,
            ':brand': appBrand.trim(),
            ':model': appModel.trim(),
            ':serial_number': appSerialNumber.trim() || null,
            ':condition': appCondition.trim(),
            ':market_value': Number(appMarketValue) || 0,
            ':amount_received': Number(appAmountDisbursed) || 0,
            ':funder': appFunder,
            ':date_received': appDateReceived,
            ':due_date': appDueDate,
            ':status': 'Active Collateral / Pawn',
            ':technician_name': appFunder,
            ':interest_charges': Number(appInterestCharges) || 0,
            ':notes': appNotes.trim() || null,
            ':created_at': nowStr,
            ':updated_at': nowStr
          }
        );

        // Insert into collateral_items (Rehani Collateral Vault)
        sqliteService.run(
          `INSERT INTO collateral_items (
            id, collateral_number, customer_id, branch_id, category, custom_category,
            item_name, brand, model, serial_number, condition, market_value,
            estimated_resale_value, max_allowed_loan, amount_offered,
            storage_room, rack_shelf, security_tag, status, date_received, notes, created_at, updated_at
          ) VALUES (
            :id, :collateral_number, :customer_id, :branch_id, :category, :custom_category,
            :item_name, :brand, :model, :serial_number, :condition, :market_value,
            :estimated_resale_value, :max_allowed_loan, :amount_offered,
            :storage_room, :rack_shelf, :security_tag, :status, :date_received, :notes, :created_at, :updated_at
          )`,
          {
            ':id': colId,
            ':collateral_number': colCode,
            ':customer_id': custId,
            ':branch_id': 'br-nairobi',
            ':category': appCategory,
            ':custom_category': ((appCategory as string) === 'Other appliances' || (appCategory as string) === 'Other Collateral') ? appCustomCategory.trim() : null,
            ':item_name': itemFullName,
            ':brand': appBrand.trim(),
            ':model': appModel.trim(),
            ':serial_number': appSerialNumber.trim() || null,
            ':condition': appCondition.trim(),
            ':market_value': Number(appMarketValue) || 0,
            ':estimated_resale_value': Math.round((Number(appMarketValue) || 0) * 0.8),
            ':max_allowed_loan': Math.round((Number(appMarketValue) || 0) * 0.6),
            ':amount_offered': Number(appAmountDisbursed) || 0,
            ':storage_room': 'Warehouse A',
            ':rack_shelf': 'Rack B3 / Shelf 7',
            ':security_tag': 'SEC-' + Math.floor(1000 + Math.random() * 9000),
            ':status': 'Held (Active Loan)',
            ':date_received': appDateReceived,
            ':notes': appNotes.trim() || null,
            ':created_at': nowStr,
            ':updated_at': nowStr
          }
        );

        // Insert into rehani_loans (Strict 30% interest per 2-week cycle, capped at 14 days)
        sqliteService.run(
          `INSERT INTO rehani_loans (
            id, loan_number, customer_id, collateral_id, branch_id, principal_amount,
            interest_rate_percent, interest_amount, storage_fee, total_amount_due,
            amount_paid, balance_remaining, term_days, issue_date, due_date,
            grace_period_days, maturity_date, funder, disbursement_method,
            disbursement_reference, status, staff_issuer, notes, created_at, updated_at
          ) VALUES (
            :id, :loan_number, :customer_id, :collateral_id, :branch_id, :principal_amount,
            :interest_rate_percent, :interest_amount, :storage_fee, :total_amount_due,
            :amount_paid, :balance_remaining, :term_days, :issue_date, :due_date,
            :grace_period_days, :maturity_date, :funder, :disbursement_method,
            :disbursement_reference, :status, :staff_issuer, :notes, :created_at, :updated_at
          )`,
          {
            ':id': loanId,
            ':loan_number': loanCode,
            ':customer_id': custId,
            ':collateral_id': colId,
            ':branch_id': 'br-nairobi',
            ':principal_amount': Number(appAmountDisbursed),
            ':interest_rate_percent': appInterestRate,
            ':interest_amount': Number(appInterestCharges),
            ':storage_fee': 0,
            ':total_amount_due': Number(appAmountDisbursed) + Number(appInterestCharges),
            ':amount_paid': 0,
            ':balance_remaining': Number(appAmountDisbursed) + Number(appInterestCharges),
            ':term_days': appTermDays,
            ':issue_date': appDateReceived,
            ':due_date': appDueDate,
            ':grace_period_days': 7,
            ':maturity_date': calculatedMaturity,
            ':funder': appFunder,
            ':disbursement_method': 'Cash',
            ':disbursement_reference': 'CSH-' + Math.floor(100000 + Math.random() * 900000),
            ':status': 'ACTIVE',
            ':staff_issuer': appFunder,
            ':notes': appNotes.trim() || null,
            ':created_at': nowStr,
            ':updated_at': nowStr
          }
        );

        // Record Initial Loan Issue Transaction in Immutable Ledger
        const txnId = 'txn-' + Date.now();
        const txnCode = sqliteService.getNextSequence('TXN');
        const rctCode = sqliteService.getNextSequence('RCT');
        sqliteService.run(
          `INSERT INTO ledger_transactions (
            id, transaction_number, receipt_number, loan_id, collateral_id, customer_id,
            branch_id, transaction_type, amount, principal_portion, interest_portion,
            balance_after, payment_method, received_by, notes, transaction_date, created_at
          ) VALUES (
            :id, :txn, :rct, :lid, :cid, :cuid, :bid, 'LOAN_ISSUED', :amt, :amt, 0,
            :bal, 'Cash', :rec, :notes, :tdate, :ca
          )`,
          {
            ':id': txnId,
            ':txn': txnCode,
            ':rct': rctCode,
            ':lid': loanId,
            ':cid': colId,
            ':cuid': custId,
            ':bid': 'br-nairobi',
            ':amt': Number(appAmountDisbursed),
            ':bal': Number(appAmountDisbursed) + Number(appInterestCharges),
            ':rec': appFunder,
            ':notes': `Loan issued by ${appFunder} for ${itemFullName}. 30% 2-week interest applied.`,
            ':tdate': appDateReceived,
            ':ca': nowStr
          }
        );

        // Save appliance photos
        appPhotos.forEach((photoUrl, idx) => {
          sqliteService.run(
            `INSERT INTO appliance_photos (id, appliance_id, photo_url, photo_type, notes, uploaded_at)
             VALUES (:id, :aid, :url, :pt, :notes, :ua)`,
            {
              ':id': `pht-${Date.now()}-${idx}`,
              ':aid': appId,
              ':url': photoUrl,
              ':pt': 'Intake Condition',
              ':notes': `Initial photo ${idx + 1} taken by ${appFunder}`,
              ':ua': nowStr
            }
          );
        });

        // Generate matching invoice
        const invId = 'inv-' + Date.now();
        const invCode = sqliteService.getNextSequence('INV');
        const totalInv = Number(appAmountDisbursed) + Number(appInterestCharges);

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
            ':customer_id': custId,
            ':issue_date': appDateReceived,
            ':due_date': appDueDate,
            ':subtotal': totalInv,
            ':tax': 0,
            ':total_amount': totalInv,
            ':status': 'Unpaid',
            ':notes': `Collateral loan cash advance funded by ${appFunder} for ${appCategory} (${appBrand} ${appModel})`,
            ':created_at': nowStr
          }
        );

        sqliteService.run(
          `INSERT INTO invoice_items (id, invoice_id, part_id, description, quantity, unit_price, total_price)
           VALUES (:id, :iid, NULL, :desc, 1, :pr, :pr)`,
          {
            ':id': 'itm-' + Date.now(),
            ':iid': invId,
            ':desc': `Cash Advance Disbursed by Director ${appFunder} (30% interest)`,
            ':pr': Number(appAmountDisbursed)
          }
        );

        sqliteService.logAudit(
          appFunder,
          'CREATE_CUSTOMER_WITH_APPLIANCE',
          'CUSTOMER',
          custId,
          `Registered customer ${name} (${custCode}) with collateral ${colCode} and Rehani loan ${loanCode} funded by ${appFunder} KES ${appAmountDisbursed} (30% interest: KES ${appInterestCharges}) due on ${appDueDate}`
        );
      } else {
        sqliteService.logAudit(
          currentUser?.full_name || 'Admin',
          'CREATE_CUSTOMER',
          'CUSTOMER',
          custId,
          `Registered permanent customer: ${name} (${custCode}, ID: ${idNumber}) with phone: ${phone}`
        );
      }

      setIsAddCustomerOpen(false);
      setSelectedCustomerId(custId);

      // Reset form fields
      setName('');
      setIdNumber('');
      setPhone('+254 ');
      setAltPhone('N/A');
      setEmail('');
      setAddress('');
      setCounty('Nairobi');
      setNotes('');
      setNewCustomerPhoto('');
      setAppBrand('');
      setAppModel('');
      setAppSerialNumber('');
      setAppPhotos([]);
      setAppNotes('');
      setAppTermDays(14);
      setAppAmountDisbursed(10000);
      setAppInterestCharges(3000);

      alert(
        includeAppliance
          ? `Customer ${name} & Collateral successfully registered!\n` +
            `• Loan Number: ${createdLoanCode}\n` +
            `• Collateral ID: ${createdApplianceCode}\n` +
            `• Principal: KES ${formatKES(appAmountDisbursed)}\n` +
            `• 30% Interest (2 Weeks): KES ${formatKES(appInterestCharges)}\n` +
            `• Total Due to Redeem: KES ${formatKES(Number(appAmountDisbursed) + Number(appInterestCharges))}\n` +
            `• Due Date: ${appDueDate} (Strict 14-day cycle maximum)\n` +
            `• Disbursed by: ${appFunder}`
          : `Customer ${name} permanent profile registered successfully!`
      );
    } catch (err: any) {
      alert('Error during registration: ' + err.message);
    }
  };

  const handleOpenEditCustomer = () => {
    if (!selectedCustomer) return;
    setEditName(selectedCustomer.name);
    setEditIdNumber(selectedCustomer.id_number);
    setEditPhone(selectedCustomer.phone);
    setEditEmail(selectedCustomer.email || '');
    setEditAddress(selectedCustomer.address || '');
    setEditNotes(selectedCustomer.notes || '');
    setEditPhoto(selectedCustomer.photo_url || '');
    setIsEditCustomerOpen(true);
  };

  const handleSaveCustomerEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    if (!editName.trim() || !editIdNumber.trim() || !editPhone.trim()) {
      alert('Name, National ID, and Phone Number are required.');
      return;
    }

    try {
      sqliteService.updateCustomer(selectedCustomer.id, {
        name: editName.trim(),
        id_number: editIdNumber.trim(),
        phone: editPhone.trim(),
        email: editEmail.trim() || undefined,
        address: editAddress.trim() || undefined,
        notes: editNotes.trim() || undefined,
        photo_url: editPhoto || undefined
      });

      setIsEditCustomerOpen(false);
    } catch (err: any) {
      alert('Failed to update customer: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Action Bar with Tiffany & Glass styling */}
      <div className="glass-panel p-5 rounded-2xl border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-white uppercase">
              Customer Database & Identification
            </h1>
            <span className="text-[11px] font-mono font-bold text-[#0ABAB5] bg-[#0ABAB5]/10 border border-[#0ABAB5]/30 px-2 py-0.5 rounded-full">
              {customers.length} Verified Clients
            </span>
          </div>
          <p className="text-xs text-slate-300 mt-1">
            Register clients, National IDs, phone numbers, portrait photos, and intake collateral loans in a single unified step.
          </p>
        </div>

        <button
          onClick={() => setIsAddCustomerOpen(true)}
          className="px-4 py-2.5 bg-[#0ABAB5] hover:bg-[#1FD2CD] text-black font-extrabold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-[#0ABAB5]/20 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Customer & Collateral Appliance</span>
        </button>
      </div>

      {/* Two Column Layout: List on Left, Profile Detail on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Customer Directory List */}
        <div className="lg:col-span-5 space-y-3">
          {/* Search box with glassmorphism */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search client name, National ID, or phone..."
              className="w-full pl-9 pr-4 py-2.5 glass-input rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#0ABAB5] font-mono"
            />
          </div>

          <div className="glass-panel rounded-2xl overflow-hidden divide-y divide-white/5 max-h-[640px] overflow-y-auto border border-white/10">
            {filteredCustomers.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No customers found matching search query. Click "Add Customer & Collateral" above.
              </div>
            ) : (
              filteredCustomers.map((cust) => {
                const isSelected = cust.id === selectedCustomerId;
                const custApps = appliances.filter((a) => a.customer_id === cust.id);
                return (
                  <div
                    key={cust.id}
                    onClick={() => setSelectedCustomerId(cust.id)}
                    className={`p-3.5 cursor-pointer transition-all flex items-center gap-3.5 ${
                      isSelected
                        ? 'bg-[#0ABAB5]/15 border-l-4 border-[#0ABAB5]'
                        : 'hover:bg-white/[0.04]'
                    }`}
                  >
                    {/* Customer Photo Thumbnail */}
                    <div className="relative shrink-0">
                      {cust.photo_url ? (
                        <img
                          src={cust.photo_url}
                          alt={cust.name}
                          className="w-11 h-11 rounded-xl object-cover border border-[#0ABAB5]/40 shadow-sm"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-xl bg-slate-800 border border-white/15 flex items-center justify-center text-[#0ABAB5] font-extrabold text-xs shadow-sm">
                          {cust.name.substring(0, 2).toUpperCase()}
                        </div>
                      )}
                      {cust.photo_url && (
                        <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-[#0ABAB5] rounded-full border-2 border-slate-900" title="Photo Verified" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white text-xs truncate">{cust.name}</span>
                        <span className="text-[11px] font-mono text-slate-400 shrink-0 ml-1">ID: {cust.id_number}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                        <span className="font-mono text-[#0ABAB5] font-semibold">{cust.phone}</span>
                        <span className="text-[10px] bg-white/5 border border-white/10 px-2 py-0.5 rounded-full text-slate-300">
                          {custApps.length} item{custApps.length === 1 ? '' : 's'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Customer Profile & Comprehensive History */}
        <div className="lg:col-span-7">
          {selectedCustomer ? (
            <div className="glass-panel rounded-2xl p-6 space-y-6 border border-white/10">
              {/* Profile Card & Customer Image Section */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-5 border-b border-white/10 pb-6">
                <div className="flex items-start gap-4">
                  {/* Photo Display with Click-to-Change */}
                  <div className="relative group shrink-0">
                    {selectedCustomer.photo_url ? (
                      <img
                        src={selectedCustomer.photo_url}
                        alt={selectedCustomer.name}
                        className="w-20 h-20 rounded-2xl object-cover border-2 border-[#0ABAB5]/50 shadow-lg shadow-[#0ABAB5]/10"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-2xl bg-slate-800 border-2 border-dashed border-[#0ABAB5]/40 flex flex-col items-center justify-center text-slate-400 p-2 text-center">
                        <Camera className="w-5 h-5 text-[#0ABAB5] mb-1" />
                        <span className="text-[9px] text-[#0ABAB5] font-semibold">No Photo</span>
                      </div>
                    )}

                    {/* Change photo button trigger */}
                    <button
                      onClick={() => profilePhotoInputRef.current?.click()}
                      className="absolute inset-0 bg-black/60 rounded-2xl opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white transition-opacity cursor-pointer border border-[#0ABAB5]"
                      title="Upload or update customer photo"
                    >
                      <Camera className="w-5 h-5 text-[#0ABAB5]" />
                      <span className="text-[9px] font-bold mt-0.5">Update</span>
                    </button>

                    <input
                      ref={profilePhotoInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleProfilePhotoSelect}
                      className="hidden"
                    />
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-black text-white">{selectedCustomer.name}</h2>
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-[#0ABAB5] bg-[#0ABAB5]/10 border border-[#0ABAB5]/30 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Marked to Client</span>
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-1.5">
                      <span className="font-mono text-slate-300 bg-white/5 px-2 py-0.5 rounded border border-white/10">
                        National ID: <strong className="text-white">{selectedCustomer.id_number}</strong>
                      </span>
                      <span className="font-mono text-[#0ABAB5] font-bold text-sm bg-[#0ABAB5]/10 px-2 py-0.5 rounded border border-[#0ABAB5]/20">
                        {selectedCustomer.phone}
                      </span>
                    </div>

                    {selectedCustomer.email && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1.5">
                        <Mail className="w-3.5 h-3.5 text-slate-500" />
                        <span>{selectedCustomer.email}</span>
                      </div>
                    )}

                    {selectedCustomer.address && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-500" />
                        <span>{selectedCustomer.address}</span>
                      </div>
                    )}

                    {/* Button to upload photo if none exists */}
                    {!selectedCustomer.photo_url && (
                      <button
                        onClick={() => profilePhotoInputRef.current?.click()}
                        className="mt-2.5 inline-flex items-center gap-1.5 text-[11px] font-bold text-[#0ABAB5] hover:text-white bg-[#0ABAB5]/10 hover:bg-[#0ABAB5]/20 border border-[#0ABAB5]/30 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>Upload Client Portrait / ID Photo</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    onClick={handleOpenEditCustomer}
                    className="px-3 py-1.5 bg-[#0ABAB5]/15 hover:bg-[#0ABAB5]/25 text-[#0ABAB5] border border-[#0ABAB5]/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Edit Customer Details (Name, Phone, ID, Address)"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit Details</span>
                  </button>

                  <a
                    href={generateWhatsAppLink(selectedCustomer.phone, `Habari ${selectedCustomer.name}, this is ${STORE_NAME}. Official Helpline: ${STORE_TEL}`)}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </a>

                  <a
                    href={`tel:${selectedCustomer.phone}`}
                    className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-slate-200 border border-white/15 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Phone className="w-3.5 h-3.5 text-[#0ABAB5]" />
                    <span>Call</span>
                  </a>
                </div>
              </div>

              {/* Financial Snapshot in Glass Cards */}
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="glass-card p-3 rounded-xl border border-white/10">
                  <span className="text-slate-400 text-[11px]">Total Money Advanced:</span>
                  <div className="text-base font-bold text-white font-mono-numbers mt-1">
                    {formatKES(totalDisbursed)}
                  </div>
                </div>

                <div className="glass-card p-3 rounded-xl border border-white/10">
                  <span className="text-slate-400 text-[11px]">Total Repaid to Shop:</span>
                  <div className="text-base font-bold text-emerald-400 font-mono-numbers mt-1">
                    {formatKES(totalPaid)}
                  </div>
                </div>

                <div className="glass-card p-3 rounded-xl border border-white/10">
                  <span className="text-slate-400 text-[11px]">Outstanding Due:</span>
                  <div className="text-base font-bold text-rose-400 font-mono-numbers mt-1">
                    {formatKES(totalOutstanding)}
                  </div>
                </div>
              </div>

              {/* Customer Notes */}
              {selectedCustomer.notes && (
                <div className="glass-card p-3 rounded-xl border border-white/10 text-xs text-slate-300">
                  <span className="font-semibold text-slate-400 block text-[11px] mb-1">Customer History & Collateral Notes:</span>
                  <p>"{selectedCustomer.notes}"</p>
                </div>
              )}

              {/* Appliances & Collaterals Brought */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Tv className="w-3.5 h-3.5 text-[#0ABAB5]" />
                    <span>Appliances & Collaterals Marked to this Client ({customerAppliances.length})</span>
                  </h3>

                  <button
                    onClick={() => onOpenNewApplianceForCustomer(selectedCustomer.id)}
                    className="text-xs text-[#0ABAB5] hover:text-[#1FD2CD] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Intake New Item</span>
                  </button>
                </div>

                {customerAppliances.length === 0 ? (
                  <div className="glass-card p-6 rounded-xl border border-white/10 text-slate-400 text-xs text-center">
                    No appliances recorded for this customer yet. Click "Intake New Item" to disburse money against their collateral.
                  </div>
                ) : (
                  <div className="divide-y divide-white/10 border border-white/10 rounded-xl overflow-hidden text-xs glass-card">
                    {customerAppliances.map((app) => {
                      const { balanceRemaining } = sqliteService.calculateApplianceBalance(app);
                      return (
                        <div
                          key={app.id}
                          onClick={() => onSelectAppliance(app.id)}
                          className="p-3.5 hover:bg-white/[0.05] cursor-pointer flex items-center justify-between transition-colors"
                        >
                          <div>
                            <span className="font-mono font-bold text-[#0ABAB5] mr-2">{app.appliance_number}</span>
                            <span className="font-semibold text-white">{app.category}</span>
                            <span className="text-slate-400 ml-1.5 text-[11px]">({app.brand} {app.model})</span>
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              Funded by: <span className="font-bold text-white">{app.funder}</span> · Due Date: <span className="font-mono text-[#0ABAB5] font-bold">{app.due_date}</span>
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="font-mono-numbers font-bold text-white">
                              Disbursed: {formatKES(app.amount_received)}
                            </div>
                            <div className="text-[11px] mt-0.5">
                              {balanceRemaining > 0 ? (
                                <span className="text-rose-400 font-mono-numbers font-bold">
                                  Due: {formatKES(balanceRemaining)}
                                </span>
                              ) : (
                                <span className="text-emerald-400 font-bold">✓ Cleared</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Payment History */}
              <div className="space-y-3 pt-2">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Repayment History ({customerPayments.length})</span>
                </h3>

                {customerPayments.length === 0 ? (
                  <div className="glass-card p-4 rounded-xl border border-white/10 text-slate-400 text-xs text-center">
                    No payments received from this customer yet.
                  </div>
                ) : (
                  <div className="divide-y divide-white/10 border border-white/10 rounded-xl overflow-hidden text-xs glass-card">
                    {customerPayments.map((p) => (
                      <div key={p.id} className="p-3 flex items-center justify-between">
                        <div>
                          <span className="font-mono font-bold text-[#0ABAB5] mr-2">{p.receipt_number}</span>
                          <span className="text-slate-300">{p.payment_method}</span>
                          {p.mpesa_code && <span className="text-emerald-400 font-mono ml-1.5 font-bold">[{p.mpesa_code}]</span>}
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {p.payment_date} · Received by: <strong className="text-white">{p.received_by}</strong>
                          </div>
                        </div>
                        <div className="font-mono-numbers font-black text-emerald-400 text-sm">
                          {formatKES(p.amount)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="glass-panel rounded-2xl p-12 text-center text-slate-400 border border-white/10">
              <Users className="w-12 h-12 mx-auto mb-3 text-slate-600" />
              <p className="text-sm">Select a customer from the left to view full identity verification, photo, and transaction history.</p>
            </div>
          )}
        </div>
      </div>

      {/* COMBINED ADD CUSTOMER + COLLATERAL APPLIANCE MODAL (TREVOR OR PETER DISBURSAL & DUE DATE) */}
      {isAddCustomerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xl p-4 overflow-y-auto">
          <div className="w-full max-w-2xl glass-panel border border-white/20 rounded-2xl shadow-2xl p-6 space-y-5 my-8 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-[#0ABAB5]" />
                <h3 className="font-extrabold text-white text-base">
                  Add Customer Details & Intake Collateral Appliance
                </h3>
              </div>
              <button
                onClick={() => setIsAddCustomerOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomerAndAppliance} className="space-y-5 text-xs">
              {/* SECTION 1: CUSTOMER DETAILS */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                  <span className="font-extrabold text-sm text-white uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-[#0ABAB5] text-black font-extrabold text-xs flex items-center justify-center">1</span>
                    <span>Customer Personal Details & Identification</span>
                  </span>
                  <span className="text-[10px] text-[#0ABAB5] font-mono font-bold">Client Verification</span>
                </div>

                {/* Customer Photo Upload Dropzone */}
                <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 flex items-center gap-4">
                  <div className="w-20 h-20 rounded-xl border-2 border-dashed border-[#0ABAB5]/50 bg-slate-900 flex items-center justify-center overflow-hidden shrink-0 relative group">
                    {newCustomerPhoto ? (
                      <>
                        <img src={newCustomerPhoto} alt="Customer" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setNewCustomerPhoto('')}
                          className="absolute inset-0 bg-black/70 flex items-center justify-center text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <div className="text-center p-1">
                        <ImageIcon className="w-5 h-5 text-slate-500 mx-auto mb-0.5" />
                        <span className="text-[8px] text-slate-400 block">Client Photo</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5 flex-1">
                    <span className="font-bold text-white text-[11px] block">Upload Customer Portrait / National ID</span>
                    <p className="text-[11px] text-slate-400 leading-tight">
                      Take a snapshot or upload client photo to link it permanently to their profile.
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => modalPhotoInputRef.current?.click()}
                        className="px-3 py-1.5 bg-[#0ABAB5] hover:bg-[#1FD2CD] text-black font-bold rounded-lg text-xs flex items-center gap-1 cursor-pointer transition-all"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>{newCustomerPhoto ? 'Change Photo' : 'Snap / Upload Photo'}</span>
                      </button>
                      {newCustomerPhoto && (
                        <button
                          type="button"
                          onClick={() => setNewCustomerPhoto('')}
                          className="px-2.5 py-1.5 bg-rose-950/60 text-rose-300 border border-rose-800/60 rounded-lg text-xs"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    <input
                      ref={modalPhotoInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleModalPhotoSelect}
                      className="hidden"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-300 mb-1">Customer Full Name *</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Samuel Kimani Wachira"
                      className="w-full py-2.5 px-3 glass-input rounded-xl text-white text-xs focus:outline-none focus:border-[#0ABAB5]"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-300 mb-1">National ID / Passport No *</label>
                    <input
                      type="text"
                      value={idNumber}
                      onChange={(e) => setIdNumber(e.target.value)}
                      placeholder="e.g. 29481923"
                      className="w-full py-2.5 px-3 glass-input rounded-xl text-white font-mono text-xs focus:outline-none focus:border-[#0ABAB5]"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-300 mb-1">Customer Phone / Tel No *</label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="e.g. 0727108749 or 0180366344"
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
                      placeholder="e.g. 0712345678 or N/A"
                      className="w-full py-2.5 px-3 glass-input rounded-xl text-white font-mono text-xs focus:outline-none focus:border-[#0ABAB5]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-300 mb-1">Residential Address / Estate</label>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="e.g. Kahawa West, Kasarani, Nairobi"
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
                      <option value="Nakuru" className="bg-slate-900">Nakuru</option>
                      <option value="Eldoret / Uasin Gishu" className="bg-slate-900">Eldoret / Uasin Gishu</option>
                      <option value="Machakos" className="bg-slate-900">Machakos</option>
                      <option value="Kajiado" className="bg-slate-900">Kajiado</option>
                      <option value="Other County" className="bg-slate-900">Other County</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Email Address (Optional)</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="client@example.com"
                    className="w-full py-2.5 px-3 glass-input rounded-xl text-white text-xs focus:outline-none focus:border-[#0ABAB5]"
                  />
                </div>
              </div>

              {/* SECTION 2: APPLIANCE & COLLATERAL LOAN DETAILS (TREVOR / PETER / DUE DATE) */}
              <div className="p-4 rounded-xl bg-black/50 border border-white/15 space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeAppliance}
                      onChange={(e) => setIncludeAppliance(e.target.checked)}
                      className="w-4 h-4 accent-[#0ABAB5] rounded cursor-pointer"
                    />
                    <span className="font-extrabold text-sm text-white uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-[#0ABAB5] text-black font-extrabold text-xs flex items-center justify-center">2</span>
                      <span>Intake Collateral Appliance & Advance Money Now</span>
                    </span>
                  </label>
                  <span className="text-[11px] text-[#0ABAB5] font-mono font-bold">
                    {includeAppliance ? 'Appliance Intake Active' : 'Skip Appliance'}
                  </span>
                </div>

                {includeAppliance && (
                  <div className="space-y-4 pt-1">
                    {/* Who is Disbursing the Money? (Trevor vs Peter) */}
                    <div>
                      <label className="block font-bold text-white mb-1.5">
                        Who is Giving Out the Money? (Capital Funder) *
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setAppFunder('Trevor')}
                          className={`p-3 rounded-xl border text-left flex items-center justify-between cursor-pointer transition-all ${
                            appFunder === 'Trevor'
                              ? 'bg-[#0ABAB5]/20 border-[#0ABAB5] shadow-lg shadow-[#0ABAB5]/10 text-white'
                              : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                          }`}
                        >
                          <div>
                            <span className="font-extrabold text-sm block text-[#0ABAB5]">Trevor Mbugua</span>
                            <span className="text-[10px] text-slate-400">Co-Director (Disbursed by Trevor)</span>
                          </div>
                          {appFunder === 'Trevor' && (
                            <CheckCircle2 className="w-5 h-5 text-[#0ABAB5]" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => setAppFunder('Peter')}
                          className={`p-3 rounded-xl border text-left flex items-center justify-between cursor-pointer transition-all ${
                            appFunder === 'Peter'
                              ? 'bg-white/20 border-white shadow-lg shadow-white/10 text-white'
                              : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                          }`}
                        >
                          <div>
                            <span className="font-extrabold text-sm block text-white">Peter Kamau</span>
                            <span className="text-[10px] text-slate-400">Co-Director (Disbursed by Peter)</span>
                          </div>
                          {appFunder === 'Peter' && (
                            <CheckCircle2 className="w-5 h-5 text-white" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Category & Custom Category */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold text-slate-300 mb-1">Appliance Category *</label>
                        <select
                          value={appCategory}
                          onChange={(e) => setAppCategory(e.target.value as ApplianceCategory)}
                          className="w-full py-2.5 px-3 glass-input rounded-xl text-white text-xs focus:outline-none focus:border-[#0ABAB5] cursor-pointer"
                        >
                          {APPLIANCE_CATEGORIES.map((cat) => (
                            <option key={cat} value={cat} className="bg-slate-900 text-white">
                              {cat}
                            </option>
                          ))}
                        </select>
                      </div>

                      {((appCategory as string) === 'Other appliances' || (appCategory as string) === 'Other Collateral') ? (
                        <div>
                          <label className="block font-bold text-slate-300 mb-1">Specify Other Appliance *</label>
                          <input
                            type="text"
                            value={appCustomCategory}
                            onChange={(e) => setAppCustomCategory(e.target.value)}
                            placeholder="e.g. Generator, Blender, Water Dispenser"
                            className="w-full py-2.5 px-3 glass-input rounded-xl text-white text-xs focus:outline-none focus:border-[#0ABAB5]"
                            required
                          />
                        </div>
                      ) : (
                        <div>
                          <label className="block font-bold text-slate-300 mb-1">Brand Name *</label>
                          <input
                            type="text"
                            value={appBrand}
                            onChange={(e) => setAppBrand(e.target.value)}
                            placeholder="e.g. Samsung, Sony, Ramtons, Mika"
                            className="w-full py-2.5 px-3 glass-input rounded-xl text-white text-xs focus:outline-none focus:border-[#0ABAB5]"
                            required
                          />
                        </div>
                      )}
                    </div>

                    {((appCategory as string) === 'Other appliances' || (appCategory as string) === 'Other Collateral') && (
                      <div>
                        <label className="block font-bold text-slate-300 mb-1">Brand Name *</label>
                        <input
                          type="text"
                          value={appBrand}
                          onChange={(e) => setAppBrand(e.target.value)}
                          placeholder="e.g. Samsung, Sony, Ramtons, Mika"
                          className="w-full py-2.5 px-3 glass-input rounded-xl text-white text-xs focus:outline-none focus:border-[#0ABAB5]"
                          required
                        />
                      </div>
                    )}

                    {/* Model & Serial Number */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold text-slate-300 mb-1">Model / Size Specification *</label>
                        <input
                          type="text"
                          value={appModel}
                          onChange={(e) => setAppModel(e.target.value)}
                          placeholder="e.g. 55-inch 4K Smart, 213L Double Door, 13kg cylinder"
                          className="w-full py-2.5 px-3 glass-input rounded-xl text-white text-xs focus:outline-none focus:border-[#0ABAB5]"
                          required
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-300 mb-1">Serial Number (Optional)</label>
                        <input
                          type="text"
                          value={appSerialNumber}
                          onChange={(e) => setAppSerialNumber(e.target.value)}
                          placeholder="e.g. SN-8921829"
                          className="w-full py-2.5 px-3 glass-input rounded-xl text-white font-mono text-xs focus:outline-none focus:border-[#0ABAB5]"
                        />
                      </div>
                    </div>

                    {/* Financials: Valuation, Disbursed Loan & 30% Interest Fee */}
                    <div className="p-3.5 bg-black/40 border border-white/10 rounded-2xl space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block font-bold text-slate-300 mb-1">Market Valuation (KES) *</label>
                          <input
                            type="number"
                            value={appMarketValue}
                            onChange={(e) => setAppMarketValue(Number(e.target.value))}
                            className="w-full py-2.5 px-3 glass-input rounded-xl text-white font-mono text-xs focus:outline-none focus:border-[#0ABAB5]"
                            required
                          />
                        </div>

                        <div>
                          <label className="block font-bold text-[#0ABAB5] mb-1">
                            Money Given Out by {appFunder} (KES) *
                          </label>
                          <input
                            type="number"
                            value={appAmountDisbursed}
                            onChange={(e) => handleAmountDisbursedChange(Number(e.target.value))}
                            className="w-full py-2.5 px-3 glass-input rounded-xl text-[#0ABAB5] font-bold font-mono text-sm focus:outline-none focus:border-[#0ABAB5]"
                            required
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="font-bold text-amber-400">
                              Interest (30% per 2 Wks) *
                            </label>
                            <span className="text-[10px] text-amber-400 font-mono font-bold">30% Fixed</span>
                          </div>
                          <input
                            type="number"
                            value={appInterestCharges}
                            onChange={(e) => setAppInterestCharges(Number(e.target.value))}
                            className="w-full py-2.5 px-3 glass-input rounded-xl text-amber-400 font-mono font-bold text-xs focus:outline-none focus:border-amber-400"
                            required
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-white/10">
                        <span>Standard Rate: <strong>30% per two-week cycle</strong></span>
                        <button
                          type="button"
                          onClick={() => setAppInterestCharges(Math.round(appAmountDisbursed * 0.3))}
                          className="text-[#0ABAB5] hover:underline font-mono text-[10px] cursor-pointer"
                        >
                          ⚡ Auto-Recalculate 30% (KES {formatKES(Math.round(appAmountDisbursed * 0.3))})
                        </button>
                      </div>
                    </div>

                    {/* Date Received & Strictly Maximum 2-Week Due Date */}
                    <div className="p-3.5 bg-black/40 border border-[#0ABAB5]/40 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white text-xs flex items-center gap-1.5">
                          <Clock className="w-4 h-4 text-[#0ABAB5]" />
                          <span>Collateral Term: Maximum 2 Weeks (14 Days)</span>
                        </span>
                        <span className="text-[10px] bg-rose-950/60 text-rose-300 border border-rose-800/40 px-2.5 py-0.5 rounded-full font-bold">
                          Maximum 14 Days
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block font-bold text-slate-300 mb-1 flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-[#0ABAB5]" />
                            <span>Date Received</span>
                          </label>
                          <input
                            type="date"
                            value={appDateReceived}
                            onChange={(e) => handleDateReceivedChange(e.target.value)}
                            className="w-full py-2.5 px-3 glass-input rounded-xl text-white font-mono text-xs focus:outline-none focus:border-[#0ABAB5]"
                            required
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="font-bold text-rose-400 flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-rose-400" />
                              <span>Due Date (Max 14 Days) *</span>
                            </label>
                            <span className="text-[10px] text-[#0ABAB5] font-mono font-bold">{appTermDays} Days</span>
                          </div>
                          <input
                            type="date"
                            min={appDateReceived}
                            max={calculateLoanDueDate(appDateReceived, 14)}
                            value={appDueDate}
                            onChange={(e) => handleDueDateChange(e.target.value)}
                            className="w-full py-2.5 px-3 glass-input rounded-xl text-rose-400 font-bold font-mono text-xs focus:outline-none focus:border-rose-400"
                            required
                          />
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-[10px] text-slate-400">Quick Term:</span>
                            <button
                              type="button"
                              onClick={() => handleTermDaysSelect(7)}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer border ${
                                appTermDays === 7
                                  ? 'bg-[#0ABAB5] text-black border-[#0ABAB5]'
                                  : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                              }`}
                            >
                              1 Week (7 Days)
                            </button>
                            <button
                              type="button"
                              onClick={() => handleTermDaysSelect(14)}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer border ${
                                appTermDays === 14
                                  ? 'bg-rose-500 text-white border-rose-400 font-extrabold'
                                  : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                              }`}
                            >
                              2 Weeks (14 Days - Max)
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Real-Time Repayment Calculation Summary */}
                      <div className="p-3 bg-black/60 rounded-xl border border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div>
                          <div className="text-[10px] text-slate-400 uppercase font-semibold">Principal Disbursed:</div>
                          <div className="text-white font-mono font-bold text-sm">{formatKES(appAmountDisbursed)}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-[10px] text-amber-400 uppercase font-semibold">+ 30% Interest (2 Wks):</div>
                          <div className="text-amber-400 font-mono font-bold text-sm">+{formatKES(appInterestCharges)}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] text-[#0ABAB5] uppercase font-semibold">Total Due to Redeem:</div>
                          <div className="text-[#0ABAB5] font-mono-numbers font-black text-base">
                            {formatKES(Number(appAmountDisbursed) + Number(appInterestCharges))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Condition & Physical Photos */}
                    <div>
                      <label className="block font-bold text-slate-300 mb-1">Physical Condition Inspection</label>
                      <input
                        type="text"
                        value={appCondition}
                        onChange={(e) => setAppCondition(e.target.value)}
                        placeholder="e.g. Minor scratches, cables intact, tested working before client"
                        className="w-full py-2.5 px-3 glass-input rounded-xl text-white text-xs focus:outline-none focus:border-[#0ABAB5]"
                      />
                    </div>

                    {/* Appliance Photo Upload */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="font-bold text-slate-300 flex items-center gap-1.5">
                          <Camera className="w-3.5 h-3.5 text-[#0ABAB5]" />
                          <span>Appliance Photos (Direct Capture / File Upload)</span>
                        </label>
                        <span className="text-[10px] text-slate-400">{appPhotos.length} photo(s) attached</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => appliancePhotoInputRef.current?.click()}
                          className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer border border-white/15"
                        >
                          <Upload className="w-3.5 h-3.5 text-[#0ABAB5]" />
                          <span>Add Item Photos</span>
                        </button>
                        <input
                          ref={appliancePhotoInputRef}
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handleAppliancePhotoSelect}
                          className="hidden"
                        />
                      </div>

                      {appPhotos.length > 0 && (
                        <div className="flex items-center gap-2 overflow-x-auto py-1">
                          {appPhotos.map((p, idx) => (
                            <div key={idx} className="relative w-16 h-16 rounded-xl overflow-hidden border border-[#0ABAB5]/40 shrink-0">
                              <img src={p} alt={`Appliance ${idx}`} className="w-full h-full object-cover" />
                              <button
                                type="button"
                                onClick={() => setAppPhotos(appPhotos.filter((_, i) => i !== idx))}
                                className="absolute top-1 right-1 bg-rose-600 text-white rounded-full p-0.5"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-2.5 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsAddCustomerOpen(false)}
                  className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold cursor-pointer border border-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-[#0ABAB5] hover:bg-[#1FD2CD] text-black font-black rounded-xl text-xs cursor-pointer shadow-lg shadow-[#0ABAB5]/20 flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {includeAppliance
                      ? `Save Customer & Collateral (Disbursed by ${appFunder})`
                      : 'Save Customer Profile Only'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT CUSTOMER DETAILS MODAL */}
      {isEditCustomerOpen && selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl p-4 overflow-y-auto">
          <div className="w-full max-w-lg glass-panel border border-white/15 rounded-2xl shadow-2xl p-6 space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-[#0ABAB5]" />
                <h3 className="font-extrabold text-white text-base">Edit Customer Profile & Details</h3>
              </div>
              <button
                onClick={() => setIsEditCustomerOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomerEdit} className="space-y-4 text-xs">
              {/* Photo Section in Edit */}
              <div className="p-3 bg-black/40 border border-white/10 rounded-xl flex items-center gap-3">
                <div className="w-16 h-16 rounded-xl border border-[#0ABAB5]/40 overflow-hidden shrink-0 bg-slate-900">
                  {editPhoto ? (
                    <img src={editPhoto} alt="Customer" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-500 text-[10px]">No Photo</div>
                  )}
                </div>
                <div className="space-y-1.5 flex-1">
                  <span className="text-[11px] font-bold text-slate-300 block">Customer Portrait / ID Photo</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => editModalPhotoInputRef.current?.click()}
                      className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold cursor-pointer border border-white/15"
                    >
                      {editPhoto ? 'Change Photo' : 'Upload Photo'}
                    </button>
                    {editPhoto && (
                      <button
                        type="button"
                        onClick={() => setEditPhoto('')}
                        className="px-2.5 py-1 bg-rose-950/60 text-rose-300 rounded-lg text-xs cursor-pointer border border-rose-800/60"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <input
                    ref={editModalPhotoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleEditModalPhotoSelect}
                    className="hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Full Customer Name *</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full py-2.5 px-3 glass-input rounded-xl text-white text-xs focus:outline-none focus:border-[#0ABAB5]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">National ID / Passport No *</label>
                  <input
                    type="text"
                    value={editIdNumber}
                    onChange={(e) => setEditIdNumber(e.target.value)}
                    className="w-full py-2.5 px-3 glass-input rounded-xl text-white font-mono text-xs focus:outline-none focus:border-[#0ABAB5]"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Customer Phone / Tel No *</label>
                  <input
                    type="text"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="e.g. 0727108749 or 0180366344"
                    className="w-full py-2.5 px-3 glass-input rounded-xl text-white font-mono text-xs focus:outline-none focus:border-[#0ABAB5]"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full py-2.5 px-3 glass-input rounded-xl text-white text-xs focus:outline-none focus:border-[#0ABAB5]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-300 mb-1">Residential Address / Estate</label>
                  <input
                    type="text"
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                    className="w-full py-2.5 px-3 glass-input rounded-xl text-white text-xs focus:outline-none focus:border-[#0ABAB5]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">History / Background Notes</label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full py-2.5 px-3 glass-input rounded-xl text-white text-xs focus:outline-none focus:border-[#0ABAB5]"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsEditCustomerOpen(false)}
                  className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold cursor-pointer border border-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#0ABAB5] hover:bg-[#1FD2CD] text-black font-extrabold rounded-xl text-xs cursor-pointer shadow-lg shadow-[#0ABAB5]/20 flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
