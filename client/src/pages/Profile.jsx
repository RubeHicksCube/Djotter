import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { api } from '../services/api';
import { formatLogTime } from '../utils/timezone';
import { useUserSettings } from '../contexts/UserSettingsContext';
import { PeekingOtterTop, PeekingOtterSide } from '../components/OtterDecorations';

import QueriesDataExport from '../components/QueriesDataExport';

const formatDateDisplay = (dateStr) => {
  if (!dateStr) return 'N/A';

  try {
    const date = new Date(dateStr);
    // Check if date is valid
    if (isNaN(date.getTime())) return 'Invalid Date';

    return format(date, 'yyyy-MMM-dd');
  } catch (error) {
    console.error('Error formatting date:', dateStr, error);
    return 'Invalid Date';
  }
};

export default function Profile() {
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [profileFields, setProfileFields] = useState({});
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [resetPasswordUser, setResetPasswordUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [showUserManagement, setShowUserManagement] = useState(false);

  // Quick Stats
  const [quickStats, setQuickStats] = useState({
    totalTasks: 0,
    totalTimers: 0,
    totalTimeSince: 0,
    totalCounters: 0,
    totalLogEntries: 0,
    pointsBalance: 0,
    pointsEarned: 0,
    pointsRedeemed: 0,
    totalSnapshots: 0,
    totalFields: 0,
    lastLogin: null
  });

  // Export states
  const [availableDates, setAvailableDates] = useState([]);
  // Dates will be initialized from server (user's timezone)
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Retention settings
  const [retentionSettings, setRetentionSettings] = useState({ maxDays: 30, maxCount: 100 });

  // Redemption modal state
  const [showRedemptionModal, setShowRedemptionModal] = useState(false);
  const [rewardDescription, setRewardDescription] = useState('');
  const [pointsCost, setPointsCost] = useState(0);
  const [redemptionsHistory, setRedemptionsHistory] = useState([]);
  const [showRedemptionHistory, setShowRedemptionHistory] = useState(false);

  // Form states
  const [editForm, setEditForm] = useState({
    username: '',
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  
  const [createForm, setCreateForm] = useState({
    username: '',
    password: '',
    email: '',
    is_admin: false
  });

  // Profile fields form
  const [fieldForm, setFieldForm] = useState({
    key: '',
    value: ''
  });

  useEffect(() => {
    loadData();
    loadAvailableDates();
    loadRetentionSettings();
    loadQuickStats();
    loadRedemptionHistory();

    // Listen for custom event to open User Management modal
    const handleOpenUserManagement = () => {
      setShowUserManagement(true);
    };

    // Refresh available dates when page gains focus
    const handleFocus = () => {
      loadAvailableDates();
      loadQuickStats();
    };

    window.addEventListener('openUserManagement', handleOpenUserManagement);
    window.addEventListener('focus', handleFocus);

    // Also refresh every 5 seconds to catch saves from nav
    const interval = setInterval(() => {
      loadAvailableDates();
      loadQuickStats();
    }, 5000);

    return () => {
      window.removeEventListener('openUserManagement', handleOpenUserManagement);
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, []);

  // Update stats when dependencies change
  useEffect(() => {
    if (availableDates.length > 0 || currentUser) {
      loadQuickStats();
    }
  }, [availableDates.length, currentUser]);

  const loadData = async () => {
    try {
      const userResponse = await api.getCurrentUser();

      setCurrentUser(userResponse.user);
      setProfileFields(userResponse.profileFields || {});

      // Set date defaults to user's current date in their timezone
      if (userResponse.currentDate) {
        setStartDate(userResponse.currentDate);
        setEndDate(userResponse.currentDate);
      }

      setEditForm({
        username: userResponse.user.username,
        email: userResponse.user.email || '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });

      // Load users based on role
      if (userResponse.user.is_admin) {
        const usersResponse = await api.getAllUsers();
        setUsers(usersResponse.users);
      } else {
        // For regular users, show only themselves
        setUsers([userResponse.user]);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setMessage('');

    if (editForm.newPassword && editForm.newPassword !== editForm.confirmPassword) {
      setMessage('New passwords do not match');
      return;
    }

    if (editForm.newPassword && editForm.newPassword.length < 6) {
      setMessage('Password must be at least 6 characters');
      return;
    }

    try {
      const response = await api.updateProfile({
        username: editForm.username,
        email: editForm.email,
        currentPassword: editForm.currentPassword,
        newPassword: editForm.newPassword
      });

      if (response.success) {
        setCurrentUser(response.user);
        localStorage.setItem('user', JSON.stringify(response.user));
        setEditForm(prev => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }));
        setMessage('Profile updated successfully!');
      } else {
        setMessage(response.error || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Profile update error:', error);
      setMessage('Error updating profile');
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setMessage('');

    if (createForm.username.length < 3) {
      setMessage('Username must be at least 3 characters');
      return;
    }

    if (createForm.password.length < 6) {
      setMessage('Password must be at least 6 characters');
      return;
    }

    try {
      const response = await api.createUser(createForm);
      
      if (response.success) {
        setUsers(prev => [response.user, ...prev]);
        setCreateForm({ username: '', password: '', email: '', is_admin: false });
        setShowCreateUser(false);
        setMessage('User created successfully!');
      } else {
        setMessage(response.error || 'Failed to create user');
      }
    } catch (error) {
      console.error('User creation error:', error);
      setMessage('Error creating user');
    }
  };

  const handleAddProfileField = async (e) => {
    e.preventDefault();
    setMessage('');

    if (!fieldForm.key.trim() || !fieldForm.value.trim()) {
      setMessage('Key and value required');
      return;
    }

    try {
      const response = await api.updateProfileField(fieldForm.key, fieldForm.value);
      
      if (response.success) {
        setProfileFields(prev => ({ ...prev, [fieldForm.key]: fieldForm.value }));
        setFieldForm({ key: '', value: '' });
        setMessage('Profile field added successfully!');
      } else {
        setMessage(response.error || 'Failed to add profile field');
      }
    } catch (error) {
      console.error('Profile field error:', error);
      setMessage('Error adding profile field');
    }
  };

  const handleDeleteProfileField = async (key) => {
    if (!confirm(`Delete profile field "${key}"?`)) return;

    try {
      const response = await api.deleteProfileField(key);

      if (response.success) {
        setProfileFields(prev => {
          const newFields = { ...prev };
          delete newFields[key];
          return newFields;
        });
        setMessage('Profile field deleted successfully!');
      } else {
        setMessage(response.error || 'Failed to delete profile field');
      }
    } catch (error) {
      console.error('Profile field deletion error:', error);
      setMessage('Error deleting profile field');
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
      if (response.success) {
        setUsers(prev => prev.filter(u => u.id !== userId));
        setMessage('User deleted successfully!');
      } else {
        setMessage(response.error || 'Failed to delete user');
      }
    } catch (error) {
      console.error('Delete user error:', error);
      setMessage('Error deleting user');
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();

    if (!newPassword || newPassword.length < 6) {
      setMessage('Password must be at least 6 characters');
      return;
    }

    try {
      const response = await api.resetUserPassword(resetPasswordUser.id, newPassword);
      if (response.success) {
        setMessage(`Password reset for ${resetPasswordUser.username}!`);
        setResetPasswordUser(null);
        setNewPassword('');
      } else {
        setMessage(response.error || 'Failed to reset password');
      }
    } catch (error) {
      console.error('Reset password error:', error);
      setMessage('Error resetting password');
    }
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();

    try {
      const response = await api.updateUser(editingUser.id, {
        username: editingUser.username,
        email: editingUser.email,
        is_admin: editingUser.is_admin
      });

      if (response.success) {
        setUsers(prev => prev.map(u => u.id === editingUser.id ? response.user : u));
        setMessage(`User ${response.user.username} updated successfully!`);
        setEditingUser(null);
      } else {
        setMessage(response.error || 'Failed to update user');
      }
    } catch (error) {
      console.error('Update user error:', error);
      setMessage('Error updating user');
    }
  };

  const loadAvailableDates = async () => {
    try {
      const response = await api.getAvailableExportDates();
      setAvailableDates(response.dates || []);
    } catch (error) {
      console.error('Error loading available dates:', error);
    }
  };

  const loadRetentionSettings = async () => {
    try {
      const settings = await api.getRetentionSettings();
      setRetentionSettings(settings);
    } catch (error) {
      console.error('Error loading retention settings:', error);
    }
  };

  const loadQuickStats = async () => {
    try {
      // Get current state with all data
      const state = await api.getState();

      // Get points balance
      let pointsData = { balance: 0, earned: 0, redeemed: 0 };
      try {
        const response = await fetch('/api/points/balance', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          }
        });
        if (response.ok) {
          pointsData = await response.json();
        }
      } catch (error) {
        console.error('Error loading points:', error);
      }

      setQuickStats({
        totalTasks: state?.dailyTasks?.length || 0,
        totalTimers: state?.durationTrackers?.length || 0,
        totalTimeSince: state?.timeSinceTrackers?.length || 0,
        totalCounters: state?.customCounters?.length || 0,
        totalLogEntries: state?.entries?.length || 0,
        pointsBalance: pointsData.balance || 0,
        pointsEarned: pointsData.earned || 0,
        pointsRedeemed: pointsData.redeemed || 0,
        totalSnapshots: availableDates.length,
        totalFields: state?.customFields?.length || 0,
        lastLogin: currentUser?.created_at
      });
    } catch (error) {
      console.error('Error loading quick stats:', error);
    }
  };

  const loadRedemptionHistory = async () => {
    try {
      const response = await fetch('/api/points/redemptions', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setRedemptionsHistory(data.redemptions || []);
      }
    } catch (error) {
      console.error('Error loading redemption history:', error);
    }
  };

  const handleCancelRedemption = async (redemptionId) => {
    if (!confirm('Cancel this redemption? Points will be refunded.')) return;

    try {
      const response = await fetch(`/api/points/redemptions/${redemptionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(data.message || 'Redemption cancelled successfully');
        loadRedemptionHistory();
        loadQuickStats();
      } else {
        setMessage(data.error || 'Failed to cancel redemption');
      }
    } catch (error) {
      console.error('Error cancelling redemption:', error);
      setMessage('Failed to cancel redemption');
    }
  };

  const handleDeleteSnapshot = async (date) => {
    if (!confirm(`Delete snapshot for ${date}? This cannot be undone.`)) return;

    try {
      const response = await api.deleteSnapshot(date);
      if (response.success) {
        setAvailableDates(response.dates);
        setMessage(`Deleted snapshot for ${date}`);
      } else {
        setMessage(response.error || 'Failed to delete snapshot');
      }
    } catch (error) {
      console.error('Error deleting snapshot:', error);
      setMessage('Error deleting snapshot');
    }
  };

  const handleUpdateRetentionSettings = async () => {
    try {
      const response = await api.updateRetentionSettings(
        retentionSettings.maxDays,
        retentionSettings.maxCount
      );
      if (response.success) {
        setAvailableDates(response.dates);
      }
    } catch (error) {
      console.error('Error updating retention settings:', error);
    }
  };

  const handleSaveSnapshot = async () => {
    try {
      const response = await api.saveSnapshot();
      if (response.success) {
        setMessage(`Snapshot saved for ${response.date}!`);
        loadAvailableDates(); // Refresh the list
      }
    } catch (error) {
      console.error('Error saving snapshot:', error);
      setMessage('Error saving snapshot');
    }
  };

  const handleDownloadRange = () => {
    if (!startDate || !endDate) {
      setMessage('Please select both start and end dates');
      return;
    }

    if (startDate > endDate) {
      setMessage('Start date must be before end date');
      return;
    }

    api.downloadDateRange(startDate, endDate);
    setMessage(`Downloading markdown export from ${startDate} to ${endDate}...`);
  };

  const handleDownloadRangePDF = () => {
    if (!startDate || !endDate) {
      setMessage('Please select both start and end dates');
      return;
    }

    if (startDate > endDate) {
      setMessage('Start date must be before end date');
      return;
    }

    api.downloadDateRangePDF(startDate, endDate);
    setMessage(`Downloading PDF export from ${startDate} to ${endDate}...`);
  };

  const handleRedeemPoints = async () => {
    if (!rewardDescription.trim() || pointsCost <= 0) {
      setMessage('Please enter a valid reward and points cost');
      return;
    }

    if (pointsCost > quickStats.pointsBalance) {
      setMessage('Insufficient points');
      return;
    }

    try {
      const response = await fetch('/api/points/redeem', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({ rewardDescription, pointsCost })
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(data.message);
        setShowRedemptionModal(false);
        setRewardDescription('');
        setPointsCost(0);
        loadQuickStats(); // Refresh points balance
        loadRedemptionHistory(); // Refresh redemption list
      } else {
        setMessage(data.error || 'Failed to redeem points');
      }
    } catch (error) {
      console.error('Error redeeming points:', error);
      setMessage('Error redeeming points');
    }
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="container" style={{ position: 'relative' }}>
      <PeekingOtterSide side="right" />
      <header>
        <div className="date-header" style={{ position: 'relative', overflow: 'visible' }}>
          <PeekingOtterTop />
          <h1 className="date-large">User Profile</h1>
        </div>
        

      </header>

      {/* Three-Column Layout */}
      <div className="grid-layout">
        {/* Profile Edit */}
        <div className="card card-primary">
          <h2>👤 Edit Profile</h2>
          <p className="card-description">Update your account information</p>

          <form onSubmit={handleProfileUpdate} className="profile-form">
            <div className="form-group">
              <label>Username</label>
              <input
                type="text"
                value={editForm.username}
                onChange={(e) => setEditForm(prev => ({ ...prev, username: e.target.value }))}
                placeholder="Username"
                minLength="3"
                required
              />
            </div>

            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                placeholder="Email (optional)"
              />
            </div>

            <div className="form-group">
              <label>Current Password</label>
              <input
                type="password"
                value={editForm.currentPassword}
                onChange={(e) => setEditForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                placeholder="Current password (required for password change)"
              />
            </div>

            <div className="form-group">
              <label>New Password</label>
              <input
                type="password"
                value={editForm.newPassword}
                onChange={(e) => setEditForm(prev => ({ ...prev, newPassword: e.target.value }))}
                placeholder="New password (leave blank to keep current)"
                minLength="6"
              />
            </div>

            <div className="form-group">
              <label>Confirm New Password</label>
              <input
                type="password"
                value={editForm.confirmPassword}
                onChange={(e) => setEditForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                placeholder="Confirm new password"
                minLength="6"
              />
            </div>

            <button type="submit" className="btn btn-primary">
              Update Profile
            </button>
          </form>

          {message && (
            <div className="message">
              {message}
            </div>
          )}
        </div>

        {/* Profile Fields */}
        <div className="card card-primary">
          <h2>📝 Profile Fields</h2>
          <p className="card-description">Custom fields that get exported with your daily markdown files</p>

          {/* Add Field Form */}
          <form onSubmit={handleAddProfileField} className="profile-field-form">
            <h3>Add Field</h3>
            <div className="form-row">
              <div className="form-group">
                <label>Field Name</label>
                <input
                  type="text"
                  value={fieldForm.key}
                  onChange={(e) => setFieldForm(prev => ({ ...prev, key: e.target.value }))}
                  placeholder="e.g., age, location, role"
                  required
                />
              </div>
              <div className="form-group">
                <label>Value</label>
                <input
                  type="text"
                  value={fieldForm.value}
                  onChange={(e) => setFieldForm(prev => ({ ...prev, value: e.target.value }))}
                  placeholder="e.g., 31, Denver, Developer"
                  required
                />
              </div>
              <button type="submit" className="btn btn-sm btn-primary">
                Add Field
              </button>
            </div>
          </form>

          {/* Existing Fields */}
          {Object.keys(profileFields).length > 0 && (
            <div className="profile-fields-list">
              <h3>Your Fields</h3>
              {Object.entries(profileFields).map(([key, value]) => (
                <div key={key} className="profile-field-item">
                  <div className="field-content">
                    <span className="field-key">{key}:</span>
                    <span className="field-value">{value}</span>
                  </div>
                  <button
                    onClick={() => handleDeleteProfileField(key)}
                    className="btn-icon btn-icon-sm btn-danger"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {Object.keys(profileFields).length === 0 && (
            <div className="empty-state">No profile fields yet</div>
          )}
        </div>

        {/* Quick Stats */}
        <div className="card card-secondary">
          <h2>📊 Quick Stats</h2>
          <p className="card-description">Your activity summary</p>
          <div style={{ display: 'grid', gap: '0.75rem', marginTop: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', borderRadius: '4px', backgroundColor: 'var(--bg-secondary)' }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>📝 Tasks (Today)</span>
              <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>{quickStats.totalTasks}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', borderRadius: '4px', backgroundColor: 'var(--bg-secondary)' }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>⏱️ Timers</span>
              <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>{quickStats.totalTimers}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', borderRadius: '4px', backgroundColor: 'var(--bg-secondary)' }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>📅 Time Since</span>
              <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>{quickStats.totalTimeSince}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', borderRadius: '4px', backgroundColor: 'var(--bg-secondary)' }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>🔢 Counters</span>
              <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>{quickStats.totalCounters}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', borderRadius: '4px', backgroundColor: 'var(--bg-secondary)' }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>📋 Log Entries (Today)</span>
              <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>{quickStats.totalLogEntries}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', borderRadius: '4px', backgroundColor: 'var(--bg-secondary)' }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>💾 Snapshots</span>
              <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>{quickStats.totalSnapshots}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', borderRadius: '4px', backgroundColor: 'var(--bg-secondary)' }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>🏷️ Fields Tracked</span>
              <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>{quickStats.totalFields}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', borderRadius: '4px', backgroundColor: 'var(--bg-secondary)' }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>🔐 Last Login</span>
              <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                {quickStats.lastLogin ? formatDateDisplay(quickStats.lastLogin) : 'N/A'}
              </span>
            </div>

            {/* Points Section */}
            <div style={{
              marginTop: '1rem',
              padding: '1rem',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, var(--primary-color), var(--success-color))',
              border: '2px solid var(--primary-color)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '1rem', color: 'white', fontWeight: 'bold' }}>⭐ Total Points</span>
                <span style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'white' }}>{quickStats.pointsBalance}</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.9)', marginBottom: '0.75rem' }}>
                Earned: {quickStats.pointsEarned} | Redeemed: {quickStats.pointsRedeemed}
              </div>
              <button
                onClick={() => setShowRedemptionModal(true)}
                className="btn btn-warning"
                style={{ width: '100%', fontWeight: 'bold' }}
                disabled={quickStats.pointsBalance === 0}
              >
                🎁 Redeem Points
              </button>
              <button
                onClick={() => setShowRedemptionHistory(!showRedemptionHistory)}
                className="btn btn-ghost"
                style={{ width: '100%', marginTop: '0.5rem', fontSize: '0.875rem' }}
              >
                📜 {showRedemptionHistory ? 'Hide' : 'View'} Redemption History ({redemptionsHistory.length})
              </button>
            </div>

            {/* Redemption History */}
            {showRedemptionHistory && redemptionsHistory.length > 0 && (
              <div style={{ marginTop: '1rem', maxHeight: '300px', overflowY: 'auto' }}>
                {redemptionsHistory.map((redemption) => (
                  <div
                    key={redemption.id}
                    style={{
                      padding: '0.75rem',
                      marginBottom: '0.5rem',
                      borderRadius: '6px',
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>
                        {redemption.reward_description}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                        {new Date(redemption.redeemed_at).toLocaleDateString()} • {redemption.points_cost} points
                      </div>
                    </div>
                    <button
                      onClick={() => handleCancelRedemption(redemption.id)}
                      className="btn btn-sm btn-danger"
                      style={{ marginLeft: '0.5rem' }}
                    >
                      Cancel & Refund
                    </button>
                  </div>
                ))}
              </div>
            )}

            {showRedemptionHistory && redemptionsHistory.length === 0 && (
              <div style={{ marginTop: '1rem', padding: '1rem', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>
                No redemptions yet
              </div>
            )}
          </div>
        </div>
      </div>

        {/* Full-Width Queries & Data Export Section */}
        <div className="card card-success" style={{ marginTop: '2rem' }}>
          <QueriesDataExport
            queryTasks={api.queryTasks}
            queryFields={api.queryFields}
            exportCSV={api.exportCSV}
            getCustomFieldTemplates={api.getCustomFieldTemplates}
            availableDates={availableDates}
            handleSaveSnapshot={handleSaveSnapshot}
            handleDeleteSnapshot={handleDeleteSnapshot}
            retentionSettings={retentionSettings}
            setRetentionSettings={setRetentionSettings}
            handleUpdateRetentionSettings={handleUpdateRetentionSettings}
            startDate={startDate}
            setStartDate={setStartDate}
            endDate={endDate}
            setEndDate={setEndDate}
            handleDownloadRange={handleDownloadRange}
            handleDownloadRangePDF={handleDownloadRangePDF}
            formatDateDisplay={formatDateDisplay}
          />
          </div>

      {/* User Management Modal (Available for all users) */}
      {currentUser && showUserManagement && (
        <div
          className="modal-overlay"
          onClick={() => setShowUserManagement(false)}
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
                <h2>{currentUser.is_admin ? '👥 User Management' : '👤 Account Settings'}</h2>
                <p className="description">
                  {currentUser.is_admin 
                    ? 'Create and manage user accounts' 
                    : 'Manage your account settings and data'
                  }
                </p>
              </div>
              <button
                onClick={() => setShowUserManagement(false)}
                className="btn btn-sm btn-ghost"
                style={{ fontSize: '1.5rem' }}
                title="Close"
              >
                ✖
              </button>
            </div>

            {/* User Management Content */}
            <div style={{ padding: '1rem 0' }}>
            {currentUser.is_admin && (
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

          {/* Users List */}
          {users.length > 0 && (
            <div className="users-list">
              <h3>{currentUser.is_admin ? 'Existing Users' : 'Your Account'}</h3>
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
                    {currentUser.is_admin ? (
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
                    />
                  </div>
                  <div className="form-group">
                    <label>
                      <input
                        type="checkbox"
                        checked={editingUser.is_admin}
                        onChange={(e) => setEditingUser(prev => ({ ...prev, is_admin: e.target.checked }))}
                      />
                      Admin User
                    </label>
                  </div>
                  <div className="modal-buttons">
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
                      minLength="6"
                      placeholder="Enter new password (min 6 characters)"
                      required
                    />
                  </div>
                  <div className="modal-buttons">
                    <button type="submit" className="btn btn-warning">Reset Password</button>
                    <button type="button" onClick={() => setResetPasswordUser(null)} className="btn btn-secondary">Cancel</button>
                  </div>
                </form>
              </div>
            </div>
          )}
            </>
            )}
            </div>
          </div>
        </div>
      )}

      {/* Points Redemption Modal */}
      {showRedemptionModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowRedemptionModal(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2001,
            padding: '2rem'
          }}
        >
          <div
            className="card"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '500px',
              width: '100%',
              padding: '2rem'
            }}
          >
            <h2 style={{ marginBottom: '1rem' }}>🎁 Redeem Points</h2>
            <p style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
              Available Points: <strong style={{ color: 'var(--primary-color)', fontSize: '1.25rem' }}>{quickStats.pointsBalance}</strong>
            </p>

            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label">Reward Description</label>
              <input
                type="text"
                value={rewardDescription}
                onChange={(e) => setRewardDescription(e.target.value)}
                className="form-input"
                placeholder="e.g., Movie night, Ice cream, New book"
                autoFocus
              />
            </div>

            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="form-label">Points Cost</label>
              <input
                type="number"
                value={pointsCost}
                onChange={(e) => setPointsCost(parseInt(e.target.value) || 0)}
                className="form-input"
                placeholder="How many points?"
                min="1"
                max={quickStats.pointsBalance}
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowRedemptionModal(false);
                  setRewardDescription('');
                  setPointsCost(0);
                }}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleRedeemPoints}
                className="btn btn-success"
                disabled={!rewardDescription.trim() || pointsCost <= 0 || pointsCost > quickStats.pointsBalance}
              >
                Redeem {pointsCost > 0 ? `${pointsCost} Points` : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}