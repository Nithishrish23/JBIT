import React, { useEffect, useState } from 'react';
import api from '../api/client';
import Layout from '../components/Layout';

export default function Admins() {
  const [clients, setClients] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [basePlatformDomain, setBasePlatformDomain] = useState('localhost:3000'); // Default for local dev
  
  const [formData, setFormData] = useState({ 
      name: '', 
      email: '', 
      subdomain: '', 
      custom_domain: '',
      industry: 'default',
      admin_password: ''
  });

  const [configData, setConfigData] = useState({
      client_id: '',
      subdomain: '',
      custom_domain: '',
      theme_config: {}
  });

  useEffect(() => {
    fetchClients();
    fetchBasePlatformDomain();
  }, []);

  const fetchClients = async () => {
    try {
      const res = await api.get('/clients');
      setClients(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchBasePlatformDomain = async () => {
      try {
          const res = await api.get('/config');
          const domainConfig = res.data.find(c => c.key === 'BASE_PLATFORM_DOMAIN');
          if (domainConfig) {
              setBasePlatformDomain(domainConfig.value);
          }
      } catch (err) {
          console.error("Failed to fetch BASE_PLATFORM_DOMAIN", err);
      }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/clients', formData);
      setShowModal(false);
      setFormData({ name: '', email: '', subdomain: '', custom_domain: '', industry: 'default', admin_password: '' });
      fetchClients();
      alert("Client & Admin User created!");
    } catch (err) {
      const errorMsg = err.response?.data?.error || "Failed to create client";
      alert(errorMsg);
    }
  };

  const openConfig = (client) => {
      setConfigData({
          client_id: client.client_id,
          subdomain: client.subdomain || '',
          custom_domain: client.custom_domain || '',
          theme_config: client.theme_config || {}
      });
      setShowConfigModal(true);
  };

  const handleConfigSubmit = async (e) => {
      e.preventDefault();
      try {
          await api.put(`/clients/${configData.client_id}`, {
              subdomain: configData.subdomain,
              custom_domain: configData.custom_domain
          });
          setShowConfigModal(false);
          fetchClients();
      } catch (err) {
          alert("Failed to update config");
      }
  };

  const toggleBlockStatus = async (client) => {
      const newStatus = client.status === 'blocked' ? 'active' : 'blocked';
      if (confirm(`Are you sure you want to ${newStatus} this client?`)) {
          try {
              await api.put(`/clients/${client.client_id}`, { status: newStatus });
              fetchClients();
          } catch (err) {
              alert("Failed to update status");
          }
      }
  };

  return (
    <Layout>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Tenant & Admin Management</h2>
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
        >
          + Add Tenant Admin
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Admin Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Domain</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {clients.map((client) => (
              <tr key={client.client_id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{client.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-500">{client.email}</td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                    <div>{client.subdomain ? `${client.subdomain}.${basePlatformDomain}` : '-'}</div>
                    <div className="text-xs text-gray-400">{client.custom_domain}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    client.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {client.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button 
                    className="text-blue-600 hover:text-blue-900 mr-3"
                    onClick={() => openConfig(client)}
                  >
                    Config
                  </button>
                  <button 
                    className={`${client.status === 'blocked' ? 'text-green-600 hover:text-green-900' : 'text-red-600 hover:text-red-900'} mr-3`}
                    onClick={() => toggleBlockStatus(client)}
                  >
                    {client.status === 'blocked' ? 'Unblock' : 'Block'}
                  </button>
                  <button 
                    className="text-gray-500 hover:text-gray-700"
                    onClick={async () => {
                        if(confirm('Delete client? This action cannot be undone.')) {
                            await api.delete(`/clients/${client.client_id}`);
                            fetchClients();
                        }
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-xl shadow-xl w-[500px]">
            <h3 className="text-xl font-bold mb-4">New Tenant & Admin</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Client/Shop Name</label>
                <input
                  type="text"
                  required
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Admin Email</label>
                <input
                  type="email"
                  required
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value.trim()})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Initial Password (Optional)</label>
                <input
                  type="text"
                  placeholder="Default: TempPassword123!"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  value={formData.admin_password}
                  onChange={e => setFormData({...formData, admin_password: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Subdomain (Optional)</label>
                    <input
                      type="text"
                      placeholder={`shop1.${basePlatformDomain}`}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                      value={formData.subdomain}
                      onChange={e => setFormData({...formData, subdomain: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Custom Domain</label>
                    <input
                      type="text"
                      placeholder="shop.com"
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                      value={formData.custom_domain}
                      onChange={e => setFormData({...formData, custom_domain: e.target.value})}
                    />
                  </div>
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
                  Create Tenant
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Config Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-xl shadow-xl w-[500px]">
            <h3 className="text-xl font-bold mb-4">Configure Tenant</h3>
            <form onSubmit={handleConfigSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Subdomain</label>
                <input
                  type="text"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  value={configData.subdomain}
                  onChange={e => setConfigData({...configData, subdomain: e.target.value})}
                />
                <p className="text-xs text-gray-500 mt-1">.{basePlatformDomain}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Custom Domain</label>
                <input
                  type="text"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  value={configData.custom_domain}
                  onChange={e => setConfigData({...configData, custom_domain: e.target.value})}
                />
              </div>
              
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}