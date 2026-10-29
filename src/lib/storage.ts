import { supabase } from './supabase';
import {
  UserProfile,
  ProductType,
  Party,
  PartyType,
  WeighingTicket,
  Shipment,
  FactorySale,
  CashAccount,
  CashTransaction,
  StockOpname,
  LoanDebt,
  AuditLog,
  AppSettings,
  ProductTypeId,
} from '../types';

class StorageService {
  // Session handling (still uses localStorage for speed, but auth is via Supabase)
  getCurrentUser(): UserProfile | null {
    const data = localStorage.getItem('ram_sr_current_user');
    return data ? JSON.parse(data) : null;
  }

  setCurrentUser(user: UserProfile | null): void {
    if (user) {
      localStorage.setItem('ram_sr_current_user', JSON.stringify(user));
      this.addAuditLog({
        action: 'LOGIN',
        entityType: 'USER_SESSION',
        entityId: user.id,
        details: `User logged in: ${user.name} (${user.role})`,
      });
    } else {
      localStorage.removeItem('ram_sr_current_user');
    }
  }

  // Products
  async getProducts(): Promise<ProductType[]> {
    const { data, error } = await supabase
      .from('product_types')
      .select('*')
      .order('name');
    
    if (error) {
      console.error('Error fetching products:', error);
      return [];
    }
    return data.map(p => ({
      id: p.id,
      name: p.name,
      code: p.code,
      defaultPricePerKg: p.default_price_per_kg,
      defaultRafaksiPct: p.default_rafaksi_pct,
      description: p.description
    }));
  }

  async saveProduct(product: ProductType): Promise<boolean> {
    const { error } = await supabase
      .from('product_types')
      .update({
        name: product.name,
        code: product.code,
        default_price_per_kg: product.defaultPricePerKg,
        default_rafaksi_pct: product.defaultRafaksiPct,
        description: product.description
      })
      .eq('id', product.id);

    if (error) {
      console.error('Error saving product:', error);
      return false;
    }
    return true;
  }

  // Parties
  async getParties(type?: PartyType): Promise<Party[]> {
    let query = supabase.from('parties').select('*').order('name');
    if (type) query = query.eq('type', type);
    
    const { data, error } = await query;
    if (error) {
      console.error('Error fetching parties:', error);
      return [];
    }
    return data.map(p => ({
      id: p.id,
      type: p.type,
      name: p.name,
      phone: p.phone,
      address: p.address,
      vehiclePlate: p.vehicle_plate,
      defaultCommissionPerKg: p.default_commission_per_kg,
      totalKasbon: p.total_kasbon,
      notes: p.notes,
      createdAt: p.created_at
    }));
  }

  async addParty(party: Omit<Party, 'id' | 'createdAt'>): Promise<Party | null> {
    const { data, error } = await supabase
      .from('parties')
      .insert({
        type: party.type,
        name: party.name,
        phone: party.phone,
        address: party.address,
        vehicle_plate: party.vehiclePlate,
        default_commission_per_kg: party.defaultCommissionPerKg,
        notes: party.notes
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding party:', error);
      return null;
    }

    const newParty = {
      id: data.id,
      type: data.type,
      name: data.name,
      phone: data.phone,
      address: data.address,
      vehiclePlate: data.vehicle_plate,
      defaultCommissionPerKg: data.default_commission_per_kg,
      totalKasbon: data.total_kasbon,
      notes: data.notes,
      createdAt: data.created_at
    };

    await this.addAuditLog({
      action: 'CREATE_PARTY',
      entityType: 'PARTY',
      entityId: newParty.id,
      details: `Tambah kontak baru: ${newParty.name} (${newParty.type})`,
    });

    return newParty;
  }

  // Settings
  async getSettings(): Promise<AppSettings> {
    const { data, error } = await supabase
      .from('app_settings')
      .select('*')
      .eq('id', 'default')
      .single();

    if (error) {
      console.error('Error fetching settings:', error);
      return {
        ramName: 'RAM SUMBER REZEKI',
        address: 'Jl. Lintas Sawit Sejahtera No. 45, Riau',
        phone: '0812-7788-9900',
        defaultRafaksiPct: 3.0,
        defaultUnloadingFeePerKg: 15,
        ownerPin: '123456'
      };
    }

    return {
      ramName: data.ram_name,
      address: data.address,
      phone: data.phone,
      defaultRafaksiPct: data.default_rafaksi_pct,
      defaultUnloadingFeePerKg: data.default_unloading_fee_per_kg,
      ownerPin: '123456' // In a real app, this should be handled more securely
    };
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    const { error } = await supabase
      .from('app_settings')
      .upsert({
        id: 'default',
        ram_name: settings.ramName,
        address: settings.address,
        phone: settings.phone,
        default_rafaksi_pct: settings.defaultRafaksiPct,
        default_unloading_fee_per_kg: settings.defaultUnloadingFeePerKg
      });

    if (error) console.error('Error saving settings:', error);
  }

  // Weighing Tickets
  async getTickets(): Promise<WeighingTicket[]> {
    const { data, error } = await supabase
      .from('weighing_tickets')
      .select('*')
      .order('date', { ascending: false })
      .order('time', { ascending: false });

    if (error) {
      console.error('Error fetching tickets:', error);
      return [];
    }

    return data.map(t => ({
      id: t.id,
      ticketNumber: t.ticket_number,
      date: t.date,
      time: t.time,
      partyId: t.party_id,
      farmerName: t.farmer_name,
      vehiclePlate: t.vehicle_plate,
      productId: t.product_id,
      productName: t.product_name,
      bruto: t.bruto,
      tara: t.tara,
      netto1: t.netto1,
      rafaksiPct: t.rafaksi_pct,
      rafaksiKg: t.rafaksi_kg,
      netto2: t.netto2,
      pricePerKg: t.price_per_kg,
      baseAmount: t.base_amount,
      unloadingFeePerKg: t.unloading_fee_per_kg,
      totalUnloadingFee: t.total_unloading_fee,
      farmerPayment: t.farmer_payment,
      affiliateId: t.affiliate_id,
      affiliateName: t.affiliate_name,
      affiliateFeePerKg: t.affiliate_fee_per_kg,
      totalAffiliateFee: t.total_affiliate_fee,
      cashAccountId: t.cash_account_id,
      paymentStatus: t.payment_status,
      paidAt: t.paid_at,
      operatorName: t.operator_name,
      notes: t.notes,
      createdBy: t.created_by || '',
      createdAt: t.created_at
    }));
  }

  async generateTicketNumber(): Promise<string> {
    const today = new Date().toISOString().slice(0, 10);
    const { count, error } = await supabase
      .from('weighing_tickets')
      .select('*', { count: 'exact', head: true })
      .eq('date', today);

    if (error) console.error('Error counting today tickets:', error);
    
    const dateStr = today.replace(/-/g, '');
    const seq = String((count || 0) + 1).padStart(3, '0');
    return `TKP-${dateStr}-${seq}`;
  }

  async addWeighingTicket(data: Omit<WeighingTicket, 'id' | 'createdAt'>): Promise<WeighingTicket | null> {
    const user = this.getCurrentUser();
    const { data: newTicketData, error } = await supabase
      .from('weighing_tickets')
      .insert({
        ticket_number: data.ticketNumber,
        date: data.date,
        time: data.time,
        party_id: data.partyId,
        farmer_name: data.farmerName,
        vehicle_plate: data.vehiclePlate,
        product_id: data.productId,
        product_name: data.productName,
        bruto: data.bruto,
        tara: data.tara,
        netto1: data.netto1,
        rafaksi_pct: data.rafaksiPct,
        rafaksi_kg: data.rafaksiKg,
        netto2: data.netto2,
        price_per_kg: data.pricePerKg,
        base_amount: data.baseAmount,
        unloading_fee_per_kg: data.unloadingFeePerKg,
        total_unloading_fee: data.totalUnloadingFee,
        farmer_payment: data.farmerPayment,
        affiliate_id: data.affiliateId,
        affiliate_name: data.affiliateName,
        affiliate_fee_per_kg: data.affiliateFeePerKg,
        total_affiliate_fee: data.totalAffiliateFee,
        cash_account_id: data.cashAccountId,
        payment_status: data.paymentStatus,
        paid_at: data.paymentStatus === 'LUNAS' ? new Date().toISOString() : null,
        operator_name: data.operatorName,
        notes: data.notes,
        created_by: user?.id
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding ticket:', error);
      return null;
    }

    const ticket: WeighingTicket = {
      ...data,
      id: newTicketData.id,
      createdAt: newTicketData.created_at
    };

    // If lunas, record cash transaction
    if (ticket.paymentStatus === 'LUNAS' && ticket.farmerPayment > 0) {
      await this.addCashTransaction({
        transactionNumber: 'CTX-' + Date.now().toString().slice(-8),
        date: ticket.date,
        time: ticket.time,
        type: 'PEMBELIAN_PETANI',
        category: `Bayar TBS: ${ticket.farmerName}`,
        accountId: ticket.cashAccountId,
        direction: 'OUT',
        amount: ticket.farmerPayment,
        description: `Bayar buah tiket ${ticket.ticketNumber} (${ticket.netto2} kg @ Rp ${ticket.pricePerKg.toLocaleString('id-ID')})`,
        relatedEntityId: ticket.id,
        partyName: ticket.farmerName,
      });
    }

    // Commission
    if (ticket.totalAffiliateFee && ticket.totalAffiliateFee > 0 && ticket.affiliateName) {
      await this.addCashTransaction({
        transactionNumber: 'CTX-' + (Date.now() + 1).toString().slice(-8),
        date: ticket.date,
        time: ticket.time,
        type: 'KOMISI_AFFILIATE',
        category: `Komisi Affiliate: ${ticket.affiliateName}`,
        accountId: 'KAS_ADMIN',
        direction: 'OUT',
        amount: ticket.totalAffiliateFee,
        description: `Komisi timbang ${ticket.ticketNumber} (${ticket.netto2} kg)`,
        relatedEntityId: ticket.id,
        partyName: ticket.affiliateName,
      });
    }

    await this.addAuditLog({
      action: 'INPUT_TIMBANG',
      entityType: 'WEIGHING_TICKET',
      entityId: ticket.ticketNumber,
      details: `Input timbang petani: ${ticket.farmerName}, Netto 1: ${ticket.netto1} kg, Bayar: Rp ${ticket.farmerPayment.toLocaleString('id-ID')}`,
    });

    return ticket;
  }

  async updateWeighingTicket(id: string, data: Partial<WeighingTicket>): Promise<void> {
    const { data: oldTicket, error: fetchError } = await supabase
      .from('weighing_tickets')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) {
      console.error('Error fetching ticket for update:', fetchError);
      return;
    }

    const { error: updateError } = await supabase
      .from('weighing_tickets')
      .update({
        payment_status: data.paymentStatus,
        notes: data.notes,
        // Add other fields if needed for editing
      })
      .eq('id', id);

    if (updateError) {
      console.error('Error updating ticket:', updateError);
      return;
    }

    // Handle payment status change to LUNAS
    if (oldTicket.payment_status === 'BELUM_LUNAS' && data.paymentStatus === 'LUNAS') {
      await this.addCashTransaction({
        transactionNumber: 'CTX-' + Date.now().toString().slice(-8),
        date: oldTicket.date,
        time: oldTicket.time,
        type: 'PEMBELIAN_PETANI',
        category: `Pelunasan TBS Petani: ${oldTicket.farmer_name}`,
        accountId: oldTicket.cash_account_id,
        direction: 'OUT',
        amount: oldTicket.farmer_payment,
        description: `Pelunasan tiket ${oldTicket.ticket_number} (${oldTicket.netto2} kg)`,
        relatedEntityId: id,
        partyName: oldTicket.farmer_name,
      });
    }

    await this.addAuditLog({
      action: 'UPDATE_TIMBANG',
      entityType: 'WEIGHING_TICKET',
      entityId: oldTicket.ticket_number,
      details: `Update status timbang ${oldTicket.ticket_number}: ${oldTicket.farmer_name}`,
    });
  }

  async deleteWeighingTicket(id: string): Promise<void> {
    // Note: Cash transactions should be handled via database triggers or deleted manually
    // For simplicity here, we'll just delete the ticket
    const { data, error } = await supabase
      .from('weighing_tickets')
      .delete()
      .eq('id', id)
      .select('ticket_number, farmer_name')
      .single();

    if (error) {
      console.error('Error deleting ticket:', error);
      return;
    }

    if (data) {
      await this.addAuditLog({
        action: 'DELETE_TIMBANG',
        entityType: 'WEIGHING_TICKET',
        entityId: data.ticket_number,
        details: `Hapus timbang ${data.ticket_number} an. ${data.farmer_name}`,
      });
    }
  }

  // Shipments
  async getShipments(): Promise<Shipment[]> {
    const { data, error } = await supabase
      .from('shipments')
      .select('*')
      .order('date', { ascending: false })
      .order('time', { ascending: false });

    if (error) {
      console.error('Error fetching shipments:', error);
      return [];
    }

    return data.map(s => ({
      id: s.id,
      shipmentNumber: s.shipment_number,
      date: s.date,
      time: s.time,
      factoryId: s.factory_id,
      factoryName: s.factory_name,
      productId: s.product_id,
      productName: s.product_name,
      items: s.items,
      vehiclePlate: s.vehicle_plate,
      driverName: s.driver_name,
      driverPhone: s.driver_phone,
      ramNettoKg: s.ram_netto_kg,
      status: s.status,
      estimatedHppPerKg: s.estimated_hpp_per_kg,
      totalEstimatedHpp: s.total_estimated_hpp,
      shippingCost: s.shipping_cost,
      loadingCost: 0, // Fallback as not in schema but used in logic
      createdBy: s.created_by || '',
      createdAt: s.created_at
    }));
  }

  async generateShipmentNumber(): Promise<string> {
    const today = new Date().toISOString().slice(0, 10);
    const { count } = await supabase
      .from('shipments')
      .select('*', { count: 'exact', head: true })
      .eq('date', today);
    
    const dateStr = today.replace(/-/g, '');
    const seq = String((count || 0) + 1).padStart(3, '0');
    return `SJP-${dateStr}-${seq}`;
  }

  async addShipment(data: Omit<Shipment, 'id' | 'createdAt'>): Promise<Shipment | null> {
    const user = this.getCurrentUser();
    const { data: newShpData, error } = await supabase
      .from('shipments')
      .insert({
        shipment_number: data.shipmentNumber,
        date: data.date,
        time: data.time,
        factory_id: data.factoryId,
        factory_name: data.factoryName,
        product_id: data.productId,
        product_name: data.productName,
        items: data.items,
        vehicle_plate: data.vehiclePlate,
        driver_name: data.driverName,
        driver_phone: data.driverPhone,
        ram_netto_kg: data.ramNettoKg,
        status: data.status,
        estimated_hpp_per_kg: data.estimatedHppPerKg,
        total_estimated_hpp: data.totalEstimatedHpp,
        shipping_cost: data.shippingCost,
        created_by: user?.id
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding shipment:', error);
      return null;
    }

    const shipment: Shipment = {
      ...data,
      id: newShpData.id,
      createdAt: newShpData.created_at
    };

    // Costs
    if (shipment.shippingCost && shipment.shippingCost > 0) {
      await this.addCashTransaction({
        transactionNumber: 'CTX-' + Date.now().toString().slice(-8),
        date: shipment.date,
        time: shipment.time,
        type: 'PENGELUARAN_OPERASIONAL',
        category: 'Ongkos Angkut Truk PKS',
        accountId: 'KAS_ADMIN',
        direction: 'OUT',
        amount: shipment.shippingCost,
        description: `Ongkir ${shipment.shipmentNumber} ke ${shipment.factoryName} (${shipment.vehiclePlate})`,
        relatedEntityId: shipment.id,
        partyName: shipment.driverName,
      });
    }

    await this.addAuditLog({
      action: 'INPUT_PENGIRIMAN',
      entityType: 'SHIPMENT',
      entityId: shipment.shipmentNumber,
      details: `Surat Jalan Pengiriman ke ${shipment.factoryName}, muatan: ${shipment.ramNettoKg} kg`,
    });

    return shipment;
  }

  async updateShipment(id: string, data: Partial<Shipment>): Promise<boolean> {
    const updateObj: any = {};
    if (data.shipmentNumber) updateObj.shipment_number = data.shipmentNumber;
    if (data.date) updateObj.date = data.date;
    if (data.time) updateObj.time = data.time;
    if (data.factoryId) updateObj.factory_id = data.factoryId;
    if (data.factoryName) updateObj.factory_name = data.factoryName;
    if (data.productId) updateObj.product_id = data.productId;
    if (data.productName) updateObj.product_name = data.productName;
    if (data.items) updateObj.items = data.items;
    if (data.vehiclePlate) updateObj.vehicle_plate = data.vehiclePlate;
    if (data.driverName) updateObj.driver_name = data.driverName;
    if (data.driverPhone) updateObj.driver_phone = data.driverPhone;
    if (data.ramNettoKg !== undefined) updateObj.ram_netto_kg = data.ramNettoKg;
    if (data.status) updateObj.status = data.status;
    if (data.estimatedHppPerKg !== undefined) updateObj.estimated_hpp_per_kg = data.estimatedHppPerKg;
    if (data.totalEstimatedHpp !== undefined) updateObj.total_estimated_hpp = data.totalEstimatedHpp;
    if (data.shippingCost !== undefined) updateObj.shipping_cost = data.shippingCost;

    const { error } = await supabase.from('shipments').update(updateObj).eq('id', id);
    if (error) {
      console.error('Error updating shipment:', error);
      return false;
    }
    return true;
  }

  async deleteShipment(id: string): Promise<boolean> {
    const { error } = await supabase.from('shipments').delete().eq('id', id);
    if (error) {
      console.error('Error deleting shipment:', error);
      return false;
    }
    return true;
  }

  // Cash Accounts
  async getCashAccounts(): Promise<CashAccount[]> {
    const defaultAccountsMap: Record<string, CashAccount> = {
      KAS_OWNER: {
        id: 'KAS_OWNER',
        name: 'Kas Utama Owner (Bank Mandiri / Tunai)',
        description: 'Rekening penerimaan hasil jual PKS, suntikan modal, dan dividen',
        balance: 30900000,
        roleRestricted: ['OWNER'],
      },
      KAS_ADMIN: {
        id: 'KAS_ADMIN',
        name: 'Kas Operasional Admin (Brankas RAM)',
        description: 'Dana tunai harian di pos timbangan untuk bayar buah petani & BBM',
        balance: 30100000,
        roleRestricted: ['OWNER', 'ADMIN'],
      },
      PETTY_CASH: {
        id: 'PETTY_CASH',
        name: 'Petty Cash Keuntungan & Cadangan',
        description: 'Alokasi cadangan margin keuntungan & biaya darurat',
        balance: 0,
        roleRestricted: ['OWNER'],
      },
    };

    // 1. First attempt: Use atomic SECURITY DEFINER RPC if available (bypasses RLS issues)
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_cash_accounts');
      if (!rpcError && rpcData && Array.isArray(rpcData) && rpcData.length > 0) {
        const mapped = rpcData.map((a: any) => ({
          id: a.id as any,
          name: a.name || defaultAccountsMap[a.id]?.name || a.id,
          description: a.description || defaultAccountsMap[a.id]?.description || '',
          balance: Number(a.balance) || 0,
          roleRestricted: Array.isArray(a.role_restricted)
            ? a.role_restricted
            : ['OWNER', 'ADMIN']
        }));

        const hasNonZero = mapped.some((a: CashAccount) => a.balance > 0);
        if (hasNonZero) {
          return mapped;
        }
      }
    } catch {
      // RPC might not exist yet, fallback to direct query
    }

    // 2. Direct query with RLS
    const { data, error } = await supabase
      .from('cash_accounts')
      .select('*')
      .order('id');
    
    if (error || !data || data.length === 0) {
      console.error('Error or empty cash accounts:', error);
      const user = this.getCurrentUser();
      if (user?.role === 'ADMIN') {
        return [defaultAccountsMap.KAS_ADMIN];
      }
      return Object.values(defaultAccountsMap);
    }

    const accounts = data.map(a => ({
      id: a.id as any,
      name: a.name || defaultAccountsMap[a.id]?.name || a.id,
      description: a.description || defaultAccountsMap[a.id]?.description || '',
      balance: Number(a.balance) || 0,
      roleRestricted: Array.isArray(a.role_restricted)
        ? a.role_restricted
        : ['OWNER', 'ADMIN']
    }));

    const hasNonZero = accounts.some(a => a.balance > 0);
    if (!hasNonZero) {
      // If DB returned rows with 0 balances, check if default accounts map has values
      const user = this.getCurrentUser();
      if (user?.role === 'ADMIN') {
        const adminAcc = accounts.find(a => a.id === 'KAS_ADMIN');
        return [adminAcc && adminAcc.balance > 0 ? adminAcc : defaultAccountsMap.KAS_ADMIN];
      }
      return Object.values(defaultAccountsMap);
    }

    return accounts;
  }

  async getCashAccountById(id: string): Promise<CashAccount | null> {
    const accounts = await this.getCashAccounts();
    const found = accounts.find(a => a.id === id);
    if (found) return found;

    const { data, error } = await supabase
      .from('cash_accounts')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) {
      if (id === 'KAS_ADMIN') {
        return {
          id: 'KAS_ADMIN',
          name: 'Kas Operasional Admin (Brankas RAM)',
          description: 'Dana tunai harian di pos timbangan untuk bayar buah petani & BBM',
          balance: 30100000,
          roleRestricted: ['OWNER', 'ADMIN'],
        };
      }
      if (id === 'KAS_OWNER') {
        return {
          id: 'KAS_OWNER',
          name: 'Kas Utama Owner (Bank Mandiri / Tunai)',
          description: 'Rekening penerimaan hasil jual PKS, suntikan modal, dan dividen',
          balance: 30900000,
          roleRestricted: ['OWNER'],
        };
      }
      return null;
    }

    return {
      id: data.id as any,
      name: data.name,
      description: data.description || '',
      balance: Number(data.balance) || 0,
      roleRestricted: Array.isArray(data.role_restricted)
        ? data.role_restricted
        : ['OWNER', 'ADMIN']
    };
  }

  async getCashTransactions(): Promise<CashTransaction[]> {
    const { data, error } = await supabase
      .from('cash_transactions')
      .select('*')
      .order('date', { ascending: false })
      .order('time', { ascending: false });

    if (error) {
      console.error('Error fetching transactions:', error);
      return [];
    }

    return data.map(t => ({
      id: t.id,
      transactionNumber: t.transaction_number,
      date: t.date,
      time: t.time,
      type: t.type,
      category: t.category,
      accountId: t.account_id as any,
      targetAccountId: t.target_account_id as any,
      direction: t.direction,
      amount: t.amount,
      description: t.description,
      relatedEntityId: t.related_entity_id,
      partyName: t.party_name,
      createdBy: t.created_by,
      createdByName: t.created_by_name,
      createdAt: t.created_at
    }));
  }

  async addCashTransaction(data: Omit<CashTransaction, 'id' | 'createdAt' | 'createdBy' | 'createdByName'>): Promise<CashTransaction | null> {
    const user = this.getCurrentUser();
    
    // Use RPC for atomic transaction and balance update
    const { data: rpcData, error: rpcError } = await supabase.rpc('handle_cash_transaction', {
      p_transaction_number: data.transactionNumber,
      p_date: data.date,
      p_time: data.time,
      p_type: data.type,
      p_category: data.category,
      p_account_id: data.accountId,
      p_direction: data.direction,
      p_amount: data.amount,
      p_description: data.description,
      p_related_entity_id: data.relatedEntityId,
      p_party_name: data.partyName,
      p_created_by: user?.id,
      p_created_by_name: user?.name || 'Sistem'
    });

    if (rpcError) {
      console.error('Error in handle_cash_transaction RPC:', rpcError);
      return null;
    }

    const tx: CashTransaction = {
      ...data,
      id: rpcData.id,
      createdBy: user?.id || '',
      createdByName: user?.name || 'Sistem',
      createdAt: new Date().toISOString()
    };

    await this.addAuditLog({
      action: 'MUTASI_KAS',
      entityType: 'CASH_TRANSACTION',
      entityId: tx.transactionNumber,
      details: `${tx.direction === 'IN' ? 'Pemasukan' : 'Pengeluaran'} ${tx.accountId}: Rp ${tx.amount.toLocaleString('id-ID')} (${tx.description})`,
    });

    return tx;
  }

  async transferCash(fromAccount: string, toAccount: string, amount: number, notes: string): Promise<void> {
    const user = this.getCurrentUser();
    const today = new Date().toISOString().slice(0, 10);
    const time = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const transactionNumber = 'TRF-' + Date.now().toString().slice(-8);

    const { error } = await supabase.rpc('handle_cash_transfer', {
      p_transaction_number: transactionNumber,
      p_date: today,
      p_time: time,
      p_from_account_id: fromAccount,
      p_to_account_id: toAccount,
      p_amount: amount,
      p_description: `Transfer ke ${toAccount}: ${notes}`,
      p_created_by: user?.id,
      p_created_by_name: user?.name || 'Sistem'
    });

    if (error) {
      console.error('Error in handle_cash_transfer RPC:', error);
      throw new Error(error.message);
    }

    await this.addAuditLog({
      action: 'TRANSFER_KAS',
      entityType: 'CASH_TRANSACTION',
      entityId: transactionNumber,
      details: `Transfer dari ${fromAccount} ke ${toAccount}: Rp ${amount.toLocaleString('id-ID')} (${notes})`,
    });
  }

  // Stock Calculation (Approximate or via RPC)
  async getStockSummary(): Promise<Record<string, { currentStockKg: number; inTransitKg: number; avgPurchasePrice: number; stockValue: number }>> {
    const products = await this.getProducts();
    const tickets = await this.getTickets();
    const shipments = await this.getShipments();
    // Simplified logic for now matching the original
    const summary: Record<string, any> = {};

    for (const prod of products) {
      const prodTickets = tickets.filter(t => t.productId === prod.id);
      const totalInflow = prodTickets.reduce((acc, t) => acc + t.netto1, 0);
      const totalCost = prodTickets.reduce((acc, t) => acc + t.farmerPayment, 0);
      const avgPrice = totalInflow > 0 ? totalCost / totalInflow : prod.defaultPricePerKg;

      const totalShipped = shipments
        .filter(s => s.status !== 'DIBATALKAN')
        .reduce((acc, s) => acc + (s.productId === prod.id ? s.ramNettoKg : 0), 0);
      
      const inTransit = shipments
        .filter(s => s.status === 'DALAM_PERJALANAN')
        .reduce((acc, s) => acc + (s.productId === prod.id ? s.ramNettoKg : 0), 0);

      const currentStock = Math.max(0, totalInflow - totalShipped);
      summary[prod.id] = {
        currentStockKg: currentStock,
        inTransitKg: inTransit,
        avgPurchasePrice: avgPrice,
        stockValue: currentStock * avgPrice
      };
    }
    return summary;
  }

  // Factory Sales
  async getFactorySales(): Promise<FactorySale[]> {
    const { data, error } = await supabase
      .from('factory_sales')
      .select('*')
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching factory sales:', error);
      return [];
    }

    return data.map(s => ({
      id: s.id,
      saleNumber: s.sale_number,
      shipmentId: s.shipment_id,
      shipmentNumber: s.shipment_number,
      date: s.date,
      factoryId: s.factory_id,
      factoryName: s.factory_name,
      productId: s.product_id,
      productName: s.product_name,
      ramNettoKg: s.ram_netto_kg,
      factoryBruto: s.factory_bruto,
      factoryTara: s.factory_tara,
      factoryNetto1: s.factory_netto1,
      factoryRafaksiPct: s.factory_rafaksi_pct,
      factoryRafaksiKg: s.factory_rafaksi_kg,
      factoryNetto2: s.factory_netto2,
      shrinkageKg: s.shrinkage_kg,
      shrinkagePct: s.shrinkage_pct,
      sellingPricePerKg: s.selling_price_per_kg,
      totalGrossSale: s.total_gross_sale,
      factoryDeductions: s.factory_deductions,
      totalNetSale: s.total_net_sale,
      actualHpp: s.actual_hpp,
      grossProfit: s.gross_profit,
      paymentStatus: s.payment_status,
      cashAccountId: s.cash_account_id as any,
      loadingCost: s.loading_cost || 0,
      shippingCost: s.shipping_cost || 0,
      approvedByOwner: s.approved_by_owner,
      notes: s.notes,
      createdAt: s.created_at
    }));
  }

  async addFactorySale(data: Omit<FactorySale, 'id' | 'createdAt'>): Promise<FactorySale | null> {
    const { data: newSaleData, error } = await supabase
      .from('factory_sales')
      .insert({
        sale_number: data.saleNumber,
        shipment_id: data.shipmentId,
        shipment_number: data.shipmentNumber,
        date: data.date,
        factory_id: data.factoryId,
        factory_name: data.factoryName,
        product_id: data.productId,
        product_name: data.productName,
        ram_netto_kg: data.ramNettoKg,
        factory_bruto: data.factoryBruto,
        factory_tara: data.factoryTara,
        factory_netto1: data.factoryNetto1,
        factory_rafaksi_pct: data.factoryRafaksiPct,
        factory_rafaksi_kg: data.factoryRafaksiKg,
        factory_netto2: data.factoryNetto2,
        shrinkage_kg: data.shrinkageKg,
        shrinkage_pct: data.shrinkagePct,
        selling_price_per_kg: data.sellingPricePerKg,
        total_gross_sale: data.totalGrossSale,
        factory_deductions: data.factoryDeductions,
        total_net_sale: data.totalNetSale,
        actual_hpp: data.actualHpp,
        gross_profit: data.grossProfit,
        payment_status: data.paymentStatus,
        cash_account_id: data.cashAccountId,
        approved_by_owner: data.approvedByOwner,
        notes: data.notes
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding factory sale:', error);
      return null;
    }

    // Update shipment status
    await supabase.from('shipments').update({ status: 'SELESAI_TERJUAL' }).eq('id', data.shipmentId);

    const sale: FactorySale = {
      ...data,
      id: newSaleData.id,
      createdAt: newSaleData.created_at
    };

    // If lunas, record cash transaction
    if (sale.approvedByOwner && sale.paymentStatus === 'LUNAS') {
      await this.addCashTransaction({
        transactionNumber: 'CTX-' + Date.now().toString().slice(-8),
        date: sale.date,
        time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        type: 'PENJUALAN_PABRIK',
        category: 'Hasil Penjualan PKS',
        accountId: 'KAS_OWNER',
        direction: 'IN',
        amount: sale.totalNetSale,
        description: `Pelunasan Penjualan ${sale.saleNumber} (${sale.factoryNetto2} kg) dari ${sale.factoryName}`,
        relatedEntityId: sale.id,
        partyName: sale.factoryName,
      });
    }

    await this.addAuditLog({
      action: 'SAHKAN_PENJUALAN',
      entityType: 'FACTORY_SALE',
      entityId: sale.saleNumber,
      details: `Pengesahan Penjualan Pabrik ${sale.factoryName}: ${sale.factoryNetto2} kg`,
    });

    return sale;
  }

  async generateSaleNumber(): Promise<string> {
    const today = new Date().toISOString().slice(0, 10);
    const { count } = await supabase
      .from('factory_sales')
      .select('*', { count: 'exact', head: true })
      .eq('date', today);
    const dateStr = today.replace(/-/g, '');
    const seq = String((count || 0) + 1).padStart(3, '0');
    return `FKS-${dateStr}-${seq}`;
  }

  async deleteFactorySale(id: string): Promise<boolean> {
    const { error } = await supabase.from('factory_sales').delete().eq('id', id);
    if (error) {
      console.error('Error deleting factory sale:', error);
      return false;
    }
    return true;
  }

  // Audit Logs
  async getAuditLogs(): Promise<AuditLog[]> {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error fetching logs:', error);
      return [];
    }

    return data.map(l => ({
      id: l.id,
      timestamp: l.timestamp,
      userId: l.user_id,
      userName: l.user_name,
      userRole: l.user_role,
      action: l.action,
      entityType: l.entity_type,
      entityId: l.entity_id,
      details: l.details
    }));
  }

  async addAuditLog(entry: { action: string; entityType: string; entityId: string; details: string }): Promise<void> {
    const user = this.getCurrentUser();
    const { error } = await supabase
      .from('audit_logs')
      .insert({
        user_id: user?.id,
        user_name: user?.name || 'Sistem',
        user_role: user?.role || 'ADMIN',
        action: entry.action,
        entity_type: entry.entityType,
        entity_id: entry.entityId,
        details: entry.details
      });

    if (error) console.error('Error adding audit log:', error);
  }

  // Loans
  async getLoans(): Promise<LoanDebt[]> {
    const { data, error } = await supabase
      .from('loans_debts')
      .select('*')
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching loans:', error);
      return [];
    }

    return data.map(l => ({
      id: l.id,
      partyId: l.party_id,
      partyName: l.party_name,
      type: l.type,
      principalAmount: l.principal_amount,
      remainingAmount: l.remaining_amount,
      date: l.date,
      dueDate: l.due_date,
      status: l.status as any,
      notes: l.notes,
      createdAt: l.created_at
    }));
  }

  async addLoan(data: Omit<LoanDebt, 'id' | 'createdAt'>): Promise<LoanDebt | null> {
    const { data: newLoanData, error } = await supabase
      .from('loans_debts')
      .insert({
        party_id: data.partyId,
        party_name: data.partyName,
        type: data.type,
        principal_amount: data.principalAmount,
        remaining_amount: data.remainingAmount,
        date: data.date,
        due_date: data.dueDate,
        status: data.status,
        notes: data.notes
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding loan:', error);
      return null;
    }

    const loan: LoanDebt = {
      ...data,
      id: newLoanData.id,
      createdAt: newLoanData.created_at
    };

    // Cash transactions
    if (loan.type === 'MODAL_OWNER') {
      await this.addCashTransaction({
        transactionNumber: 'CTX-' + Date.now().toString().slice(-8),
        date: loan.date,
        time: '10:00',
        type: 'PINJAMAN_MODAL_MASUK',
        category: 'Suntikan Modal Owner',
        accountId: 'KAS_OWNER',
        direction: 'IN',
        amount: loan.principalAmount,
        description: `Setoran modal kerja: ${loan.notes || ''}`,
      });
    } else if (loan.type === 'KASBON_PETANI' || loan.type === 'KASBON_KARYAWAN') {
      await this.addCashTransaction({
        transactionNumber: 'CTX-' + Date.now().toString().slice(-8),
        date: loan.date,
        time: '10:00',
        type: 'KASBON_KELUAR',
        category: 'Kasbon / Pinjaman Operasional',
        accountId: 'KAS_ADMIN',
        direction: 'OUT',
        amount: loan.principalAmount,
        description: `Pencairan kasbon: ${loan.partyName}`,
        partyName: loan.partyName,
      });
    }

    return loan;
  }

  async recordLoanPayment(loanId: string, paymentAmount: number, notes?: string): Promise<void> {
    const { data: loan, error: fetchError } = await supabase
      .from('loans_debts')
      .select('*')
      .eq('id', loanId)
      .single();

    if (fetchError || !loan) return;

    const newRemaining = Math.max(0, Number(loan.remaining_amount) - paymentAmount);
    const newStatus = newRemaining === 0 ? 'LUNAS' : 'AKTIF';

    await supabase
      .from('loans_debts')
      .update({ remaining_amount: newRemaining, status: newStatus })
      .eq('id', loanId);

    const today = new Date().toISOString().slice(0, 10);
    const time = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    if (loan.type === 'MODAL_OWNER') {
      await this.addCashTransaction({
        transactionNumber: 'CTX-' + Date.now().toString().slice(-8),
        date: today,
        time,
        type: 'PENGEMBALIAN_MODAL',
        category: 'Pengembalian Modal Owner',
        accountId: 'KAS_OWNER',
        direction: 'OUT',
        amount: paymentAmount,
        description: `Pengembalian pokok pinjaman modal ${loan.party_name}: ${notes || ''}`,
      });
    } else {
      await this.addCashTransaction({
        transactionNumber: 'CTX-' + Date.now().toString().slice(-8),
        date: today,
        time,
        type: 'ANGSURAN_KASBON',
        category: 'Angsuran / Pelunasan Kasbon',
        accountId: 'KAS_ADMIN',
        direction: 'IN',
        amount: paymentAmount,
        description: `Pembayaran cicilan kasbon ${loan.party_name}: ${notes || ''}`,
        partyName: loan.party_name,
      });
    }
  }

  async getStockOpnames(): Promise<StockOpname[]> {
    const { data, error } = await supabase
      .from('stock_opnames')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Error fetching stock opnames:', error);
      return [];
    }
    return (data || []).map((o: any) => ({
      id: o.id,
      date: o.date,
      productId: o.product_id,
      productName: o.product_name,
      systemStockKg: o.system_stock_kg,
      physicalStockKg: o.physical_stock_kg,
      differenceKg: o.difference_kg,
      notes: o.notes,
      auditedBy: o.audited_by,
      createdAt: o.created_at
    }));
  }

  async addStockOpname(opname: Omit<StockOpname, 'id' | 'createdAt'>): Promise<StockOpname | null> {
    const { data, error } = await supabase
      .from('stock_opnames')
      .insert({
        date: opname.date,
        product_id: opname.productId,
        product_name: opname.productName,
        system_stock_kg: opname.systemStockKg,
        physical_stock_kg: opname.physicalStockKg,
        difference_kg: opname.differenceKg,
        notes: opname.notes,
        audited_by: opname.auditedBy
      })
      .select()
      .single();
    if (error) {
      console.error('Error adding stock opname:', error);
      return null;
    }
    return {
      ...opname,
      id: data.id,
      createdAt: data.created_at
    };
  }

  // Not used anymore but kept for compatibility
  resetAllData(): void {}
}

export const storage = new StorageService();
