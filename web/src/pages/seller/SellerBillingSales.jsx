
import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import api from "../../api/client";

export default function SellerBillingSales() {
  const [bills, setBills] = useState([]);

  useEffect(() => {
    api.get("/api/seller/billing/sales").then((res) => {
      setBills(res.data);
    });
  }, []);

  return (
    <>
      <Helmet>
        <title>Sales Bills</title>
      </Helmet>
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Sales Bills</h1>
        <div className="bg-white rounded-xl shadow p-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="p-2">Bill ID</th>
                <th className="p-2">Order ID</th>
                <th className="p-2">Date</th>
                <th className="p-2">Amount</th>
                <th className="p-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {bills.map((bill) => (
                <tr key={bill.id} className="border-t">
                  <td className="p-2">#{bill.id}</td>
                  <td className="p-2">#{bill.order_id}</td>
                  <td className="p-2">{new Date(bill.created_at).toLocaleDateString()}</td>
                  <td className="p-2">₹{bill.total_amount.toFixed(2)}</td>
                  <td className="p-2"><a href={bill.pdf_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Download</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
