import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import api from "../../api/client";

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", email: "", password: "", role: "user" });
  const [loading, setLoading] = useState(false);

  const fetchUsers = () => {
    api.get("/api/admin/users").then((res) => {
      setUsers(res.data);
    });
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewUser({ ...newUser, [name]: value });
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/api/admin/users", newUser);
      alert("User added successfully!");
      setNewUser({ name: "", email: "", password: "", role: "user" });
      setShowAddModal(false);
      fetchUsers(); // Refresh the list
    } catch (error) {
      console.error("Failed to add user:", error);
      alert(error.response?.data?.error || "Failed to add user.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>All Users</title>
      </Helmet>
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-textprimary">All Users</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-primary text-white px-4 py-2 rounded hover:bg-primary/90"
        >
          Add New User
        </button>
        <div className="bg-sidebarbg rounded-xl shadow-sm p-4 border border-primary/20">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-primary/10">
                <th className="p-2 text-textsecondary">ID</th>
                <th className="p-2 text-textsecondary">Name</th>
                <th className="p-2 text-textsecondary">Email</th>
                <th className="p-2 text-textsecondary">Role</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-primary/10 hover:bg-brandbg/5">
                  <td className="p-2 text-textprimary">{user.id}</td>
                  <td className="p-2 text-textprimary">{user.name}</td>
                  <td className="p-2 text-textprimary">{user.email}</td>
                  <td className="p-2 text-textprimary capitalize">{user.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-sidebarbg rounded-lg shadow-luxury w-full max-w-md p-6 border border-primary/20">
            <h2 className="text-lg font-bold mb-4 text-textprimary">Add New User</h2>
            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-textsecondary">Name</label>
                <input
                  type="text"
                  name="name"
                  value={newUser.name}
                  onChange={handleInputChange}
                  className="mt-1 block w-full border border-primary/20 bg-transparent rounded px-3 py-2 text-textprimary focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-textsecondary">Email</label>
                <input
                  type="email"
                  name="email"
                  value={newUser.email}
                  onChange={handleInputChange}
                  className="mt-1 block w-full border border-primary/20 bg-transparent rounded px-3 py-2 text-textprimary focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-textsecondary">Password</label>
                <input
                  type="password"
                  name="password"
                  value={newUser.password}
                  onChange={handleInputChange}
                  className="mt-1 block w-full border border-primary/20 bg-transparent rounded px-3 py-2 text-textprimary focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-textsecondary">Role</label>
                <select
                  name="role"
                  value={newUser.role}
                  onChange={handleInputChange}
                  className="mt-1 block w-full border border-primary/20 bg-sidebarbg rounded px-3 py-2 text-textprimary focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                >
                  <option value="user">User</option>
                  <option value="seller">Seller</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="px-4 py-2 border border-primary/20 rounded text-textsecondary hover:bg-brandbg/10"
                  onClick={() => setShowAddModal(false)}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 disabled:opacity-50"
                  disabled={loading}
                >
                  {loading ? "Adding..." : "Add User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}