'use client';

import { useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'billing' | 'api-keys' | 'security' | 'notifications'>('profile');

  const tabs = [
    { id: 'profile' as const, label: 'Profile', icon: '👤' },
    { id: 'billing' as const, label: 'Billing', icon: '💳' },
    { id: 'api-keys' as const, label: 'API Keys', icon: '🔑' },
    { id: 'security' as const, label: 'Security', icon: '🔒' },
    { id: 'notifications' as const, label: 'Notifications', icon: '🔔' }
  ];

  const ProfileTab = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-24 h-24 bg-gradient-to-r from-teal-500 to-teal-600 rounded-3xl flex items-center justify-center mx-auto mb-4 text-4xl shadow-2xl">
          {user?.email?.[0]?.toUpperCase() || 'U'}
        </div>
        <h2 className="text-2xl font-bold text-slate-900">{user?.email?.split('@')[0] || 'User'}</h2>
        <p className="text-slate-500">{user?.email || 'user@example.com'}</p>
      </div>
      
      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <label className="block text-sm font-semibold text-slate-700">Display Name</label>
          <input 
            type="text" 
            placeholder="Enter your name"
            className="w-full p-4 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
        </div>
        <div className="space-y-4">
          <label className="block text-sm font-semibold text-slate-700">Email</label>
          <input 
            type="email" 
            value={user?.email || ''}
            className="w-full p-4 border border-slate-200 rounded-2xl bg-slate-50 cursor-not-allowed"
            disabled
          />
        </div>
      </div>
      
      <button className="w-full bg-gradient-to-r from-teal-500 to-teal-600 text-white py-4 px-8 rounded-2xl font-semibold text-lg shadow-xl hover:from-teal-600 hover:to-teal-700 transform hover:-translate-y-1 transition-all">
        💾 Save Profile
      </button>
    </div>
  );

  const BillingTab = () => (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 p-6 rounded-3xl border border-emerald-200">
        <h3 className="text-xl font-bold text-emerald-800 mb-2 flex items-center gap-2">
          🎉 Free Plan - Unlimited Bots
        </h3>
        <p className="text-emerald-700">100 bot runs/month • Priority support • CSV & Resume screening</p>
      </div>
      
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border">
          <h4 className="font-semibold text-slate-900 mb-2">Usage this month</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Data Analyst Bot</span>
              <span className="font-semibold">12 runs</span>
            </div>
            <div className="flex justify-between">
              <span>Resume Screener</span>
              <span className="font-semibold">3 runs</span>
            </div>
            <div className="flex justify-between text-emerald-600 font-semibold">
              <span>Total</span>
              <span>15/100 runs</span>
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 p-6 rounded-2xl border border-purple-200">
          <h4 className="font-semibold text-purple-800 mb-4">Upgrade to Pro</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span>Unlimited runs</span><span>$29/mo</span></div>
            <div className="flex justify-between"><span>Priority support</span><span>✅</span></div>
            <div className="flex justify-between"><span>Custom bots</span><span>Coming soon</span></div>
          </div>
          <button className="w-full mt-6 bg-gradient-to-r from-purple-500 to-indigo-600 text-white py-3 px-6 rounded-xl font-semibold shadow-lg hover:from-purple-600 hover:to-indigo-700">
            Upgrade to Pro
          </button>
        </div>
      </div>
    </div>
  );

  const ApiKeysTab = () => (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border">
        <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
          🔑 API Keys
        </h3>
        <p className="text-sm text-slate-600 mb-6">Generate API keys to integrate BotHub with your apps</p>
        <button className="w-full bg-gradient-to-r from-teal-500 to-teal-600 text-white py-3 px-6 rounded-xl font-semibold shadow-lg hover:from-teal-600 hover:to-teal-700">
          Generate New API Key
        </button>
      </div>
      
      <div className="bg-slate-50 p-6 rounded-2xl">
        <h4 className="font-semibold text-slate-900 mb-4">Active Keys</h4>
        <div className="text-xs text-slate-500 text-center py-8">
          No API keys yet. Generate your first key above.
        </div>
      </div>
    </div>
  );

  const SecurityTab = () => (
    <div className="space-y-6">
      <h3 className="text-xl font-bold text-slate-900 mb-6">Security Settings</h3>
      <div className="bg-slate-50 p-6 rounded-2xl border">
        <p className="text-slate-600 mb-4">Change password, enable 2FA, session management</p>
        <button className="bg-gradient-to-r from-orange-500 to-orange-600 text-white py-3 px-6 rounded-xl font-semibold">
          Change Password
        </button>
      </div>
    </div>
  );

  const NotificationsTab = () => (
    <div className="space-y-6">
      <h3 className="text-xl font-bold text-slate-900 mb-6">Notification Preferences</h3>
      <div className="bg-slate-50 p-6 rounded-2xl border space-y-4">
        <label className="flex items-center gap-3">
          <input type="checkbox" className="w-4 h-4 text-teal-600 rounded" />
          <span className="text-sm text-slate-700">Job completion emails</span>
        </label>
        <label className="flex items-center gap-3">
          <input type="checkbox" className="w-4 h-4 text-teal-600 rounded" />
          <span className="text-sm text-slate-700">Usage reports (weekly)</span>
        </label>
        <label className="flex items-center gap-3">
          <input type="checkbox" className="w-4 h-4 text-teal-600 rounded" />
          <span className="text-sm text-slate-700">New features & updates</span>
        </label>
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'profile':
        return <ProfileTab />;
      case 'billing':
        return <BillingTab />;
      case 'api-keys':
        return <ApiKeysTab />;
      case 'security':
        return <SecurityTab />;
      case 'notifications':
        return <NotificationsTab />;
      default:
        return <ProfileTab />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-teal-50/50 p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Hero */}
        <div className="text-center">
          <div className="inline-flex items-center gap-3 bg-teal-100/80 text-teal-800 px-6 py-3 rounded-2xl mb-6 border border-teal-200/50">
            <div className="w-2 h-2 bg-teal-500 rounded-full animate-pulse" />
            <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-blue-600 bg-clip-text text-transparent">
              Settings
            </h1>
          </div>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Manage your BotHub account, billing, and API access
          </p>
        </div>

        {/* Tabs */}
        <div className="bg-white/80 backdrop-blur-sm shadow-xl border border-slate-100/50 rounded-3xl p-1">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`p-4 rounded-2xl flex flex-col items-center gap-2 transition-all group ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-teal-500 to-teal-600 text-white shadow-lg'
                    : 'text-slate-600 hover:text-teal-600 hover:bg-teal-50'
                }`}
              >
                <span className="text-2xl">{tab.icon}</span>
                <span className="text-xs font-semibold">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-white shadow-2xl border-0 rounded-3xl overflow-hidden">
          <div className="p-8">
            {renderTabContent()}
          </div>
        </div>
      </div>
    </div>
  );
}
