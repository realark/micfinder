import React, { useState } from 'react';

const PasswordChange = ({ onPasswordChanged, onCancel, token }) => {
  const [passwords, setPasswords] = useState({
    newPassword: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  
  const API_URL = import.meta.env.VITE_MICFINDER_API_URL;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setPasswords(prev => ({ ...prev, [name]: value }));
    // Clear error when user types
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate passwords
    if (passwords.newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }
    
    if (passwords.newPassword !== passwords.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    setIsLoading(true);
    
    try {
      const response = await fetch(`${API_URL}/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ newPassword: passwords.newPassword })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to change password');
      }
      
      setSuccess(true);
      // Wait a moment to show success message before calling the callback
      setTimeout(() => {
        onPasswordChanged();
      }, 1500);
      
    } catch (error) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4">
          {success ? 'Password Changed Successfully!' : 'Change Your Password'}
        </h2>
        
        {success ? (
          <div className="text-green-600 mb-4">
            Your password has been updated successfully.
          </div>
        ) : (
          <>
            <p className="text-gray-600 mb-4">
              Please create a new password for your account.
            </p>
            
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                {error}
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block mb-1">New Password:</label>
                <input
                  type="password"
                  name="newPassword"
                  value={passwords.newPassword}
                  onChange={handleChange}
                  className="w-full border p-2 rounded"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Password must be at least 8 characters long
                </p>
              </div>
              
              <div>
                <label className="block mb-1">Confirm Password:</label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={passwords.confirmPassword}
                  onChange={handleChange}
                  className="w-full border p-2 rounded"
                  required
                  autoComplete="new-password"
                />
              </div>
              
              <div className="flex gap-2 justify-end">
                {!isLoading && (
                  <button
                    type="button"
                    onClick={onCancel}
                    className="bg-gray-300 px-4 py-2 rounded"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  className={`px-4 py-2 rounded ${
                    isLoading 
                      ? 'bg-blue-300 cursor-not-allowed' 
                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                  }`}
                  disabled={isLoading}
                >
                  {isLoading ? 'Changing Password...' : 'Change Password'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default PasswordChange;
