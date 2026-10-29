import React, { useState, useEffect } from 'react';
import {
  Building2,
  Lock,
  Plus,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Scale,
  ShieldCheck,
  FileCheck,
  DollarSign,
  ArrowRight,
  Trash2,
} from 'lucide-react';
import { FactorySale, Shipment, UserProfile } from '../types';
import { storage } from '../lib/storage';

interface FactorySalesSectionProps {
  currentUser: UserProfile;
}

export const FactorySalesSection: React.FC<FactorySalesSectionProps> = ({ currentUser }) => {
  const isOwner = currentUser.role === 'OWNER';

  const [sales, setSales] = useState<FactorySale[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Form Fields
  const [selectedShipmentId, setSelectedShipmentId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  // Factory Scales
  const [factoryBruto, setFactoryBruto] = useState<number | ''>('');
  const [factoryTara, setFactoryTara] = useState<number | ''>('');
  const [factoryRafaksiPct, setFactoryRafaksiPct] = useState<number>(2.0);
  const [sellingPricePerKg, setSellingPricePerKg] = useState<number>(2850);
  const [factoryDeductions, setFactoryDeductions] = useState<number>(0);
  const [manualHpp, setManualHpp] = useState<number | ''>('');
  const [manualLoadingCost, setManualLoadingCost] = useState<number | ''>('');
  const [manualShippingCost, setManualShippingCost] = useState<number | ''>('');
  const [notes, setNotes] = useState('');

  const refreshData = async () => {
    try {
      const [sl, sh] = await Promise.all([
        storage.getFactorySales(),
        storage.getShipments()
      ]);
      setSales(sl);
      setShipments(sh);
    } catch (err) {
      console.error('Error refreshing sales data:', err);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  // Update manual costs when shipment selection changes
  useEffect(() => {
    if (selectedShipment) {
      setManualHpp(selectedShipment.totalEstimatedHpp);
      setManualLoadingCost(selectedShipment.loadingCost || 0);
      setManualShippingCost(selectedShipment.shippingCost || 0);
    } else {
      setManualHpp('');
      setManualLoadingCost('');
      setManualShippingCost('');
    }
  }, [selectedShipmentId, shipments]);

  // Strict Access Control Guard for Admin
  if (!isOwner) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-12 text-center max-w-2xl mx-auto my-8 shadow-sm">
        <div className="w-16 h-16 rounded-3xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4 border border-rose-100">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-slate-900 tracking-tight">
          Akses Terbatas: Khusus Owner
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-2 leading-relaxed">
          Sesuai SOP RAM Sumber Rezeki, modul <b>Penjualan Pabrik (PKS)</b>, pengesahan
          timbangan pabrik, harga jual, dan margin HPP hanya dapat diakses serta
          disahkan oleh Owner.
        </p>
        <div className="mt-6 p-4 bg-slate-50 rounded-2xl border border-slate-200/80 text-left text-xs space-y-1.5">
          <div className="font-bold text-slate-800">Tugas Anda sebagai Admin:</div>
          <p className="text-slate-600">
            • Buat tiket timbang petani di pos timbangan.
          </p>
          <p className="text-slate-600">
            • Buat surat jalan pengiriman truk di menu "Pengiriman Pabrik".
          </p>
          <p className="text-slate-600">
            • Kelola kas operasional harian di menu "Kas & Pengeluaran".
          </p>
        </div>
      </div>
    );
  }

  // Eligible shipments (those still DALAM_PERJALANAN)
  const pendingShipments = shipments.filter((s) => s.status === 'DALAM_PERJALANAN');
  const selectedShipment = shipments.find((s) => s.id === selectedShipmentId);

  // Live Calculations
  const ramNettoKg = selectedShipment ? selectedShipment.ramNettoKg : 0;
  const numBruto = Number(factoryBruto) || 0;
  const numTara = Number(factoryTara) || 0;
  const factoryNetto1 = Math.max(0, numBruto - numTara);
  const factoryRafaksiKg = Math.round(factoryNetto1 * (factoryRafaksiPct / 100));
  const factoryNetto2 = Math.max(0, factoryNetto1 - factoryRafaksiKg);

  // Shrinkage (Susut Timbang)
  const shrinkageKg = Math.max(0, ramNettoKg - factoryNetto1);
  const shrinkagePct = ramNettoKg > 0 ? (shrinkageKg / ramNettoKg) * 100 : 0;

  // Revenue & Profit
  const totalGrossSale = factoryNetto2 * sellingPricePerKg;
  const totalNetSale = Math.max(0, totalGrossSale - factoryDeductions);
  const actualHpp = Number(manualHpp) || 0;
  const loadingCost = Number(manualLoadingCost) || 0;
  const shippingCost = Number(manualShippingCost) || 0;
  const grossProfit = totalNetSale - (actualHpp + loadingCost + shippingCost);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedShipment) {
      alert('Pilih surat jalan pengiriman yang akan disahkan penjualannya!');
      return;
    }

    if (numBruto <= 0 || numTara < 0 || numBruto <= numTara) {
      alert('Nilai timbangan Bruto PKS harus lebih besar daripada Tara PKS!');
      return;
    }

    const saleNumber = await storage.generateSaleNumber();

    await storage.addFactorySale({
      saleNumber,
      shipmentId: selectedShipment.id,
      shipmentNumber: selectedShipment.shipmentNumber,
      date,
      factoryId: selectedShipment.factoryId,
      factoryName: selectedShipment.factoryName,
      productId: selectedShipment.productId,
      productName: selectedShipment.productName,
      items: selectedShipment.items,
      ramNettoKg,
      factoryBruto: numBruto,
      factoryTara: numTara,
      factoryNetto1,
      factoryRafaksiPct,
      factoryRafaksiKg,
      factoryNetto2,
      shrinkageKg,
      shrinkagePct: Number(shrinkagePct.toFixed(2)),
      sellingPricePerKg,
      totalGrossSale,
      factoryDeductions,
      totalNetSale,
      actualHpp,
      loadingCost,
      shippingCost,
      grossProfit,
      paymentStatus: 'LUNAS',
      cashAccountId: 'KAS_OWNER',
      approvedByOwner: true,
      approvedAt: new Date().toISOString(),
      approvedByName: currentUser.name,
      notes,
    });

    await refreshData();
    setIsFormOpen(false);
    setSelectedShipmentId('');
    setFactoryBruto('');
    setFactoryTara('');
    setManualHpp('');
    setManualLoadingCost('');
    setManualShippingCost('');
    alert(`Penjualan ${saleNumber} berhasil disahkan! Dana Rp ${totalNetSale.toLocaleString('id-ID')} masuk ke Kas Owner.`);
  };

  const handleDelete = async (id: string, number: string) => {
    if (window.confirm(`Hapus data penjualan pabrik ${number}? Saldo kas owner dan status pengiriman akan dikoreksi otomatis.`)) {
      await storage.deleteFactorySale(id);
      await refreshData();
    }
  };

  const formatRupiah = (val: number) => {
    return 'Rp ' + Math.round(val).toLocaleString('id-ID');
  };

  return (
    <div className="space-y-3.5">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700">
              OWNER ONLY
            </span>
            <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-600" />
              Penjualan Pabrik & Pengesahan Timbang PKS
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Mengesahkan timbang pabrik, membandingkan susut muatan, mengakui HPP dan laba kotor
          </p>
        </div>

        <button
          onClick={() => setIsFormOpen(!isFormOpen)}
          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all"
        >
          <Plus className="w-4 h-4" />
          {isFormOpen ? 'Tutup Form' : 'Sahkan Penjualan Pengiriman'}
        </button>
      </div>

      {/* Form Reconciliation */}
      {isFormOpen && (
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-3xl border border-indigo-200/90 shadow-xl p-4 sm:p-5 space-y-4 animate-in fade-in slide-in-from-top-4 duration-200"
        >
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-600" />
              <h3 className="font-bold text-slate-900 text-base">
                Formulir Pengesahan Penjualan PKS
              </h3>
            </div>
            <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-100">
              Auto No: FKS-YYYYMMDD-XXX
            </span>
          </div>

          {/* Shipment Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Pilih Surat Jalan Pengiriman (Truk Masuk PKS)
              </label>
              <select
                value={selectedShipmentId}
                onChange={(e) => setSelectedShipmentId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900"
                required
              >
                <option value="">-- Pilih Surat Jalan Truk --</option>
                {pendingShipments.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.shipmentNumber} • {s.factoryName} • {s.ramNettoKg.toLocaleString('id-ID')} kg ({s.vehiclePlate})
                  </option>
                ))}
              </select>
              {pendingShipments.length === 0 && (
                <p className="text-[11px] text-amber-600 mt-1">
                  Semua pengiriman sudah disahkan atau belum ada truk baru yang dikirim.
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Tanggal Pengesahan Penjualan
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                required
              />
            </div>
          </div>

          {/* Selected Shipment Summary Banner */}
          {selectedShipment && (
            <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200 flex flex-wrap items-center justify-between gap-4 text-xs">
              <div>
                <span className="text-slate-500">Truk & Sopir:</span>
                <p className="font-bold text-slate-900">
                  {selectedShipment.vehiclePlate} • {selectedShipment.driverName}
                </p>
              </div>
              <div>
                <span className="text-slate-500">Pabrik PKS:</span>
                <p className="font-bold text-indigo-900">{selectedShipment.factoryName}</p>
              </div>
              <div>
                <span className="text-slate-500">Netto Timbang RAM:</span>
                <p className="font-black text-slate-900 font-mono text-sm">
                  {ramNettoKg.toLocaleString('id-ID')} kg
                </p>
              </div>
              <div>
                <span className="text-slate-500">Estimasi HPP (System):</span>
                <p className="font-bold text-slate-900 font-mono">
                  {formatRupiah(selectedShipment.totalEstimatedHpp)}
                </p>
              </div>

              {selectedShipment.items && selectedShipment.items.length > 0 && (
                <div className="w-full mt-2 pt-2 border-t border-indigo-200/60 flex flex-wrap items-center gap-2">
                  <span className="text-slate-600 font-semibold text-[11px]">Komposisi Buah:</span>
                  {selectedShipment.items.map((it, idx) => (
                    <span
                      key={idx}
                      className="bg-white px-2 py-0.5 rounded-md text-[10px] font-bold text-indigo-900 border border-indigo-200"
                    >
                      {it.productName}: <span className="font-mono">{it.nettoKg.toLocaleString('id-ID')} kg</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Factory Weighbridge Input */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Bruto Timbangan PKS (kg)
              </label>
              <input
                type="number"
                placeholder="0"
                value={factoryBruto}
                onChange={(e) =>
                  setFactoryBruto(e.target.value === '' ? '' : Number(e.target.value))
                }
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl font-mono font-bold"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Tara Timbangan PKS (kg)
              </label>
              <input
                type="number"
                placeholder="0"
                value={factoryTara}
                onChange={(e) =>
                  setFactoryTara(e.target.value === '' ? '' : Number(e.target.value))
                }
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl font-mono font-bold"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Potongan Rafaksi PKS (%)
              </label>
              <input
                type="number"
                step="0.1"
                value={factoryRafaksiPct}
                onChange={(e) => setFactoryRafaksiPct(Number(e.target.value) || 0)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl font-mono font-bold text-rose-600"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Harga Jual ke PKS (Rp/kg)
              </label>
              <input
                type="number"
                value={sellingPricePerKg}
                onChange={(e) => setSellingPricePerKg(Number(e.target.value) || 0)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl font-mono font-bold text-emerald-800"
                required
              />
            </div>
          </div>

          {/* Revision 10: Manual Costs for Profit Calculation */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-2xl bg-indigo-50/30 border border-indigo-100">
            <div>
              <label className="block text-[11px] font-bold text-indigo-900 mb-1">
                HPP Buah (Manual Override)
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={manualHpp}
                  onChange={(e) => setManualHpp(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-indigo-200 rounded-xl font-mono font-bold text-slate-900"
                  required
                />
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">Rp</span>
              </div>
              <p className="text-[10px] text-indigo-600/70 mt-1">
                Ubah manual jika ada koreksi harga beli rata-rata
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-indigo-900 mb-1">
                Upah Muat (Manual)
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={manualLoadingCost}
                  onChange={(e) => setManualLoadingCost(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-indigo-200 rounded-xl font-mono font-bold text-slate-900"
                  required
                />
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">Rp</span>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-indigo-900 mb-1">
                Ongkos Truk (Manual)
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={manualShippingCost}
                  onChange={(e) => setManualShippingCost(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-indigo-200 rounded-xl font-mono font-bold text-slate-900"
                  required
                />
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">Rp</span>
              </div>
            </div>
          </div>

          {/* Comparison & Shrinkage Analytics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase">
                Netto 2 Sah Pabrik (kg)
              </span>
              <div className="text-xl font-black font-mono text-indigo-950 mt-1">
                {factoryNetto2.toLocaleString('id-ID')} kg
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Netto 1 ({factoryNetto1.toLocaleString('id-ID')}) - Rafaksi ({factoryRafaksiKg} kg)
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase">
                Susut Timbang (RAM vs PKS)
              </span>
              <div className="text-xl font-black font-mono text-rose-600 mt-1">
                {shrinkageKg.toLocaleString('id-ID')} kg ({shrinkagePct.toFixed(2)}%)
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Batas aman susut normal &lt; 0.6%
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200">
              <span className="text-[11px] font-bold text-emerald-800 uppercase">
                Laba Kotor Transaksi
              </span>
              <div className="text-xl font-black font-mono text-emerald-900 mt-1">
                {formatRupiah(grossProfit)}
              </div>
              <p className="text-[11px] text-emerald-700 mt-1">
                Net Sales ({formatRupiah(totalNetSale)}) - (HPP: {formatRupiah(actualHpp)} + Biaya: {formatRupiah(loadingCost + shippingCost)})
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/20 flex items-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              Sahkan Penjualan & Masukkan ke Kas Owner
            </button>
          </div>
        </form>
      )}

      {/* Verified Sales Table */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm">
            Riwayat Penjualan Pabrik yang Telah Disahkan Owner
          </h3>
          <span className="text-xs font-semibold text-slate-500">
            Total {sales.length} Penjualan Sah
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[10px] leading-tight border-collapse">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-100 font-bold uppercase tracking-tighter">
              <tr>
                <th className="py-2 px-3 whitespace-nowrap">Penjualan / SJ</th>
                <th className="py-2 px-3">PKS Pembeli</th>
                <th className="py-2 px-3 text-right">RAM / PKS (kg)</th>
                <th className="py-2 px-3 text-right">Susut</th>
                <th className="py-2 px-3 text-right">Harga</th>
                <th className="py-2 px-3 text-right">Total Net</th>
                <th className="py-2 px-3 text-right">Laba Kotor</th>
                <th className="py-2 px-3 text-center">Status</th>
                <th className="py-2 px-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sales.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-1.5 px-3 whitespace-nowrap">
                    <div className="flex flex-col leading-none">
                      <span className="font-mono font-bold text-slate-900">{s.saleNumber}</span>
                      <span className="text-[9px] text-slate-400 font-mono mt-0.5">{s.shipmentNumber}</span>
                    </div>
                  </td>
                  <td className="py-1.5 px-3 font-bold text-slate-800">
                    {s.factoryName}
                  </td>
                  <td className="py-1.5 px-3 text-right leading-tight whitespace-nowrap">
                    <div className="flex flex-col leading-none">
                      <span className="font-mono text-slate-500 text-[9px]">{s.ramNettoKg.toLocaleString('id-ID')}</span>
                      <span className="font-mono font-black text-indigo-950 mt-0.5">{s.factoryNetto2.toLocaleString('id-ID')}</span>
                    </div>
                  </td>
                  <td className="py-1.5 px-3 text-right font-mono text-rose-600 font-bold whitespace-nowrap">
                    {s.shrinkageKg} <span className="text-[8px] opacity-60">({s.shrinkagePct}%)</span>
                  </td>
                  <td className="py-1.5 px-3 text-right font-mono font-semibold text-slate-800 whitespace-nowrap">
                    {s.sellingPricePerKg.toLocaleString('id-ID')}
                  </td>
                  <td className="py-1.5 px-3 text-right font-mono font-black text-emerald-700 whitespace-nowrap">
                    {s.totalNetSale.toLocaleString('id-ID')}
                  </td>
                  <td className="py-1.5 px-3 text-right font-mono font-black text-indigo-700 whitespace-nowrap">
                    +{s.grossProfit.toLocaleString('id-ID')}
                  </td>
                  <td className="py-1.5 px-3 text-center">
                    <span className="text-[9px] font-black px-1.5 py-0 rounded uppercase bg-emerald-100 text-emerald-800">
                      SAH
                    </span>
                  </td>
                  <td className="py-1.5 px-3 text-center">
                    <button
                      onClick={() => handleDelete(s.id, s.saleNumber)}
                      className="p-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 transition-colors border border-rose-200"
                      title="Hapus Penjualan"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
