import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { format } from 'date-fns';

export default function UserManagementModal({ isOpen, onClose, currentUser }) {
  const [users, setUsers] = useState([]);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [resetPasswordUser, setResetPasswordUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [createForm, setCreateForm] = useState({
    username: '',
    password: '',
    email: '',
    is_admin: false
  });

  const formatDateDisplay = (dateStr) => {
    try {
      return format(new Date(dateStr), 'MMM d, yyyy');
    } catch (e) {
      return dateStr;
    }
  };

  useEffect(() => {
    if (isOpen && currentUser) {
      loadUsers();
    }
  }, [isOpen, currentUser]);

  const loadUsers = async () => {
    try {
      if (currentUser.is_admin) {
        const response = await api.getAllUsers();
        setUsers(response.users);
      } else {
        // For regular users, show only themselves
        setUsers([currentUser]);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      await api.createUser(createForm);
      setCreateForm({ username: '', password: '', email: '', is_admin: false });
      setShowCreateUser(false);
      await loadUsers();
    } catch (error) {
      console.error('Error creating user:', error);
      alert(error.response?.data?.error || 'Error creating user');
    }
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    try {
      await api.updateUser(editingUser.id, {
        username: editingUser.username,
        email: editingUser.email
      });
      setEditingUser(null);
      await loadUsers();

      // Update localStorage if user edited themselves
      if (editingUser.id === currentUser.id) {
        const updatedUser = { ...currentUser, username: editingUser.username, email: editingUser.email };
        localStorage.setItem('user', JSON.stringify(updatedUser));
      }
    } catch (error) {
      console.error('Error updating user:', error);
      alert(error.response?.data?.error || 'Error updating user');
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }

    try {
      await api.resetUserPassword(resetPasswordUser.id, newPassword);
      setResetPasswordUser(null);
      setNewPassword('');
      alert('Password updated successfully');
    } catch (error) {
      console.error('Error resetting password:', error);
      alert(error.response?.data?.error || 'Error resetting password');
    }
  };

  const handleDeleteUser = async (userId) => {
    const user = users.find(u => u.id === userId);
    const isSelfDeletion = userId === currentUser.id;

    let confirmationMessage;
    if (isSelfDeletion) {
      confirmationMessage = `⚠️ Delete your account "${user.username}"?\n\nThis will permanently delete:\n• Your profile and all data\n• Activity entries and logs\n• Trackers and counters\n• Tasks and custom fields\n\nThis action cannot be undone. Are you sure?`;
    } else {
      confirmationMessage = `Delete user "${user.username}"? This action cannot be undone.`;
    }

    if (!confirm(confirmationMessage)) return;

    try {
      const response = await api.deleteUser(userId);
      alert(response.message || 'User deleted successfully');

      if (isSelfDeletion) {
        // User deleted their own account - logout
        api.logout();
      } else {
        await loadUsers();
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      alert(error.response?.data?.error || 'Error deleting user');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: '2rem'
      }}
    >
      <div
        className="card users-card admin-section"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '900px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          position: 'relative'
        }}
      >
        <div className="card-header-with-toggle" style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-primary)', zIndex: 1, paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
          <div>
            <h2>{currentUser?.is_admin ? '👥 User Management' : '👤 Account Settings'}</h2>
            <p className="description">
              {currentUser?.is_admin
                ? 'Create and manage user accounts'
                : 'Manage your account settings and data'
              }
            </p>
          </div>
          <button
            onClick={onClose}
            className="btn btn-sm btn-ghost"
            style={{ fontSize: '1.5rem' }}
            title="Close"
          >
            ✖
          </button>
        </div>

        {/* User Management Content */}
        <div style={{ padding: '1rem 0' }}>
          {/* Create New User Button (Admin Only) */}
          {currentUser?.is_admin && (
            <>
              <button
                onClick={() => setShowCreateUser(!showCreateUser)}
                className="btn btn-sm btn-primary"
              >
                {showCreateUser ? 'Cancel' : 'Create New User'}
              </button>

              {showCreateUser && (
                <form onSubmit={handleCreateUser} className="create-user-form">
                  <h3>Create New User</h3>

                  <div className="form-group">
                    <label>Username</label>
                    <input
                      type="text"
                      value={createForm.username}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, username: e.target.value }))}
                      placeholder="Username"
                      minLength="3"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Password</label>
                    <input
                      type="password"
                      value={createForm.password}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, password: e.target.value }))}
                      placeholder="Password"
                      minLength="6"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Email</label>
                    <input
                      type="email"
                      value={createForm.email}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="Email (optional)"
                    />
                  </div>

                  <div className="form-group">
                    <label>
                      <input
                        type="checkbox"
                        checked={createForm.is_admin}
                        onChange={(e) => setCreateForm(prev => ({ ...prev, is_admin: e.target.checked }))}
                      />
                      Admin User
                    </label>
                  </div>

                  <button type="submit" className="btn btn-primary">
                    Create User
                  </button>
                </form>
              )}
            </>
          )}

          {/* Users List */}
          {users.length > 0 && (
            <div className="users-list">
              <h3>{currentUser?.is_admin ? 'Existing Users' : 'Your Account'}</h3>
              {users.map((user) => (
                <div key={user.id} className="user-item">
                  <div className="user-info">
                    <strong>{user.username}</strong>
                    {user.email && <span className="user-email">{user.email}</span>}
                    <span className="user-date">
                      Created: {formatDateDisplay(user.created_at)}
                    </span>
                  </div>
                  <div className="user-actions">
                    <span className={`user-role ${user.is_admin ? 'admin' : 'user'}`}>
                      {user.is_admin ? 'Admin' : 'User'}
                    </span>
                    {currentUser?.is_admin ? (
                      // Admin can edit and reset password for all users
                      <>
                        <button
                          onClick={() => setEditingUser({...user})}
                          className="btn-icon btn-icon-sm btn-primary"
                          title="Edit user"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => {
                            setResetPasswordUser(user);
                            setNewPassword('');
                          }}
                          className="btn-icon btn-icon-sm btn-warning"
                          title="Reset password"
                        >
                          🔑
                        </button>
                        {user.id !== currentUser.id && (
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            className="btn-icon btn-icon-sm btn-danger"
                            title="Delete user"
                          >
                            🗑️
                          </button>
                        )}
                      </>
                    ) : (
                      // Regular user can only edit their own info and delete their account
                      <>
                        <button
                          onClick={() => setEditingUser({...user})}
                          className="btn-icon btn-icon-sm btn-primary"
                          title="Edit your profile"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => {
                            setResetPasswordUser(user);
                            setNewPassword('');
                          }}
                          className="btn-icon btn-icon-sm btn-warning"
                          title="Change password"
                        >
                          🔑
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          className="btn-icon btn-icon-sm btn-danger"
                          title="Delete your account"
                          style={{
                            backgroundColor: '#dc3545',
                            color: 'white',
                            border: '1px solid #dc3545'
                          }}
                        >
                          🗑️
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Edit User Modal */}
        {editingUser && (
          <div className="modal-overlay" onClick={() => setEditingUser(null)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h3>Edit User: {editingUser.username}</h3>
              <form onSubmit={handleUpdateUser}>
                <div className="form-group">
                  <label>Username</label>
                  <input
                    type="text"
                    value={editingUser.username}
                    onChange={(e) => setEditingUser(prev => ({ ...prev, username: e.target.value }))}
                    minLength="3"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={editingUser.email || ''}
                    onChange={(e) => setEditingUser(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="Email (optional)"
                  />
                </div>

                <div className="form-actions">
                  <button type="submit" className="btn btn-primary">Save Changes</button>
                  <button type="button" onClick={() => setEditingUser(null)} className="btn btn-secondary">Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Reset Password Modal */}
        {resetPasswordUser && (
          <div className="modal-overlay" onClick={() => setResetPasswordUser(null)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h3>Reset Password: {resetPasswordUser.username}</h3>
              <form onSubmit={handleResetPassword}>
                <div className="form-group">
                  <label>New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    minLength="6"
                    required
                  />
                </div>

                <div className="form-actions">
                  <button type="submit" className="btn btn-warning">Reset Password</button>
                  <button type="button" onClick={() => setResetPasswordUser(null)} className="btn btn-secondary">Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
