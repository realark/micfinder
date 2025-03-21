import React, { useState, useEffect } from 'react';
import { RRule, RRuleSet, rrulestr } from 'rrule';
import RecurrenceSelector from './RecurrenceSelector';
import PasswordChange from './PasswordChange';
const API_URL = import.meta.env.VITE_MICFINDER_API_URL;
const defaultSignupInstructions = "";

const MicFinder = () => {
  // State for all open mics
  const [openMics, setOpenMics] = useState([]);
  // State for the form
  const [currentMic, setCurrentMic] = useState({
    id: '',
    name: '',
    contactInfo: '',
    location: '',
    recurrence: '',
    signupInstructions: '',
    startDate: '',
    showTime: ''
  });
  // State for user
  const [user, setUser] = useState(null);
  // State for login form
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  // State for view mode
  const [viewMode, setViewMode] = useState('view'); // 'view', 'add', 'edit'
  // State for calendar view type
  const [calendarView, setCalendarView] = useState('month'); // 'month', 'week'
  // State for current calendar date
  const [currentDate, setCurrentDate] = useState(new Date());
  // State for display mode (calendar or list)
  const [displayMode, setDisplayMode] = useState('calendar'); // 'calendar', 'list'
  // State for displaying login status
  const [loginError, setLoginError] = useState('');
  // State for password reset
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  // State for password reset required
  const [passwordResetRequired, setPasswordResetRequired] = useState(false);
  // State for server loading status
  const [isServerLoading, setIsServerLoading] = useState(true);
  // State for server loading timeout
  const [serverLoadingTimeout, setServerLoadingTimeout] = useState(false);
  // percentage counter for wakeup screen
  const [loadingPercent, setLoadingPercent] = useState(0);

  // Check server health and load data from backend on component mount
  useEffect(() => {
    // Set a timeout to show the loading message if the server takes too long
    const timeoutId = setTimeout(() => {
      setServerLoadingTimeout(true);
    }, 1500); // ms to wait before showing sleepy computer


    if (isServerLoading && serverLoadingTimeout) {
      const interval = setInterval(() => {
        setLoadingPercent(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            return 100;
          }
          return Math.floor(prev + (100/60)); // increment by ~1.67% every second
        });
      }, 1000);

      return () => clearInterval(interval); // cleanup
    }

    // Check server health first
    fetch(`${API_URL}/health`)
      .finally(() => {
        // Clear the timeout if the health check completes (success or error)
        clearTimeout(timeoutId);

        // Now fetch the actual data
        fetch(`${API_URL}/mics`)
          .then(response => response.json())
          .then(data => {
            // Make sure we're handling the data structure correctly
            if (data.mics && Array.isArray(data.mics)) {
              setOpenMics(data.mics);
            } else {
              console.error('Unexpected data format from server:', data);
              setOpenMics([]);
            }
            setIsServerLoading(false);
          })
          .catch(error => {
            console.error('Error loading open mics data from server:', error);
            setOpenMics([]);
            setIsServerLoading(false);
          });
      });

    // Check if user is logged in
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, [isServerLoading, serverLoadingTimeout]);

  // Login handler
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError(''); // Clear any previous errors

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: loginForm.username,
          password: loginForm.password
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Login failed');
      }

      const data = await response.json();
      localStorage.setItem('authToken', data.token);
      const newUser = {
        id: data.userId,
        username: loginForm.username
      };

      // Check if password reset is required
      if (data.passwordResetRequired) {
        setPasswordResetRequired(true);
        setShowPasswordChange(true);
      }

      setUser(newUser);
      localStorage.setItem('currentUser', JSON.stringify(newUser));
      setLoginForm({ username: '', password: '' });
    } catch (error) {
      console.error('Login error:', error);
      setLoginError(error.message);
    }
  };

  // Logout handler
  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('currentUser');
    setViewMode('view');
  };

  // Handle form input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setCurrentMic(prev => ({ ...prev, [name]: value }));
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const authToken = localStorage.getItem('authToken');
      if (!authToken) {
        alert('You must be logged in to perform this action');
        return;
      }

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      };

      // Filter out empty string fields
      const micDataToSend = Object.fromEntries(
        Object.entries(currentMic).filter(([_, value]) => value !== '')
      );

      if (viewMode === 'add') {
        // Add new open mic via API
        const response = await fetch(`${API_URL}/mics`, {
          method: 'POST',
          headers,
          body: JSON.stringify(micDataToSend)
        });

        if (!response.ok) {
          throw new Error('Failed to create open mic');
        }

        const result = await response.json();

        // Update local state with the new mic from the server
        setOpenMics(prev => [...prev, result.mic]);
      } else if (viewMode === 'edit') {
        // Update existing open mic via API
        const response = await fetch(`${API_URL}/mics/${currentMic.id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(micDataToSend)
        });

        if (!response.ok) {
          throw new Error('Failed to update open mic');
        }

        const result = await response.json();

        // Update local state with the updated mic from the server
        setOpenMics(prev => prev.map(mic =>
          mic.id === result.mic.id ? result.mic : mic
        ));
      }

      // Reset form and return to view mode
      setCurrentMic({
        id: '',
        name: '',
        contactInfo: '',
        location: '',
        recurrence: '',
        signupInstructions: '',
        startDate: '',
        showTime: ''
      });
      setViewMode('view');

      // Refresh the list from the server
      fetchMics();
    } catch (error) {
      console.error('Error saving open mic:', error);
      alert(`Error: ${error.message}`);
    }
  };

  // Function to fetch mics from the API
  const fetchMics = () => {
    fetch(`${API_URL}/mics`)
      .then(response => response.json())
      .then(data => {
        // Make sure we're handling the data structure correctly
        if (data.mics && Array.isArray(data.mics)) {
          setOpenMics(data.mics);
        } else if (Array.isArray(data)) {
          setOpenMics(data);
        } else {
          console.error('Unexpected data format from server:', data);
          setOpenMics([]);
        }
      })
      .catch(error => {
        console.error('Error loading open mics data from server:', error);
        setOpenMics([]);
      });
  };

  const editOpenMic = async (id) => {
    try {
      // Fetch the latest version of the mic from the server
      const response = await fetch(`${API_URL}/mics/${id}`);

      if (!response.ok) {
        throw new Error('Failed to fetch open mic details');
      }

      const result = await response.json();
      setCurrentMic(result.mic);
      setViewMode('edit');
    } catch (error) {
      console.error('Error fetching open mic details:', error);
      alert(`Error: ${error.message}`);
    }
  };

  const viewOpenMic = async (id) => {
    try {
      // Fetch the latest version of the mic from the server
      const response = await fetch(`${API_URL}/mics/${id}`);

      if (!response.ok) {
        throw new Error('Failed to fetch open mic details');
      }

      const result = await response.json();
      setCurrentMic(result.mic);
      setViewMode('view-mic');
    } catch (error) {
      console.error('Error fetching open mic details:', error);
      alert(`Error: ${error.message}`);
    }
  };

  // Delete an open mic
  const deleteOpenMic = async (id) => {
    if (window.confirm('Are you sure you want to delete this open mic?')) {
      try {
        const authToken = localStorage.getItem('authToken');
        if (!authToken) {
          alert('You must be logged in to perform this action');
          return;
        }

        const response = await fetch(`${API_URL}/mics/${id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to delete open mic');
        }

        // Update local state
        setOpenMics(prev => prev.filter(mic => mic.id !== id));

        // Refresh the list from the server
        fetchMics();
      } catch (error) {
        console.error('Error deleting open mic:', error);
        alert(`Error: ${error.message}`);
      }
    }
  };

  // Calendar helper functions
  const getDaysInMonth = (year, month) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year, month) => {
    return new Date(year, month, 1).getDay();
  };

  const getMonthName = (month) => {
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    return months[month];
  };

  const getDaysArray = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);

    // Create array for the days in month
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    // Add empty cells for days before the first day of month
    const paddingDays = Array.from({ length: firstDay }, () => null);

    return [...paddingDays, ...days];
  };

  const getWeekDays = () => {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return dayNames;
  };

  // Get events for a specific date
  const getEventsForDate = (dayOrDate) => {
    if (!dayOrDate) return [];

    // Handle both day number (from month view) and Date object (from week view)
    let date;
    if (typeof dayOrDate === 'number') {
      // It's a day number from month view
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      date = new Date(year, month, dayOrDate);
    } else {
      // It's already a Date object from week view
      date = new Date(dayOrDate);
    }

    // Set time to noon to avoid timezone issues
    date.setHours(12, 0, 0, 0);

    // Filter events that occur on this day
    return openMics.filter(mic => {
      // Parse the start date
      const startDate = new Date(mic.startDate);
      startDate.setHours(12, 0, 0, 0);

      // Make sure we're not showing events before their start date
      if (date < startDate) {
        return false;
      }

      // Check if this is the exact date (one-time event)
      if (startDate.getDate() === date.getDate() &&
        startDate.getMonth() === date.getMonth() &&
        startDate.getFullYear() === date.getFullYear() &&
        (!mic.recurrence || mic.recurrence.trim() === '')) {
          return true;
        }

      if (mic.recurrence) {
        try {
          // Parse the rrule string
          const rule = rrulestr(mic.recurrence, {
            dtstart: new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 12, 0, 0)
          });

          // Check if this date is in the recurrence set
          const occurrences = rule.between(
            new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0),
            new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59),
            true
          );

          return occurrences.length > 0;
        } catch (error) {
          console.error('Error parsing rrule:', error);
        }
      }

      return false;
    });
  };

  // Navigation functions
  const goToPreviousMonth = () => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() - 1);
      return newDate;
    });
  };

  const goToNextMonth = () => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + 1);
      return newDate;
    });
  };

  const goToPreviousWeek = () => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setDate(prev.getDate() - 7);
      return newDate;
    });
  };

  const goToNextWeek = () => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setDate(prev.getDate() + 7);
      return newDate;
    });
  };

  // Format 24-hour time string to 12-hour format
  const formatTo12Hour = (timeString) => {
    if (!timeString) return '';

    // Parse the time string (assuming format like "18:00")
    const [hours, minutes] = timeString.split(':').map(num => parseInt(num, 10));

    // Convert to 12-hour format
    const period = hours >= 12 ? 'pm' : 'am';
    const hours12 = hours % 12 || 12; // Convert 0 to 12 for midnight

    // Format the result
    return `${hours12}${minutes ? `:${minutes.toString().padStart(2, '0')}` : ''}${period}`;
  };

  // Format RRule to human-readable text
  const formatRecurrence = (rruleString) => {
    if (!rruleString) return 'One-time event';

    try {
      const rule = rrulestr(rruleString);
      const options = rule.options;

      if (options.freq === RRule.WEEKLY) {
        const days = options.byweekday ? options.byweekday.map(day => {
          // RRule uses 0=MO, 1=TU, etc. but we need 0=SU, 1=MO, etc.
          // Convert RRule day number to our day number
          const dayNum = (day === 6) ? 0 : day + 1;
          const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
          return dayNames[dayNum];
        }).join(', ') : '';

        const interval = options.interval || 1;
        if (interval === 1) {
          return `Weekly on ${days}`;
        } else {
          return `Every ${interval} weeks on ${days}`;
        }
      } else if (options.freq === RRule.MONTHLY) {
        const interval = options.interval || 1;
        if (interval === 1) {
          return 'Monthly';
        } else {
          return `Every ${interval} months`;
        }
      }

      return rruleString;
    } catch (error) {
      console.error('Error parsing rrule:', error);
      return rruleString;
    }
  };

  // Sort events by showTime
  const sortEventsByTime = (events) => {
    return [...events].sort((a, b) => (a.showTime || '').localeCompare(b.showTime || ''));
  };

  // Week view helper functions
  const getWeekDates = () => {
    const currentDay = currentDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const firstDayOfWeek = new Date(currentDate);
    firstDayOfWeek.setDate(currentDate.getDate() - currentDay);

    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(firstDayOfWeek);
      date.setDate(firstDayOfWeek.getDate() + i);
      return date;
    });
  };

  // Render the month view
  const renderMonthView = () => {
    const days = getDaysArray();
    const dayNames = getWeekDays();

    return (
      <div className="bg-white rounded-lg shadow p-2 sm:p-4 w-full">
        <div className="flex justify-between items-center mb-2 sm:mb-4">
          <button onClick={goToPreviousMonth} className="p-1 sm:p-2 bg-gray-100 rounded w-8 h-8 flex items-center justify-center">
            &lt;
          </button>
          <h3 className="text-base sm:text-lg font-semibold">
            {getMonthName(currentDate.getMonth())} {currentDate.getFullYear()}
          </h3>
          <button onClick={goToNextMonth} className="p-1 sm:p-2 bg-gray-100 rounded w-8 h-8 flex items-center justify-center">
            &gt;
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {dayNames.map((dayName, index) => (
            <div key={index} className="text-center font-medium p-1 text-xs sm:text-sm">
              {dayName}
            </div>
          ))}

          {days.map((day, index) => {
            const events = day ? getEventsForDate(day) : [];
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth();
            const isToday =
              day === new Date().getDate() &&
                month === new Date().getMonth() &&
                year === new Date().getFullYear();
            return (
              <div
                key={index}
                className={`border rounded min-h-20 p-1 ${day ? 'bg-white' : 'bg-gray-100'} ${
                  isToday ? 'border-blue-500 border-2' : ''
                }`}
              >
                {day && (
                  <>
                    <div className="text-right text-xs">{day}</div>
                    <div className="overflow-y-auto max-h-48 sm:max-h-24">
                      {sortEventsByTime(events).map(event => (
                        <div
                          key={event.id}
                          className="text-xs p-1 my-1 bg-blue-100 rounded cursor-pointer"
                          onClick={() => viewOpenMic(event.id)}
                        >
                          <div className="line-clamp-2">{event.name} {formatTo12Hour(event.showTime)}</div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Render the week view
  const renderWeekView = () => {
    const weekDates = getWeekDates();
    const dayNames = getWeekDays();

    return (
      <div className="bg-white rounded-lg shadow p-2 sm:p-4 w-full">
        <div className="flex justify-between items-center mb-4">
          <button onClick={goToPreviousWeek} className="p-1 sm:p-2 bg-gray-100 rounded">
            &lt;
          </button>
          <h3 className="text-lg font-semibold">
            Week of {weekDates[0].toLocaleDateString()} - {weekDates[6].toLocaleDateString()}
          </h3>
          <button onClick={goToNextWeek} className="p-2 bg-gray-100 rounded">
            &gt;
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {dayNames.map((dayName, index) => (
            <div key={index} className="text-center font-medium p-1 text-xs sm:text-sm">
              {dayName}
            </div>
          ))}

          {weekDates.map((date, index) => {
            const day = date.getDate();
            const month = date.getMonth();
            const year = date.getFullYear();
            const isCurrentMonth = month === currentDate.getMonth();
            const isToday =
              day === new Date().getDate() &&
                month === new Date().getMonth() &&
                year === new Date().getFullYear();

            // Get events for this date
            const events = getEventsForDate(date);

            return (
              <div
                key={index}
                className={`border rounded min-h-28 sm:min-h-36 p-1 sm:p-2 ${
                  isCurrentMonth ? 'bg-white' : 'bg-gray-50'
                } ${
                  isToday ? 'border-blue-500 border-2' : ''
                }`}
              >
                <div className={`text-right text-xs ${isCurrentMonth ? 'font-normal' : 'text-gray-400'}`}>
                  {day}
                </div>
                <div className="overflow-y-auto max-h-48 sm:max-h-24">
                  {sortEventsByTime(events).map(event => (
                    <div
                      key={event.id}
                      className="text-xs p-1 my-1 bg-blue-100 rounded cursor-pointer"
                      onClick={() => viewOpenMic(event.id)}
                    >
                      <div className="line-clamp-2">{event.name} {formatTo12Hour(event.showTime)}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Handle password change completion
  const handlePasswordChanged = () => {
    setShowPasswordChange(false);
    setPasswordResetRequired(false);
  };

  // Handle password change cancellation
  const handlePasswordChangeCancel = () => {
    // Only allow cancellation if password reset is not required
    if (!passwordResetRequired) {
      setShowPasswordChange(false);
    }
  };

  // Server loading screen
  if (isServerLoading && serverLoadingTimeout) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-indigo-50 to-purple-50 p-4">
        <img
          src="/computer-brewing-coffee.jpg"
          alt="Computer brewing coffee"
          className="w-64 h-64 object-contain mb-6"
        />
        <h2 className="text-xl font-semibold text-center text-gray-700 mb-2">
          Our computer was asleep! He's waking up but this can take a minute ({loadingPercent}%)
        </h2>
        <div className="mt-4">
          <div className="w-16 h-16 border-t-4 border-blue-500 border-solid rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="max-w-full mx-auto p-2 sm:p-4">
  <div className="absolute top-0 right-0">
    {!user ? (
      <form
        onSubmit={handleLogin}
        className="flex gap-1 items-center"
      >
        <input
          type="text"
          placeholder="Username"
          value={loginForm.username}
          onChange={(e) => setLoginForm(prev => ({ ...prev, username: e.target.value }))}
          className="border p-1 rounded text-sm w-24"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={loginForm.password}
          onChange={(e) => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
          className="border p-1 rounded text-sm w-24"
          required
        />
        <button type="submit" className="bg-gray-200 text-gray-700 px-2 py-1 rounded text-sm hover:bg-gray-300">
          Login
        </button>
        {loginError && (
          <span className="text-red-500 text-sm ml-2">{loginError}</span>
        )}
      </form>
    ) : (
      <div className="flex gap-2 items-center text-sm text-gray-600">
        <span>{user.username}</span>
        <button
          onClick={() => setShowPasswordChange(true)}
          className="bg-gray-200 text-gray-700 px-2 py-1 rounded text-sm hover:bg-gray-300"
        >
          Change Password
        </button>
        <button onClick={handleLogout} className="bg-gray-200 text-gray-700 px-2 py-1 rounded text-sm hover:bg-gray-300">Logout</button>
      </div>
    )}
  </div>

      <header className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Boise Standup Comedy Open Mics</h1>
        <p className="text-gray-600">A community-maintained list of open mics</p>

      </header>

      {/* View toggle buttons */}
      {viewMode === 'view' &&
      <div className="flex mb-3 gap-1 sm:gap-2">
        <div className="bg-gray-100 p-1 rounded-lg inline-flex">
          <button
            onClick={() => setDisplayMode('calendar')}
            className={`px-2 sm:px-3 py-1 rounded text-sm ${displayMode === 'calendar' ? 'bg-white shadow' : ''}`}
          >
            Calendar
          </button>
          <button
            onClick={() => setDisplayMode('list')}
            className={`px-2 sm:px-3 py-1 rounded text-sm ${displayMode === 'list' ? 'bg-white shadow' : ''}`}
          >
            List
          </button>
        </div>
      </div>}

      {/* Form for adding/editing open mics */}
      {(viewMode === 'add' || viewMode === 'edit') && (
        <div className="bg-gray-100 p-4 rounded-lg mb-6">
          <h2 className="text-xl font-semibold mb-4">
            {viewMode === 'add' ? 'Add New Open Mic' : 'Edit Open Mic'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block mb-1">Name:</label>
              <input
                type="text"
                name="name"
                value={currentMic.name}
                onChange={handleChange}
                className="w-full border p-2 rounded"
                required
              />
            </div>

            <div>
              <label className="block mb-1">Contact Info: <span className="text-gray-500 text-sm">(optional)</span></label>
              <input
                type="text"
                name="contactInfo"
                value={currentMic.contactInfo}
                onChange={handleChange}
                className="w-full border p-2 rounded"
              />
            </div>

            <div>
              <label className="block mb-1">Location: <span className="text-red-500">*</span></label>
              <input
                type="text"
                name="location"
                value={currentMic.location}
                onChange={handleChange}
                className="w-full border p-2 rounded"
                required
              />
            </div>

            <div>
              <label className="block mb-1">Start Date: <span className="text-red-500">*</span></label>
              <input
                type="date"
                name="startDate"
                value={currentMic.startDate}
                onChange={handleChange}
                className="w-full border p-2 rounded"
                required
              />
            </div>

            <div>
              <label className="block mb-1">Show Time: <span className="text-red-500">*</span></label>
              <input
                type="time"
                name="showTime"
                value={currentMic.showTime}
                onChange={handleChange}
                className="w-full border p-2 rounded"
                required
              />
            </div>

            <div>
              <label className="block mb-1">Recurrence: <span className="text-gray-500 text-sm">(optional)</span></label>
              <RecurrenceSelector
                value={currentMic.recurrence}
                onChange={(value) => setCurrentMic(prev => ({ ...prev, recurrence: value }))}
              />
            </div>

            <div>
              <label className="block mb-1">Sign-up Instructions: <span className="text-gray-500 text-sm">(optional)</span></label>
              <textarea
                name="signupInstructions"
                value={currentMic.signupInstructions}
                onChange={handleChange}
                className="w-full border p-2 rounded"
                rows="3"
              ></textarea>
            </div>

            <div className="flex gap-2">
              <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">
                {viewMode === 'add' ? 'Add Open Mic' : 'Save Changes'}
              </button>
              <button
                type="button"
                onClick={() => setViewMode('view')}
                className="bg-gray-300 px-4 py-2 rounded"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
      {(viewMode === 'view-mic') && (
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 mb-6">
          <div className="flex justify-between items-start mb-6">
            <h2 className="text-2xl font-bold text-blue-600">
              {currentMic.name}
            </h2>
            <div className="flex gap-2">
              {user && (
                <>
                  <button
                    onClick={() => editOpenMic(currentMic.id)}
                    className="text-blue-500 hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteOpenMic(currentMic.id)}
                    className="text-red-500 hover:underline"
                  >
                    Delete
                  </button>
                </>
              )}
              <button
                onClick={() => setViewMode('view')}
                className="text-gray-500 hover:text-gray-700 ml-2"
              >
                × Close
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-1 gap-4 mb-6">
            <div className="flex items-start">
              <span className="text-gray-600 font-medium w-28">Show Time:</span>
              <span>{currentMic.recurrence && formatRecurrence(currentMic.recurrence) + ","} {formatTo12Hour(currentMic.showTime)}</span>
            </div>
            <div className="flex items-start">
              <span className="text-gray-600 font-medium w-28">Location:</span>
              <span>{currentMic.location}</span>
            </div>
            <div className="flex items-start">
              <span className="text-gray-600 font-medium w-28">Contact:</span>
              <span>{currentMic.contactInfo}</span>
            </div>
          </div>

          <h3 className="text-lg font-semibold text-gray-700 mb-2">Sign-up Instructions</h3>
          <div className="bg-gray-50 p-4 rounded border border-gray-200">
            <p>{currentMic.signupInstructions || defaultSignupInstructions}</p>
          </div>
        </div>
      )}

      {/* Main content area */}
      {viewMode === 'view' && (
        <>
          {displayMode === 'calendar' && (
            <div>
              {calendarView === 'month' ? renderMonthView() : renderWeekView()}
            </div>
          )}

          {displayMode === 'list' && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Available Open Mics</h2>

              <div className="mt-4 flex justify-between items-center">
                {user && viewMode === 'view' && (
                  <button
                    onClick={() => {
                      setCurrentMic({
                        id: '',
                        name: '',
                        contactInfo: '',
                        location: '',
                        recurrence: '',
                        signupInstructions: '',
                        startDate: new Date().toISOString().split('T')[0],
                        showTime: ''
                      });
                      setViewMode('add');
                    }}
                    className="bg-green-500 text-white px-4 py-2 rounded"
                  >
                    Add New Open Mic
                  </button>
                )}
              </div>

              {openMics.length === 0 ? (
                <p>No open mics available yet. Be the first to add one!</p>
              ) : (
                openMics.map(mic => (
                  <div key={mic.id} className="border rounded-lg p-4 shadow-sm">
                    <div className="flex justify-between items-start">
                      <h3 className="text-lg font-semibold">{mic.name}</h3>
                      {user && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => editOpenMic(mic.id)}
                            className="text-blue-500 hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteOpenMic(mic.id)}
                            className="text-red-500 hover:underline"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-1 gap-2 mt-2">
                      <div className="flex items-start">
                        <span className="text-gray-600 font-medium w-28">Show Time:</span>
                        <span>{mic.recurrence && formatRecurrence(mic.recurrence) + ","} {formatTo12Hour(mic.showTime)}</span>
                      </div>
                      <div className="flex items-start">
                        <span className="text-gray-600 font-medium w-28">Location:</span>
                        <span>{mic.location}</span>
                      </div>
                      <div className="flex items-start">
                        <span className="text-gray-600 font-medium w-28">Contact:</span>
                        <span>{mic.contactInfo}</span>
                      </div>
                      <div className="flex items-start">
                        <span className="text-gray-600 font-medium w-28">Start Date:</span>
                        <span>{mic.startDate}</span>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-700 mb-2">Sign-up Instructions</h3>
                      <div className="bg-gray-50 p-4 rounded border border-gray-200">
                        <p>{mic.signupInstructions || defaultSignupInstructions}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}

        {viewMode === 'view' && displayMode === 'calendar' && (
          <div className="bg-gray-100 p-1 rounded-lg inline-flex mt-2">
            <button
              onClick={() => setCalendarView('month')}
              className={`px-2 sm:px-3 py-1 rounded text-sm ${calendarView === 'month' ? 'bg-white shadow' : ''}`}
            >
              Month
            </button>
            <button
              onClick={() => setCalendarView('week')}
              className={`px-2 sm:px-3 py-1 rounded text-sm ${calendarView === 'week' ? 'bg-white shadow' : ''}`}
            >
              Week
            </button>
          </div>
        )}
    </div>
    {/* Password Change Modal */}
    {showPasswordChange && user && (
      <PasswordChange
        onPasswordChanged={handlePasswordChanged}
        onCancel={handlePasswordChangeCancel}
        token={localStorage.getItem('authToken')}
      />
    )}
    </>
  );
};

export default MicFinder;
