import React, { useState, useEffect, useRef } from 'react';
import { RRule, RRuleSet, rrulestr } from 'rrule';
import RecurrenceSelector from './RecurrenceSelector';
import PasswordChange from './PasswordChange';
import QRCode from 'qrcode';
const API_URL = import.meta.env.VITE_MICFINDER_API_URL;
const defaultSignupInstructions = "";

// Function to check if JWT token is expired
const isTokenExpired = (token) => {
  if (!token) return true;

  try {
    // Get the payload part of the JWT (second part)
    const payload = token.split('.')[1];
    // Base64 decode and parse as JSON
    const decoded = JSON.parse(atob(payload));

    // Check if token has expiration claim
    if (!decoded.exp) return false;

    // Compare expiration timestamp with current time
    // exp is in seconds, Date.now() is in milliseconds
    return decoded.exp * 1000 < Date.now();
  } catch (error) {
    console.error('Error decoding JWT:', error);
    return true; // If there's an error, consider the token expired
  }
};

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
  // State for share modal
  const [showShareModal, setShowShareModal] = useState(false);
  // State for QR code data URL
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  // Ref for canvas element
  const canvasRef = useRef(null);
  // State for copy feedback
  const [copySuccess, setCopySuccess] = useState(false);

  // Check server health and load data from backend on component mount
  useEffect(() => {
    // Check if token is expired
    const authToken = localStorage.getItem('authToken');
    if (authToken && isTokenExpired(authToken)) {
      // Token is expired, log the user out
      setUser(null);
      localStorage.removeItem('currentUser');
      localStorage.removeItem('authToken');
      console.log('Session expired. Please log in again.');
    }

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
          return Math.floor(prev + (100/30)); // increment up to 100% over 30 seconds
        });
      }, 1000);

      return () => clearInterval(interval); // cleanup
    }

    // Check server health first
    fetch(`${API_URL}/health`)
      .then(response => response.json())
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
          })
          .catch(error => {
            console.error('Error loading open mics data from server:', error);
            setOpenMics([]);
          })
          .finally(() => {
            setIsServerLoading(false);
          });
      });

    // Check if user is logged in
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, [isServerLoading, serverLoadingTimeout]);

  // Handle URL parameters on component mount and when openMics change
  useEffect(() => {
    if (openMics.length > 0) {
      const urlParams = new URLSearchParams(window.location.search);
      const micId = urlParams.get('id');

      if (micId) {
        // Find the mic and view it
        const mic = openMics.find(m => m.id.toString() === micId);
        if (mic) {
          setCurrentMic(mic);
          setViewMode('view-mic');
        }
      }
    }
  }, [openMics]);

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

      // Check if token is expired
      if (isTokenExpired(authToken)) {
        setUser(null);
        localStorage.removeItem('currentUser');
        localStorage.removeItem('authToken');
        alert('Your session has expired. Please log in again.');
        setViewMode('view');
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
      // Check if token is expired before allowing edit
      const authToken = localStorage.getItem('authToken');
      if (authToken && isTokenExpired(authToken)) {
        setUser(null);
        localStorage.removeItem('currentUser');
        localStorage.removeItem('authToken');
        alert('Your session has expired. Please log in again.');
        setViewMode('view');
        return;
      }

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
      // Update URL with mic ID
      const url = new URL(window.location);
      url.searchParams.set('id', id);
      window.history.pushState({}, '', url);

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

        // Check if token is expired
        if (isTokenExpired(authToken)) {
          setUser(null);
          localStorage.removeItem('currentUser');
          localStorage.removeItem('authToken');
          alert('Your session has expired. Please log in again.');
          setViewMode('view');
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
    const days = Array.from({ length: daysInMonth }, (_, i) => ({
      day: i + 1,
      month: month,
      year: year,
      isCurrentMonth: true
    }));

    // Add days from previous month
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    const daysInPrevMonth = getDaysInMonth(prevYear, prevMonth);

    const prevMonthDays = Array.from({ length: firstDay }, (_, i) => ({
      day: daysInPrevMonth - firstDay + i + 1,
      month: prevMonth,
      year: prevYear,
      isCurrentMonth: false
    }));

    // Calculate how many days from next month we need to fill the grid
    // We want to ensure we have a complete grid of 6 weeks (42 days)
    const totalDaysShown = 42;
    const nextMonthDaysCount = totalDaysShown - (days.length + prevMonthDays.length);

    // Add days from next month
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;

    const nextMonthDays = Array.from({ length: nextMonthDaysCount }, (_, i) => ({
      day: i + 1,
      month: nextMonth,
      year: nextYear,
      isCurrentMonth: false
    }));

    return [...prevMonthDays, ...days, ...nextMonthDays];
  };

  const getWeekDays = () => {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return dayNames;
  };

  // Get events for a specific date
  const getEventsForDate = (dayOrDate) => {
    if (!dayOrDate) return [];

    // Handle different input types
    let date;
    if (typeof dayOrDate === 'number') {
      // It's a day number from old month view implementation
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      date = new Date(year, month, dayOrDate);
    } else if (dayOrDate.day !== undefined) {
      // It's an object with day, month, year from new month view implementation
      const { day, month, year } = dayOrDate;
      date = new Date(year, month, day);
    } else {
      // It's already a Date object from week view
      date = new Date(dayOrDate);
    }

    // Set time to noon to avoid timezone issues
    date.setHours(12, 0, 0, 0);

    // Filter events that occur on this day
    return openMics.filter(mic => {
      // Parse the start date more carefully to avoid timezone issues
      // If mic.startDate is in YYYY-MM-DD format, parse it as local date
      let startDate;
      if (mic.startDate.includes('T')) {
        // It's a full datetime string
        startDate = new Date(mic.startDate);
      } else {
        // It's a date-only string (YYYY-MM-DD), parse as local date
        const [year, month, day] = mic.startDate.split('-').map(num => parseInt(num, 10));
        startDate = new Date(year, month - 1, day); // month is 0-indexed
      }
      startDate.setHours(12, 0, 0, 0);

      // Check if this is the exact date (one-time event)
      if (startDate.getDate() === date.getDate() &&
        startDate.getMonth() === date.getMonth() &&
        startDate.getFullYear() === date.getFullYear() &&
        (!mic.recurrence || mic.recurrence.trim() === '')) {
          return true;
        }

      // For recurring events, make sure we're not showing events before their start date
      if (date < startDate) {
        return false;
      }

      if (mic.recurrence && mic.recurrence.trim() !== '') {
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

  // Calculate next show date for a mic
  const getNextShowDate = (mic) => {
    if (!mic.startDate) return null;

    // Parse the start date more carefully to avoid timezone issues
    let startDate;
    if (mic.startDate.includes('T')) {
      // It's a full datetime string
      startDate = new Date(mic.startDate);
    } else {
      // It's a date-only string (YYYY-MM-DD), parse as local date
      const [year, month, day] = mic.startDate.split('-').map(num => parseInt(num, 10));
      startDate = new Date(year, month - 1, day); // month is 0-indexed
    }
    startDate.setHours(12, 0, 0, 0);

    const now = new Date();
    now.setHours(0, 0, 0, 0); // Start of today

    // If it's a one-time event
    if (!mic.recurrence || mic.recurrence.trim() === '') {
      // Return the start date if it's today or in the future
      return startDate >= now ? startDate : null;
    }

    // For recurring events
    try {
      const rule = rrulestr(mic.recurrence, {
        dtstart: new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 12, 0, 0)
      });

      // Get the next occurrence after today
      const nextOccurrence = rule.after(now, true); // true means inclusive of today
      return nextOccurrence;
    } catch (error) {
      console.error('Error parsing rrule for next show:', error);
      return null;
    }
  };

  // Format date for next show display
  const formatNextShowDate = (date) => {
    if (!date) return null;

    const options = {
      weekday: 'long',
      month: '2-digit',
      day: '2-digit'
    };

    return date.toLocaleDateString('en-US', options);
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
      <div className="bg-white rounded-lg shadow p-0 w-full max-w-none overflow-hidden">
        <div className="flex justify-between items-center mb-1">
          <button onClick={goToPreviousMonth} className="p-1 bg-gray-100 rounded w-6 h-6 flex items-center justify-center">
            &lt;
          </button>
          <h3 className="text-sm sm:text-lg font-semibold">
            {getMonthName(currentDate.getMonth())} {currentDate.getFullYear()}
          </h3>
          <button onClick={goToNextMonth} className="p-1 bg-gray-100 rounded w-6 h-6 flex items-center justify-center">
            &gt;
          </button>
        </div>

        <div className="grid grid-cols-7 gap-0 sm:gap-1">
          {dayNames.map((dayName, index) => (
            <div key={index} className="text-center font-medium p-1 text-xs sm:text-sm">
              {dayName}
            </div>
          ))}

          {days.map((dayObj, index) => {
            const events = getEventsForDate(dayObj);
            const today = new Date();
            const isToday =
              dayObj.day === today.getDate() &&
              dayObj.month === today.getMonth() &&
              dayObj.year === today.getFullYear();

            return (
              <div
                key={index}
                className={`border rounded min-h-14 sm:min-h-20 p-0 sm:p-1 ${
                  dayObj.isCurrentMonth ? 'bg-white' : 'bg-gray-200'
                } ${
                  isToday ? 'border-blue-500 border-2' : ''
                }`}
              >
                <div className={`text-right text-xs ${dayObj.isCurrentMonth ? 'text-gray-800' : 'text-gray-400'}`}>
                  {dayObj.day}
                </div>
                <div className="overflow-y-auto max-h-48 sm:max-h-24">
                  {sortEventsByTime(events).map(event => (
                    <div
                      key={event.id}
                      className="text-xs p-0.5 my-0.5 bg-blue-100 rounded cursor-pointer"
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

  // Render the week view
  const renderWeekView = () => {
    const weekDates = getWeekDates();
    const dayNames = getWeekDays();

    return (
      <div className="bg-white rounded-lg shadow p-0 w-full max-w-none">
        <div className="flex justify-between items-center mb-1">
          <button onClick={goToPreviousWeek} className="p-1 bg-gray-100 rounded w-6 h-6 flex items-center justify-center">
            &lt;
          </button>
          <h3 className="text-sm sm:text-lg font-semibold">
            Week of {weekDates[0].toLocaleDateString()} - {weekDates[6].toLocaleDateString()}
          </h3>
          <button onClick={goToNextWeek} className="p-1 bg-gray-100 rounded w-6 h-6 flex items-center justify-center">
            &gt;
          </button>
        </div>

        <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
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
                className={`border rounded min-h-20 sm:min-h-36 p-0.5 sm:p-2 ${
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
                      className="text-xs p-0.5 my-0.5 bg-blue-100 rounded cursor-pointer"
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

  // Generate QR code with custom border
  const generateQRCode = async (url, borderImagePath = null) => {
    try {
      // Generate QR code data URL first
      const qrDataUrl = await QRCode.toDataURL(url, {
        width: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#00000000'
        }
      });

      if (borderImagePath) {
        // If we have a border image, use canvas to combine them
        const canvas = canvasRef.current;
        if (!canvas) {
          // Fallback to just QR code if canvas not available
          setQrCodeDataUrl(qrDataUrl);
          return;
        }

        const ctx = canvas.getContext('2d');

        // Load border image
        const borderImage = new Image();
        borderImage.onload = () => {
          // Create QR code image
          const qrImage = new Image();
          qrImage.onload = () => {
            // Set canvas size to border image size
            canvas.width = borderImage.width;
            canvas.height = borderImage.height;

            // Draw border image
            ctx.drawImage(borderImage, 0, 0);

            // Calculate position to center QR code
            const fgScale = 0.75;
            const qrSize = Math.min(borderImage.width * fgScale, borderImage.height * fgScale);
            const x = (borderImage.width - qrSize) / 2;
            const y = (borderImage.height - qrSize) / 2;

            // Draw QR code centered on border
            ctx.drawImage(qrImage, x, y, qrSize, qrSize);

            // Convert canvas to data URL
            setQrCodeDataUrl(canvas.toDataURL());
          };
          qrImage.src = qrDataUrl;
        };
        borderImage.onerror = () => {
          // If border image fails to load, just use QR code
          setQrCodeDataUrl(qrDataUrl);
        };
        borderImage.src = borderImagePath;
      } else {
        // No border, just use the QR code directly
        setQrCodeDataUrl(qrDataUrl);
      }
    } catch (error) {
      console.error('Error generating QR code:', error);
      // Fallback to simple QR code without border
      try {
        const fallbackQrDataUrl = await QRCode.toDataURL(url, {
          width: 200,
          margin: 2
        });
        setQrCodeDataUrl(fallbackQrDataUrl);
      } catch (fallbackError) {
        console.error('Fallback QR code generation also failed:', fallbackError);
      }
    }
  };

  // Handle share button click
  const handleShare = () => {
    const currentUrl = window.location.href;
    setShowShareModal(true);

    // Generate QR code with custom border (you can replace with your border image path)
    // For now, using null - replace with your border image path like '/micfinder-border.png'
    generateQRCode(currentUrl, "/micfinder-border.jpg");
  };

  // Copy URL to clipboard
  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000); // Reset after 2 seconds
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000); // Reset after 2 seconds
    }
  };

  // Download QR code
  const downloadQRCode = () => {
    if (!qrCodeDataUrl) return;
    
    const link = document.createElement('a');
    // Use different filename based on whether we're viewing a specific mic or the main calendar
    const filename = viewMode === 'view-mic' && currentMic.name 
      ? `${currentMic.name}-qr-code.png`
      : 'micfinder-qr-code.png';
    link.download = filename;
    link.href = qrCodeDataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Server loading screen
  if (isServerLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-indigo-50 to-purple-50 p-4">
        {serverLoadingTimeout && (
          <>
            <img
              src="/computer-brewing-coffee.jpg"
              alt="Computer brewing coffee"
              className="w-64 h-64 object-contain mb-6"/>
            <h2 className="text-xl font-semibold text-center text-gray-700 mb-2">
              Our computer was asleep! He's waking up but this can take a minute ({loadingPercent}%)
            </h2>
          </>
        )}
        <div className="mt-4">
          <div className="w-16 h-16 border-t-4 border-blue-500 border-solid rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="max-w-full mx-auto p-2 sm:p-4">
      <header className="mb-2">
        <h1 className="text-xl font-bold mb-1">Boise Standup Comedy Open Mics</h1>
        <p className="text-gray-600 text-sm">A community-maintained list of open mics</p>
      </header>

      {/* View toggle buttons */}
      {viewMode === 'view' && (!isServerLoading) &&
      <div className="flex mb-3 gap-1 sm:gap-2 justify-between items-center">
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
                onClick={() => {
                  // Clear URL parameter when closing
                  const url = new URL(window.location);
                  url.searchParams.delete('id');
                  window.history.pushState({}, '', url);
                  setViewMode('view');
                }}
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

          {/* Next Show Box */}
          {(() => {
            const nextShowDate = getNextShowDate(currentMic);
            const formattedDate = formatNextShowDate(nextShowDate);

            if (formattedDate) {
              return (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <h3 className="text-lg font-semibold text-blue-700 mb-2">Next Show</h3>
                  <p className="text-blue-600 font-medium">{formattedDate}</p>
                </div>
              );
            }
            return null;
          })()}

          <h3 className="text-lg font-semibold text-gray-700 mb-2">Sign-up Instructions</h3>
          <div className="bg-gray-50 p-4 rounded border border-gray-200">
            <p>{currentMic.signupInstructions || defaultSignupInstructions}</p>
          </div>

          {/* Share Button */}
          <div className="flex justify-center mt-6">
            <button
              onClick={handleShare}
              className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
              </svg>
              Share
            </button>
          </div>
        </div>
      )}

      {/* Main content area */}
      {viewMode === 'view' && (!isServerLoading) && (
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

      {viewMode === 'view' && displayMode === 'calendar' && (!isServerLoading) && (
        <div className="items-center">
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
        <button
          onClick={() => {
            // Clear any mic-specific URL parameters for main calendar share
            const url = new URL(window.location);
            url.searchParams.delete('id');
            const currentUrl = url.toString();
            setShowShareModal(true);
            generateQRCode(currentUrl, "/micfinder-border.jpg");
          }}
          className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm flex items-center gap-1"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
          </svg>
          Share
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

    {/* Share Modal */}
    {showShareModal && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Share Open Mic</h3>
            <button
              onClick={() => setShowShareModal(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              ×
            </button>
          </div>

          {/* URL Section */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Share URL:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={window.location.href}
                readOnly
                className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm bg-gray-50"
              />
              <button
                onClick={() => copyToClipboard(window.location.href)}
                className={`px-3 py-2 rounded text-sm transition-colors ${
                  copySuccess
                    ? 'bg-green-500 text-white'
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
              >
                {copySuccess ? '✓ Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          {/* QR Code Section */}
          <div className="text-center">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              QR Code:
            </label>
            {qrCodeDataUrl && (
              <div className="mb-4">
                <img
                  src={qrCodeDataUrl}
                  alt="QR Code"
                  className="mx-auto border border-gray-300 rounded"
                />
              </div>
            )}
            <button
              onClick={downloadQRCode}
              disabled={!qrCodeDataUrl}
              className="bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white px-4 py-2 rounded text-sm"
            >
              Download QR Code
            </button>
          </div>

          {/* Hidden canvas for QR code generation */}
          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>
      </div>
    )}

      <div className="bottom-0 w-full flex justify-end mt-4">
        {!user ? (
          <form
            onSubmit={handleLogin}
            className="flex flex-wrap gap-1 items-center"
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
          <div className="flex flex-wrap gap-2 items-center text-sm text-gray-600">
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
    </>
  );
};

export default MicFinder;
