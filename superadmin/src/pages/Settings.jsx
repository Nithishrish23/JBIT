import React, { useEffect, useState } from 'react';
import api from '../api/client';
import Layout from '../components/Layout';

export default function Settings() {
  const [configs, setConfigs] = useState([]);
  const [baseDomainInput, setBaseDomainInput] = useState('localhost:5173'); // Default for local dev
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState(''); // 'success' or 'error'

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await api.get('/config');
      setConfigs(res.data);
      const domainConfig = res.data.find(c => c.key === 'BASE_PLATFORM_DOMAIN');
      if (domainConfig) {
          setBaseDomainInput(domainConfig.value);
      }
    } catch (err) { console.error(err); }
  };

  const handleSave = async () => {
    setMessage('');
    setMessageType('');
    try {
      await api.put('/config', { key: 'BASE_PLATFORM_DOMAIN', value: baseDomainInput, description: 'Base domain for client subdomains' });
      setMessage('Settings saved successfully!');
      setMessageType('success');
      fetchConfig(); // Re-fetch to confirm and update other parts of the UI if needed
    } catch (err) { 
      setMessage('Failed to save settings: ' + (err.response?.data?.error || err.message));
      setMessageType('error');
      console.error(err);
    }
  };

  return (
    <Layout>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">System Settings</h2>
      
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        {message && (
            <div className={`p-3 mb-4 rounded-md ${messageType === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {message}
            </div>
        )}

        <div className="border-b border-gray-100 pb-4 mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Base Platform Domain</label>
            <input 
                type="text" 
                value={baseDomainInput}
                onChange={(e) => setBaseDomainInput(e.target.value)}
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">This is the base domain for automatically generated subdomains (e.g., yoursite.com).</p>
            <button
                onClick={handleSave}
                className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
                Save Base Domain
            </button>
        </div>
        
        {configs.length === 0 ? (
            <p className="text-gray-500">No other configuration settings found.</p>
        ) : (
            <div className="space-y-6">
                {configs.map((conf) => (
                    // Filter out BASE_PLATFORM_DOMAIN if it's already handled above
                    conf.key === 'BASE_PLATFORM_DOMAIN' ? null : (
                        <div key={conf.key} className="border-b border-gray-100 pb-4 last:border-0">
                            <label className="block text-sm font-medium text-gray-700 mb-1">{conf.key}</label>
                            <div className="flex gap-4">
                                <input 
                                    type="text" 
                                    defaultValue={conf.value} // Use defaultValue for uncontrolled if not managing state for all
                                    className="flex-1 rounded-md border border-gray-300 px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                                    onBlur={(e) => handleUpdate(conf.key, e.target.value)}
                                />
                                {/* For other configs, assuming onBlur is still desired or needs individual save buttons */}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">{conf.description}</p>
                        </div>
                    )
                ))}
            </div>
        )}
      </div>
    </Layout>
  );
}
