
import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import { useSearchParams, useNavigate } from "react-router-dom";
import api from "../../api/client";

export default function UserAddresses() {
  const [addresses, setAddresses] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [addressLine1, setAddressLine1] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("India");
  
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const redirectTarget = searchParams.get("redirect");

  const fetchAddresses = () => {
    api.get("/api/user/addresses").then((res) => {
      setAddresses(res.data);
      // If redirect is set and we have no addresses, ensure form is open
      if (redirectTarget && res.data.length === 0) {
          setShowForm(true);
      }
    });
  };

  useEffect(() => {
    fetchAddresses();
    if (redirectTarget) {
        setShowForm(true);
    }
  }, [redirectTarget]);

  const handleSetDefault = (id) => {
    api.put(`/api/user/addresses/${id}/set-default`).then(() => {
        fetchAddresses();
    });
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
        await api.post("/api/user/addresses", {
            address_line_1: addressLine1,
            city,
            state,
            postal_code: postalCode,
            country
        });
        
        if (redirectTarget === 'checkout') {
            navigate('/checkout');
            return;
        }

        setShowForm(false);
        setAddressLine1("");
        setCity("");
        setState("");
        setPostalCode("");
        fetchAddresses();
    } catch (err) {
        console.error("Failed to add address", err);
        alert("Failed to add address");
    }
  };

  const handleDelete = async (id) => {
    if(!window.confirm("Are you sure you want to delete this address?")) return;
    try {
        await api.delete(`/api/user/addresses/${id}`);
        fetchAddresses();
    } catch (err) {
        console.error("Failed to delete address", err);
        alert("Failed to delete address");
    }
  };

  return (
    <>
      <Helmet>
        <title>Your Addresses</title>
      </Helmet>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-semibold">Your Addresses</h1>
          <button onClick={() => setShowForm(!showForm)} className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm">
            {showForm ? 'Cancel' : 'Add New Address'}
          </button>
        </div>

        {showForm && (
            <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-5 space-y-4 text-sm">
                <input value={addressLine1} onChange={e => setAddressLine1(e.target.value)} placeholder="Address Line 1" className="border rounded w-full px-3 py-2" required />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <input value={city} onChange={e => setCity(e.target.value)} placeholder="City" className="border rounded w-full px-3 py-2" required />
                    <input value={state} onChange={e => setState(e.target.value)} placeholder="State" className="border rounded w-full px-3 py-2" required />
                    <input value={postalCode} onChange={e => setPostalCode(e.target.value)} placeholder="Postal Code" className="border rounded w-full px-3 py-2" required />
                </div>
                <button type="submit" className="bg-slate-800 text-white rounded px-5 py-2 text-sm">Save Address</button>
            </form>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {addresses.map(addr => (
                <div key={addr.id} className="bg-white rounded-xl shadow p-5 text-sm">
                    <div className="flex justify-between">
                        <p className="font-semibold">
                            {addr.address_line_1}, {addr.city}
                        </p>
                        <div className="flex gap-2 items-center">
                            {addr.is_default && <span className="text-green-600 text-xs font-medium">Default</span>}
                            <button onClick={() => handleDelete(addr.id)} className="text-red-500 text-xs hover:underline">Delete</button>
                            {!addr.is_default && (
                                <button onClick={() => handleSetDefault(addr.id)} className="text-blue-500 text-xs hover:underline">Set as Default</button>
                            )}
                        </div>
                    </div>
                    <p>{addr.state}, {addr.postal_code}</p>
                    <p>{addr.country}</p>
                </div>
            ))}
        </div>
        {addresses.length === 0 && !showForm && (
            <div className="bg-white rounded-xl shadow p-10 text-center">
                <p className="text-gray-600">You have no saved addresses.</p>
            </div>
        )}
      </div>
    </>
  );
}
