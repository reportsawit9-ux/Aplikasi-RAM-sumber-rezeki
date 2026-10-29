import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Search,
  Building,
  Truck,
  Layers,
  Settings,
  CheckCircle,
  Tag,
  DollarSign,
} from 'lucide-react';
import { Party, ProductType, AppSettings, UserProfile } from '../types';
import { storage } from '../lib/storage';

interface MasterDataSectionProps {
  currentUser: UserProfile;
}

export const MasterDataSection: React.FC<MasterDataSectionProps> = ({ currentUser }) => {
  const isOwner = currentUser.role === 'OWNER';

  const [parties, setParties] = useState<Party[]>([]);
  const [products, setProducts] = useState<ProductType[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    ramName: 'RAM SUMBER REZEKI',
    address: 'Jl. Lintas Sawit Sejahtera No. 45, Riau',
    phone: '0812-7788-9900',
    defaultRafaksiPct: 3.0,
    defaultUnloadingFeePerKg: 15,
    ownerPin: '123456'
  });
  const [activeTab, setActiveTab] = useState<'petani' | 'pabrik' | 'sopir' | 'produk' | 'pengaturan'>('petani');
  const [isPartyModalOpen, setIsPartyModalOpen] = useState(false);
  const [partyType, setPartyType] = useState<'PETANI' | 'PABRIK' | 'SOPIR' | 'AFFILIATE'>('PETANI');
  const [partyName, setPartyName] = useState('');
  const [partyPhone, setPartyPhone] = useState('');
  const [partyAddress, setPartyAddress] = useState('');
  const [partyPlate, setPartyPlate] = useState('');
  const [partyNotes, setPartyNotes] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isResetting, setIsResetting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const refreshData = async () => {
    setIsLoading(true);
    try {
      const [p, prods, s] = await Promise.all([
        storage.getParties(),
        storage.getProducts(),
        storage.getSettings()
      ]);
      setParties(p);
      setProducts(prods);
      if (s) setSettings(s);
    } catch (err) {
      console.error('Error refreshing master data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  const handleResetData = async () => {
    if (confirm('APAKAH ANDA YAKIN? Semua data penimbangan, pengiriman, transaksi kas, dan kontak akan DIHAPUS PERMANEN. Tindakan ini tidak dapat dibatalkan.')) {
      setIsResetting(true);
      try {
        await storage.resetAllData();
        alert('Seluruh data transaksi dan saldo kas berhasil dibersihkan!');
        window.location.reload();
      } catch (err) {
        alert('Gagal meriset data. Silakan coba lagi.');
      } finally {
        setIsResetting(false);
      }
    }
  };

  const handleSaveParty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partyName) {
      alert('Nama tidak boleh kosong!');
      return;
    }

    setIsSaving(true);
    await storage.addParty({
      type: partyType,
      name: partyName,
      phone: partyPhone || '-',
      address: partyAddress,
      vehiclePlate: partyPlate.toUpperCase(),
      notes: partyNotes,
    });

    await refreshData();
    setIsSaving(false);
    setIsPartyModalOpen(false);
    setPartyName('');
    setPartyPhone('');
    setPartyAddress('');
    setPartyPlate('');
    setPartyNotes('');
    alert(`Data ${partyType} berhasil ditambahkan!`);
  };

  const handleUpdateProductPrice = async (prod: ProductType, newPrice: number, newRafaksi: number) => {
    await storage.saveProduct({
      ...prod,
      defaultPricePerKg: newPrice,
      defaultRafaksiPct: newRafaksi,
    });
    await refreshData();
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setIsSaving(true);
    await storage.saveSettings(settings);
    setIsSaving(false);
    alert('Pengaturan RAM Sumber Rezeki berhasil disimpan!');
  };

  const filteredParties = parties.filter((p) => {
    if (activeTab === 'petani') return p.type === 'PETANI' || p.type === 'AFFILIATE';
    if (activeTab === 'pabrik') return p.type === 'PABRIK';
    if (activeTab === 'sopir') return p.type === 'SOPIR';
    return true;
  });

  return (
    <div className="space-y-3.5">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            Master Data & Pengaturan Bisnis RAM
          </h2>
          <p className="text-xs text-slate-500">
            Kelola kontak petani sawit, pabrik PKS, armada sopir, standar harga produk & profil RAM
          </p>
        </div>

        {activeTab !== 'produk' && activeTab !== 'pengaturan' && (
          <button
            onClick={() => {
              if (activeTab === 'petani') setPartyType('PETANI');
              if (activeTab === 'pabrik') setPartyType('PABRIK');
              if (activeTab === 'sopir') setPartyType('SOPIR');
              setIsPartyModalOpen(true);
            }}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all"
          >
            <Plus className="w-4 h-4" />
            + Tambah Data Baru
          </button>
        )}
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-slate-200 space-x-6 text-xs font-bold">
        <button
          onClick={() => setActiveTab('petani')}
          className={`pb-3 transition-colors ${
            activeTab === 'petani'
              ? 'border-b-2 border-indigo-600 text-indigo-600'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Petani & Affiliate ({parties.filter((p) => p.type === 'PETANI' || p.type === 'AFFILIATE').length})
        </button>
        <button
          onClick={() => setActiveTab('pabrik')}
          className={`pb-3 transition-colors ${
            activeTab === 'pabrik'
              ? 'border-b-2 border-indigo-600 text-indigo-600'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Pabrik PKS ({parties.filter((p) => p.type === 'PABRIK').length})
        </button>
        <button
          onClick={() => setActiveTab('sopir')}
          className={`pb-3 transition-colors ${
            activeTab === 'sopir'
              ? 'border-b-2 border-indigo-600 text-indigo-600'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Sopir & Armada ({parties.filter((p) => p.type === 'SOPIR').length})
        </button>
        <button
          onClick={() => setActiveTab('produk')}
          className={`pb-3 transition-colors ${
            activeTab === 'produk'
              ? 'border-b-2 border-indigo-600 text-indigo-600'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Komoditas & Standar Harga ({products.length})
        </button>
        {isOwner && (
          <button
            onClick={() => setActiveTab('pengaturan')}
            className={`pb-3 transition-colors ${
              activeTab === 'pengaturan'
                ? 'border-b-2 border-indigo-600 text-indigo-600'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Pengaturan Profil RAM
          </button>
        )}
      </div>

      {/* Content based on Tab */}
      {(activeTab === 'petani' || activeTab === 'pabrik' || activeTab === 'sopir') && (
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-100 font-semibold uppercase text-[10px]">
                <tr>
                  <th className="py-1.5 px-3">Nama / Tipe</th>
                  <th className="py-1.5 px-3">Kontak / WA</th>
                  <th className="py-1.5 px-3">Alamat / Wilayah</th>
                  <th className="py-1.5 px-3">Armada</th>
                  <th className="py-1.5 px-3">Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredParties.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors border-b border-slate-100 last:border-0">
                    <td className="py-1.5 px-3">
                      <div className="font-bold text-slate-900 leading-tight">{p.name}</div>
                      <div className="text-[9px] font-black text-indigo-700 uppercase">{p.type}</div>
                    </td>
                    <td className="py-1.5 px-3 text-slate-600 font-mono">
                      {p.phone}
                    </td>
                    <td className="py-1.5 px-3 text-slate-600 leading-tight">
                      {p.address || '-'}
                    </td>
                    <td className="py-1.5 px-3 font-mono font-bold uppercase text-slate-800">
                      {p.vehiclePlate || '-'}
                    </td>
                    <td className="py-1.5 px-3 text-slate-400 text-[9px] max-w-[150px] truncate leading-tight">
                      {p.notes || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Produk & Standar Harga */}
      {activeTab === 'produk' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {products.map((prod) => (
            <div
              key={prod.id}
              className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4"
            >
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-mono">
                    {prod.code}
                  </span>
                  <h3 className="font-extrabold text-base text-slate-900 mt-1">
                    {prod.name}
                  </h3>
                  <p className="text-xs text-slate-500">{prod.description}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Harga Default Beli (Rp/kg)
                  </label>
                  <input
                    type="number"
                    value={prod.defaultPricePerKg}
                    onChange={(e) =>
                      handleUpdateProductPrice(
                        prod,
                        Number(e.target.value) || 0,
                        prod.defaultRafaksiPct
                      )
                    }
                    className="w-full px-3 py-2 text-xs font-mono font-black text-indigo-950 border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Standar Rafaksi Default (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={prod.defaultRafaksiPct}
                    onChange={(e) =>
                      handleUpdateProductPrice(
                        prod,
                        prod.defaultPricePerKg,
                        Number(e.target.value) || 0
                      )
                    }
                    className="w-full px-3 py-2 text-xs font-mono font-black text-rose-600 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Pengaturan Profil RAM */}
      {activeTab === 'pengaturan' && isOwner && (
        <form
          onSubmit={handleSaveSettings}
          className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs max-w-2xl space-y-4"
        >
          <h3 className="font-bold text-slate-900 text-base pb-3 border-b border-slate-100">
            Profil Bisnis & Timbangan RAM
          </h3>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Nama Usaha RAM
            </label>
            <input
              type="text"
              value={settings.ramName}
              onChange={(e) => setSettings({ ...settings, ramName: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Alamat Lokasi Pos Timbangan
            </label>
            <input
              type="text"
              value={settings.address}
              onChange={(e) => setSettings({ ...settings, address: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              No. Telepon / WhatsApp
            </label>
            <input
              type="text"
              value={settings.phone}
              onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Default Upah Bongkar (Rp/kg)
              </label>
              <input
                type="number"
                value={settings.defaultUnloadingFeePerKg}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    defaultUnloadingFeePerKg: Number(e.target.value) || 0,
                  })
                }
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Default Potongan Rafaksi (%)
              </label>
              <input
                type="number"
                step="0.1"
                value={settings.defaultRafaksiPct}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    defaultRafaksiPct: Number(e.target.value) || 0,
                  })
                }
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold"
                required
              />
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <button
              type="submit"
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/20"
            >
              Simpan Pengaturan Profil
            </button>
            
            <button
              type="button"
              onClick={handleResetData}
              disabled={isResetting}
              className={`px-6 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs rounded-xl border border-rose-200 transition-colors flex items-center gap-2 ${isResetting ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isResetting ? (
                <>
                  <div className="w-3 h-3 border-2 border-rose-600 border-t-transparent rounded-full animate-spin" />
                  Mereset Data...
                </>
              ) : (
                'Reset Semua Data (Hapus Dummy/Testing)'
              )}
            </button>
          </div>
        </form>
      )}

      {/* Add Party Modal */}
      {isPartyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <form
            onSubmit={handleSaveParty}
            className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4"
          >
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Tambah Data Kontak Baru</h3>
              <button
                type="button"
                onClick={() => setIsPartyModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Tipe Kontak
              </label>
              <select
                value={partyType}
                onChange={(e) =>
                  setPartyType(
                    e.target.value as 'PETANI' | 'PABRIK' | 'SOPIR' | 'AFFILIATE'
                  )
                }
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold"
              >
                <option value="PETANI">Petani Sawit</option>
                <option value="PABRIK">Pabrik PKS (Pembeli)</option>
                <option value="SOPIR">Sopir / Armada Pengangkut</option>
                <option value="AFFILIATE">Affiliate / Broker Rombongan</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nama Lengkap / Instansi
              </label>
              <input
                type="text"
                placeholder="Contoh: Pak Joko Santoso / PKS Sawit Raya"
                value={partyName}
                onChange={(e) => setPartyName(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nomor Telepon / WhatsApp
              </label>
              <input
                type="text"
                placeholder="0812-xxxx-xxxx"
                value={partyPhone}
                onChange={(e) => setPartyPhone(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>

            {(partyType === 'PETANI' || partyType === 'SOPIR') && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nomor Polisi Kendaraan (Plat Nomor)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: BK 8219 XL"
                  value={partyPlate}
                  onChange={(e) => setPartyPlate(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl uppercase font-mono font-bold"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Alamat / Catatan Khusus
              </label>
              <input
                type="text"
                placeholder="Desa / lokasi kebun / ketentuan"
                value={partyAddress}
                onChange={(e) => setPartyAddress(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsPartyModalOpen(false)}
                className="px-4 py-2 border rounded-xl text-xs font-semibold"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold"
              >
                Simpan Kontak
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
