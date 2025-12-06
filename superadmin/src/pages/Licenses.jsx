import React, { useEffect, useState } from 'react';
import api from '../api/client';
import Layout from '../components/Layout';

export default function Licenses() {
  const [licenses, setLicenses] = useState([]);
  const [clients, setClients] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [formData, setFormData] = useState({ client_id: '', plan_type: 'basic', days_valid: 365 });
  const [activateData, setActivateData] = useState({ key: '', machine_hash: '' });

  useEffect(() => {
    fetchLicenses();
    fetchClients();
  }, []);

  const fetchLicenses = async () => {
    try {
      const res = await api.get('/licenses');
      setLicenses(res.data);
    } catch (err) { console.error(err); }
  };

  const fetchClients = async () => {
    try {
      const res = await api.get('/clients');
      setClients(res.data);
    } catch (err) { console.error(err); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/licenses', formData);
      setShowModal(false);
      fetchLicenses();
    } catch (err) {
      alert("Failed to generate license");
    }
  };

  const handleActivate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/licenses/validate', activateData);
      setShowActivateModal(false);
      alert("License activated successfully!");
      fetchLicenses();
    } catch (err) {
      alert("Activation failed: " + (err.response?.data?.error || err.message));
    }
  };

  const openActivateModal = (licenseKey) => {
      setActivateData({ key: licenseKey, machine_hash: '' });
      setShowActivateModal(true);
  }

  return (
    <Layout>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">License Management</h2>
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
        >
          + Generate License
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Key</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Plan</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Machine Hash</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valid Until</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {licenses.map((lic) => (
              <tr key={lic.license_id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap font-mono text-sm text-gray-700">{lic.key}</td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-900">{lic.client_name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-500 capitalize">{lic.plan_type}</td>
                <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-gray-500">
                    {lic.machine_hash ? (
                        <span title={lic.machine_hash}>{lic.machine_hash.substring(0, 10)}...</span>
                    ) : (
                        <span className="text-yellow-600">Unbound</span>
                    )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    lic.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {lic.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-500">{new Date(lic.valid_until).toLocaleDateString()}</td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {!lic.machine_hash && (
                        <button 
                            onClick={() => openActivateModal(lic.key)}
                            className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 px-3 py-1 rounded-md"
                        >
                            Activate
                        </button>
                    )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-xl shadow-xl w-96">
            <h3 className="text-xl font-bold mb-4">Generate License</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Client</label>
                <select
                  required
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-blue-500"
                  value={formData.client_id}
                  onChange={e => setFormData({...formData, client_id: e.target.value})}
                >
                    <option value="">Select Client</option>
                    {clients.map(c => <option key={c.client_id} value={c.client_id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Plan Type</label>
                <select
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-blue-500"
                  value={formData.plan_type}
                  onChange={e => setFormData({...formData, plan_type: e.target.value})}
                >
                    <option value="basic">Basic</option>
                    <option value="pro">Pro</option>
                    <option value="enterprise">Enterprise</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Duration (Days)</label>
                <input
                  type="number"
                  required
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-blue-500"
                  value={formData.days_valid}
                  onChange={e => setFormData({...formData, days_valid: e.target.value})}
                />
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Generate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Activate Modal */}
      {showActivateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-xl shadow-xl w-96">
            <h3 className="text-xl font-bold mb-4">Activate License</h3>
            <p className="text-sm text-gray-500 mb-4">
                Manually bind this license to a specific Machine ID.
            </p>
            <form onSubmit={handleActivate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">License Key</label>
                <input
                  type="text"
                  disabled
                  className="mt-1 block w-full rounded-md border border-gray-200 bg-gray-100 px-3 py-2 text-gray-500"
                  value={activateData.key}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Machine Hash / CPU ID</label>
                <input
                  type="text"
                  required
                  placeholder="Enter Client CPU ID"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-blue-500"
                  value={activateData.machine_hash}
                  onChange={e => setActivateData({...activateData, machine_hash: e.target.value})}
                />
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowActivateModal(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Activate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}