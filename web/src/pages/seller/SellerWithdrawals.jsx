import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import api from "../../api/client";

export default function SellerWithdrawals() {
  const [withdrawals, setWithdrawals] = useState([]);
  const [balance, setBalance] = useState(0);
  const [totalWithdrawn, setTotalWithdrawn] = useState(0);
  const [amount, setAmount] = useState('');
  
  const [activeTab, setActiveTab] = useState('requests'); // 'requests' | 'ledger'
  const [transactions, setTransactions] = useState([]);

  // Bank Details State
  const [bankDetailsConfigured, setBankDetailsConfigured] = useState(false);
  const [showBankForm, setShowBankForm] = useState(false);
  const [bankDetails, setBankDetails] = useState({
      bank_account_number: '',
      bank_ifsc: '',
      bank_beneficiary_name: '',
      upi_id: '',
      preferred_payout_method: 'bank'
  });
  const [loadingBank, setLoadingBank] = useState(false);

  const fetchWithdrawals = () => {
    api.get("/api/seller/withdrawals").then((res) => {
      setWithdrawals(res.data.withdrawals);
      setBalance(res.data.balance);
      setTotalWithdrawn(res.data.total_withdrawn);
      setBankDetailsConfigured(res.data.bank_details_configured);
      if (!res.data.bank_details_configured) {
          setShowBankForm(true);
      }
    });
  };
  
  const fetchBankDetails = () => {
      api.get("/api/seller/bank-details").then(res => {
          setBankDetails(res.data);
      });
  };

  const fetchTransactions = () => {
      api.get("/api/seller/transactions").then((res) => {
          setTransactions(res.data);
      });
  };

  useEffect(() => {
    fetchWithdrawals();
    fetchBankDetails();
  }, []);

  useEffect(() => {
    if (activeTab === 'ledger') {
        fetchTransactions();
    }
  }, [activeTab]);

  const handleSaveBankDetails = () => {
      // Validation logic
      const hasBank = bankDetails.bank_account_number && bankDetails.bank_ifsc && bankDetails.bank_beneficiary_name;
      const hasUpi = !!bankDetails.upi_id;

      if (!hasBank && !hasUpi) {
          alert("Please provide either Bank Details OR UPI ID");
          return;
      }
      
      if (bankDetails.preferred_payout_method === 'bank' && !hasBank) {
           alert("You selected Bank Transfer as preferred but bank details are incomplete.");
           return;
      }
      if (bankDetails.preferred_payout_method === 'upi' && !hasUpi) {
           alert("You selected UPI as preferred but UPI ID is missing.");
           return;
      }

      setLoadingBank(true);
      api.post("/api/seller/bank-details", bankDetails)
        .then(() => {
            alert("Payout details saved successfully");
            setBankDetailsConfigured(true);
            setShowBankForm(false);
            fetchWithdrawals(); // Refresh to sync state
        })
        .catch(err => {
            console.error(err);
            alert("Failed to save payout details");
        })
        .finally(() => setLoadingBank(false));
  };

  const handleRequest = () => {
    const withdrawAmount = parseFloat(amount);
    if (!withdrawAmount || withdrawAmount <= 0 || withdrawAmount > balance) {
        alert("Invalid withdrawal amount");
        return;
    }

    api.post('/api/seller/withdrawals/request', { amount: withdrawAmount })
      .then(() => {
        alert("Withdrawal requested successfully");
        setAmount('');
        fetchWithdrawals(); 
      })
      .catch(err => {
        console.error('Withdraw request failed', err);
        alert(err.response?.data?.description || 'Failed to create withdrawal request');
      });
  }
  
  const handleCancel = (id) => {
      if(!window.confirm("Cancel this withdrawal request? Funds will be returned to your balance.")) return;
      
      api.post(`/api/seller/withdrawals/${id}/cancel`)
        .then(() => {
            fetchWithdrawals();
            if(activeTab === 'ledger') fetchTransactions();
        })
        .catch(err => {
            console.error('Cancel failed', err);
            alert('Failed to cancel withdrawal');
        });
  }

  return (
    <>
      <Helmet>
        <title>Withdrawal Requests</title>
      </Helmet>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
            <h1 className="text-2xl font-semibold">Withdrawal Requests</h1>
            <div className="bg-slate-100 p-1 rounded-lg flex text-sm">
                <button 
                    onClick={() => setActiveTab('requests')}
                    className={`px-4 py-1.5 rounded-md transition-colors ${activeTab === 'requests' ? 'bg-white shadow text-slate-800 font-medium' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Requests & Balance
                </button>
                <button 
                    onClick={() => setActiveTab('ledger')}
                    className={`px-4 py-1.5 rounded-md transition-colors ${activeTab === 'ledger' ? 'bg-white shadow text-slate-800 font-medium' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Transaction History
                </button>
            </div>
        </div>
        
        {/* Balance & Request Card */}
        <div className="bg-white rounded-xl shadow p-6">
            <div className="flex flex-col md:flex-row justify-between gap-8">
                
                {/* Left: Balance Info */}
                <div className="flex-1">
                    <h3 className="text-sm text-gray-500 uppercase tracking-wider mb-1">Available Balance</h3>
                    <p className="text-4xl font-bold text-slate-800">₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                    <p className="text-sm text-gray-500 mt-4">Total Withdrawn: <span className="font-semibold text-slate-700">₹{totalWithdrawn.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></p>
                    
                    <div className="mt-6">
                        <h4 className="text-sm font-medium text-slate-700 mb-2">Receiving Account</h4>
                        {bankDetailsConfigured && !showBankForm ? (
                            <div className="bg-slate-50 p-3 rounded border border-slate-100 text-sm space-y-1">
                                {bankDetails.preferred_payout_method === 'upi' ? (
                                     <>
                                        <p className="font-semibold text-slate-800 flex items-center gap-2">
                                            <span className="material-symbols-outlined text-green-600">check_circle</span> UPI Transfer
                                        </p>
                                        <p className="text-slate-600">VPA: {bankDetails.upi_id}</p>
                                     </>
                                ) : (
                                     <>
                                        <p className="font-semibold text-slate-800 flex items-center gap-2">
                                            <span className="material-symbols-outlined text-blue-600">account_balance</span> Bank Transfer
                                        </p>
                                        <p className="text-slate-600">{bankDetails.bank_beneficiary_name}</p>
                                        <p className="text-slate-600">Acc: {bankDetails.bank_account_number}</p>
                                        <p className="text-slate-600">IFSC: {bankDetails.bank_ifsc}</p>
                                     </>
                                )}
                                <button onClick={() => setShowBankForm(true)} className="text-blue-600 text-xs font-medium mt-2 hover:underline">Change Payout Details</button>
                            </div>
                        ) : (
                            <div className="p-3 bg-amber-50 border border-amber-100 rounded text-amber-800 text-sm">
                                Payout details not configured. <button onClick={() => setShowBankForm(true)} className="underline font-semibold">Add Details</button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: Request Form */}
                <div className="flex-1 space-y-4 border-t md:border-t-0 md:border-l border-gray-100 pt-4 md:pt-0 md:pl-8">
                  
                  {showBankForm ? (
                      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-4">
                          <h3 className="font-semibold text-slate-800 text-sm">Setup Payout Details</h3>
                          
                          <div className="space-y-3">
                              <label className="block text-xs font-medium text-slate-600">Preferred Method</label>
                              <div className="flex gap-4">
                                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                                      <input 
                                        type="radio" 
                                        name="payout_method" 
                                        checked={bankDetails.preferred_payout_method === 'bank'} 
                                        onChange={() => setBankDetails({...bankDetails, preferred_payout_method: 'bank'})}
                                      /> Bank Transfer
                                  </label>
                                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                                      <input 
                                        type="radio" 
                                        name="payout_method" 
                                        checked={bankDetails.preferred_payout_method === 'upi'} 
                                        onChange={() => setBankDetails({...bankDetails, preferred_payout_method: 'upi'})}
                                      /> UPI
                                  </label>
                              </div>
                          </div>

                          {bankDetails.preferred_payout_method === 'bank' && (
                              <div className="space-y-2 animate-in fade-in">
                                <input 
                                    placeholder="Beneficiary Name" 
                                    value={bankDetails.bank_beneficiary_name} 
                                    onChange={e => setBankDetails({...bankDetails, bank_beneficiary_name: e.target.value})} 
                                    className="w-full border rounded px-3 py-2 text-sm" 
                                />
                                <input 
                                    placeholder="Account Number" 
                                    value={bankDetails.bank_account_number} 
                                    onChange={e => setBankDetails({...bankDetails, bank_account_number: e.target.value})} 
                                    className="w-full border rounded px-3 py-2 text-sm" 
                                />
                                <input 
                                    placeholder="IFSC Code" 
                                    value={bankDetails.bank_ifsc} 
                                    onChange={e => setBankDetails({...bankDetails, bank_ifsc: e.target.value})} 
                                    className="w-full border rounded px-3 py-2 text-sm" 
                                />
                              </div>
                          )}

                          {bankDetails.preferred_payout_method === 'upi' && (
                              <div className="space-y-2 animate-in fade-in">
                                  <input 
                                    placeholder="UPI ID (e.g. name@okhdfcbank)" 
                                    value={bankDetails.upi_id || ''} 
                                    onChange={e => setBankDetails({...bankDetails, upi_id: e.target.value})} 
                                    className="w-full border rounded px-3 py-2 text-sm" 
                                  />
                              </div>
                          )}

                          <div className="flex gap-2 pt-2">
                              <button onClick={handleSaveBankDetails} disabled={loadingBank} className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                                  {loadingBank ? 'Saving...' : 'Save & Close'}
                              </button>
                              <button onClick={() => setShowBankForm(false)} className="text-slate-600 px-4 py-2 rounded text-sm hover:bg-slate-200">Cancel</button>
                          </div>
                      </div>
                  ) : (
                      <>
                        <h3 className="font-medium text-slate-800">Request Payout</h3>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Amount</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
                                <input 
                                    type="number" 
                                    value={amount} 
                                    onChange={e => setAmount(e.target.value)} 
                                    max={balance}
                                    className="w-full pl-8 pr-3 py-2 border rounded text-sm focus:outline-none focus:border-slate-500" 
                                    placeholder="0.00"
                                />
                            </div>
                        </div>

                        <button 
                            onClick={handleRequest} 
                            disabled={balance <= 0 || !amount || parseFloat(amount) <= 0 || !bankDetailsConfigured} 
                            className="w-full bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
                        >
                            {bankDetailsConfigured ? 'Request Withdrawal' : 'Setup Bank Details First'}
                        </button>
                      </>
                  )}
                </div>
            </div>
        </div>

        {/* History Table */}
        {activeTab === 'requests' && (
            <div className="bg-white rounded-xl shadow overflow-hidden">
                <div className="p-4 border-b border-gray-100 bg-gray-50">
                    <h2 className="font-semibold text-slate-700">Withdrawal History</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-white text-gray-500 border-b">
                            <tr>
                                <th className="p-4 font-medium">Date</th>
                                <th className="p-4 font-medium">Amount</th>
                                <th className="p-4 font-medium">Status</th>
                                <th className="p-4 font-medium">Note</th>
                                <th className="p-4 font-medium">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {withdrawals.length > 0 ? withdrawals.map(w => (
                                <tr key={w.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="p-4">{new Date(w.created_at).toLocaleDateString()}</td>
                                    <td className="p-4">₹{w.amount.toFixed(2)}</td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                            w.status === 'approved' || w.status === 'completed' ? 'bg-green-100 text-green-800' :
                                            w.status === 'rejected' || w.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                                            'bg-yellow-100 text-yellow-800'
                                        }`}>
                                            {w.status.toUpperCase()}
                                        </span>
                                    </td>
                                    <td className="p-4 text-gray-500 text-xs">{w.rejection_reason || '-'}</td>
                                    <td className="p-4">
                                        {w.status === 'requested' && (
                                            <button onClick={() => handleCancel(w.id)} className="text-red-600 hover:underline text-xs">Cancel</button>
                                        )}
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="5" className="p-8 text-center text-gray-400">No withdrawal requests found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        )}
        
        {activeTab === 'ledger' && (
            <div className="bg-white rounded-xl shadow overflow-hidden">
                <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                    <h2 className="font-semibold text-slate-700">Transaction Ledger</h2>
                    <span className="text-xs text-gray-500">Showing recent activity</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-white text-gray-500 border-b">
                            <tr>
                                <th className="p-4 font-medium">Date</th>
                                <th className="p-4 font-medium">Description</th>
                                <th className="p-4 font-medium text-right">Credit</th>
                                <th className="p-4 font-medium text-right">Debit</th>
                                <th className="p-4 font-medium">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {transactions.map(t => (
                                <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="p-4 text-gray-600">{new Date(t.date).toLocaleDateString()}</td>
                                    <td className="p-4 font-medium text-slate-700">{t.description}</td>
                                    <td className="p-4 text-right text-green-600">
                                        {t.type === 'credit' ? `+ ₹${t.amount.toFixed(2)}` : '-'}
                                    </td>
                                    <td className="p-4 text-right text-red-600">
                                        {t.type === 'debit' ? `- ₹${t.amount.toFixed(2)}` : '-'}
                                    </td>
                                    <td className="p-4">
                                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                                            t.status === 'completed' ? 'bg-gray-100 text-gray-600' :
                                            t.status === 'cancelled' || t.status === 'rejected' ? 'bg-red-50 text-red-500 line-through' :
                                            'bg-blue-50 text-blue-600'
                                        }`}>
                                            {t.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {transactions.length === 0 && (
                                <tr><td colSpan="5" className="p-8 text-center text-gray-400">No transactions found.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        )}
      </div>
    </>
  );
}
