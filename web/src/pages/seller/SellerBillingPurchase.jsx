
import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import api from "../../api/client";

export default function SellerBillingPurchase() {
  const [bills, setBills] = useState([]);
  const [file, setFile] = useState(null);

  const fetchBills = () => {
    api.get("/api/seller/billing/purchase").then((res) => {
      setBills(res.data);
    });
  };

  useEffect(() => {
    fetchBills();
  }, []);

  const handleUpload = (e) => {
    e.preventDefault();
    if (!file) return;

    const formData = new FormData();
    formData.append("bill", file);

    api.post("/api/seller/billing/purchase", formData, {
        headers: { "Content-Type": "multipart/form-data" }
    }).then(() => {
        fetchBills();
        setFile(null);
        e.target.reset();
    });
  };

  return (
    <>
      <Helmet>
        <title>Purchase Bills</title>
      </Helmet>
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Purchase Bills</h1>
        <form onSubmit={handleUpload} className="bg-white rounded-xl shadow p-5 space-x-4 flex items-center">
            <input type="file" onChange={e => setFile(e.target.files[0])} className="text-sm" required />
            <button type="submit" className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm">Upload Bill</button>
        </form>
        <div className="bg-white rounded-xl shadow p-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="p-2">File Name</th>
                <th className="p-2">Upload Date</th>
                <th className="p-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {bills.map((bill) => (
                <tr key={bill.id} className="border-t">
                  <td className="p-2">{bill.file_name}</td>
                  <td className="p-2">{new Date(bill.created_at).toLocaleDateString()}</td>
                  <td className="p-2"><a href={bill.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">View</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
