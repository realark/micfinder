import React, { useState, useEffect } from 'react';

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
    startDate: ''
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

  // Load data from localStorage on component mount
  useEffect(() => {
    const savedMics = localStorage.getItem('openMics.json');
    if (savedMics) {
      setOpenMics(JSON.parse(savedMics));
    } else {
      // Sample data
      const sampleData = [
        {
          id: '1',
          name: "Joe's Comedy Club Open Mic",
          contactInfo: "joe@joescomedy.com, (555) 123-4567",
          location: "123 Laugh St, Comedy City",
          recurrence: "Weekly on Tuesdays, 8PM",
          signupInstructions: "Email joe@joescomedy.com or sign up at the venue 30 minutes before show",
          startDate: "2025-03-04" // Today's date
        },
        {
          id: '2',
          name: "Poetry Café Open Reading",
          contactInfo: "poetrycafe@email.com, @poetrycafe",
          location: "456 Verse Ave, Rhyme Town",
          recurrence: "First Sunday of every month, 7PM",
          signupInstructions: "DM on Instagram @poetrycafe or sign up in person",
          startDate: "2025-03-02" // Previous Sunday
        },
        {
          id: '3',
          name: "Jazz Lounge Musicians Night",
          contactInfo: "jazzlounge@email.com, (555) 987-6543",
          location: "789 Blue Note Ave, Jazz City",
          recurrence: "Every Thursday, 9PM",
          signupInstructions: "Sign up at the bar before 8PM",
          startDate: "2025-03-06" // This coming Thursday
        }
      ];
      setOpenMics(sampleData);
      localStorage.setItem('openMics', JSON.stringify(sampleData));
    }

    // Check if user is logged in
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  // Save to localStorage whenever openMics changes
  useEffect(() => {
    localStorage.setItem('openMics', JSON.stringify(openMics));
  }, [openMics]);

  // Login handler
  const handleLogin = (e) => {
    e.preventDefault();
    // Simple login (in a real app, this would use authentication)
    const newUser = { username: loginForm.username };
    setUser(newUser);
    localStorage.setItem('currentUser', JSON.stringify(newUser));
    setLoginForm({ username: '', password: '' });
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
  const handleSubmit = (e) => {
    e.preventDefault();

    if (viewMode === 'add') {
      // Add new open mic
      const newMic = {
        ...currentMic,
        id: Date.now().toString()
      };
      setOpenMics(prev => [...prev, newMic]);
    } else if (viewMode === 'edit') {
      // Update existing open mic
      setOpenMics(prev => prev.map(mic =>
        mic.id === currentMic.id ? currentMic : mic
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
      startDate: ''
    });
    setViewMode('view');
  };

  // Edit an open mic
  const editOpenMic = (id) => {
    const micToEdit = openMics.find(mic => mic.id === id);
    setCurrentMic(micToEdit);
    setViewMode('edit');
  };

  // Delete an open mic
  const deleteOpenMic = (id) => {
    if (window.confirm('Are you sure you want to delete this open mic?')) {
      setOpenMics(prev => prev.filter(mic => mic.id !== id));
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
  const getEventsForDate = (day) => {
    if (!day) return [];

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const date = new Date(year, month, day);
    const daysInMonth = getDaysInMonth(year, month); // Add this line

    // Filter events that occur on this day
    return openMics.filter(mic => {
      // Parse the start date
      const startDate = new Date(mic.startDate);

      // Check if this is the exact date
      if (startDate.getDate() === day &&
          startDate.getMonth() === month &&
          startDate.getFullYear() === year) {
        return true;
      }

      // Check recurrence patterns
      const recurrence = mic.recurrence.toLowerCase();

      // Weekly recurrence
      if (recurrence.includes('weekly')) {
        const dayMap = {
          'sunday': 0, 'sun': 0,
          'monday': 1, 'mon': 1,
          'tuesday': 2, 'tue': 2,
          'wednesday': 3, 'wed': 3,
          'thursday': 4, 'thu': 4,
          'friday': 5, 'fri': 5,
          'saturday': 6, 'sat': 6
        };

        for (const [dayName, dayNumber] of Object.entries(dayMap)) {
          if (recurrence.includes(dayName) && date.getDay() === dayNumber) {
            return true;
          }
        }
      }

      // Monthly recurrence - "First Sunday", "Third Tuesday", etc.
      if (recurrence.includes('first') ||
          recurrence.includes('second') ||
          recurrence.includes('third') ||
          recurrence.includes('fourth') ||
          recurrence.includes('last')) {

        const weekNumber = Math.ceil(day / 7);


        if ((recurrence.includes('first') && weekNumber === 1) ||
            (recurrence.includes('second') && weekNumber === 2) ||
            (recurrence.includes('third') && weekNumber === 3) ||
            (recurrence.includes('fourth') && weekNumber === 4) ||
            (recurrence.includes('last') && day > daysInMonth - 7)) {

          // Check if the day of week matches
          const dayMap = {
            'sunday': 0, 'sun': 0,
            'monday': 1, 'mon': 1,
            'tuesday': 2, 'tue': 2,
            'wednesday': 3, 'wed': 3,
            'thursday': 4, 'thu': 4,
            'friday': 5, 'fri': 5,
            'saturday': 6, 'sat': 6
          };

          for (const [dayName, dayNumber] of Object.entries(dayMap)) {
            if (recurrence.includes(dayName) && date.getDay() === dayNumber) {
              return true;
            }
          }
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
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex justify-between items-center mb-4">
          <button onClick={goToPreviousMonth} className="p-2 bg-gray-100 rounded">
            &lt;
          </button>
          <h3 className="text-lg font-semibold">
            {getMonthName(currentDate.getMonth())} {currentDate.getFullYear()}
          </h3>
          <button onClick={goToNextMonth} className="p-2 bg-gray-100 rounded">
            &gt;
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {dayNames.map((dayName, index) => (
            <div key={index} className="text-center font-medium p-2">
              {dayName}
            </div>
          ))}

          {days.map((day, index) => {
            const events = day ? getEventsForDate(day) : [];
            return (
              <div
                key={index}
                className={`border rounded min-h-16 p-1 ${day ? 'bg-white' : 'bg-gray-100'} ${
                  currentDate.getDate() === day ? 'border-blue-500 border-2' : ''
                }`}
              >
                {day && (
                  <>
                    <div className="text-right text-sm">{day}</div>
                    <div className="overflow-y-auto max-h-20">
                      {events.map(event => (
                        <div
                          key={event.id}
                          className="text-xs p-1 my-1 bg-blue-100 rounded truncate cursor-pointer"
                          onClick={() => editOpenMic(event.id)}
                        >
                          {event.name}
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
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex justify-between items-center mb-4">
          <button onClick={goToPreviousWeek} className="p-2 bg-gray-100 rounded">
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
            <div key={index} className="text-center font-medium p-2">
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
            const events = openMics.filter(mic => {
              // Parse the start date
              const startDate = new Date(mic.startDate);

              // Check if this is the exact date
              if (startDate.getDate() === day &&
                  startDate.getMonth() === month &&
                  startDate.getFullYear() === year) {
                return true;
              }

              // Check recurrence patterns (similar to getEventsForDate)
              const recurrence = mic.recurrence.toLowerCase();

              // Weekly recurrence
              if (recurrence.includes('weekly')) {
                const dayMap = {
                  'sunday': 0, 'sun': 0,
                  'monday': 1, 'mon': 1,
                  'tuesday': 2, 'tue': 2,
                  'wednesday': 3, 'wed': 3,
                  'thursday': 4, 'thu': 4,
                  'friday': 5, 'fri': 5,
                  'saturday': 6, 'sat': 6
                };

                for (const [dayName, dayNumber] of Object.entries(dayMap)) {
                  if (recurrence.includes(dayName) && date.getDay() === dayNumber) {
                    return true;
                  }
                }
              }

              return false;
            });

            return (
              <div
                key={index}
                className={`border rounded min-h-32 p-2 ${
                  isCurrentMonth ? 'bg-white' : 'bg-gray-50'
                } ${
                  isToday ? 'border-blue-500 border-2' : ''
                }`}
              >
                <div className={`text-right ${isCurrentMonth ? 'font-normal' : 'text-gray-400'}`}>
                  {day}
                </div>
                <div className="overflow-y-auto max-h-28">
                  {events.map(event => (
                    <div
                      key={event.id}
                      className="text-xs p-1 my-1 bg-blue-100 rounded truncate cursor-pointer"
                      onClick={() => editOpenMic(event.id)}
                    >
                      {event.name}
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

  return (
    <div className="max-w-6xl mx-auto p-4">
        <div className="flex justify-end">
            {!user ? (
                <form onSubmit={handleLogin} className="flex gap-2">
                    <input
                        type="text"
                        placeholder="Username"
                        value={loginForm.username}
                        onChange={(e) => setLoginForm(prev => ({ ...prev, username: e.target.value }))}
                        className="border p-2 rounded"
                        required
                    />
                    <input
                        type="password"
                        placeholder="Password"
                        value={loginForm.password}
                        onChange={(e) => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                        className="border p-2 rounded"
                        required
                    />
                    <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">Login</button>
                </form>
            ) : (
                <div className="flex gap-2 items-center">
                    <span>Logged in as {user.username}</span>
                    <button onClick={handleLogout} className="bg-gray-300 px-3 py-1 rounded">Logout</button>
                </div>
            )}
        </div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Open Mic Tracker</h1>
        <p className="text-gray-600">A community-maintained list of open mics</p>

      </header>

      {/* View toggle buttons */}
      <div className="flex mb-4 gap-2">
        <div className="bg-gray-100 p-1 rounded-lg inline-flex">
          <button
            onClick={() => setDisplayMode('calendar')}
            className={`px-3 py-1 rounded ${displayMode === 'calendar' ? 'bg-white shadow' : ''}`}
          >
            Calendar
          </button>
          <button
            onClick={() => setDisplayMode('list')}
            className={`px-3 py-1 rounded ${displayMode === 'list' ? 'bg-white shadow' : ''}`}
          >
            List
          </button>
        </div>
      </div>

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
              <label className="block mb-1">Contact Info:</label>
              <input
                type="text"
                name="contactInfo"
                value={currentMic.contactInfo}
                onChange={handleChange}
                className="w-full border p-2 rounded"
                required
              />
            </div>

            <div>
              <label className="block mb-1">Location:</label>
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
              <label className="block mb-1">Start Date:</label>
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
              <label className="block mb-1">Recurrence Pattern:</label>
              <input
                type="text"
                name="recurrence"
                value={currentMic.recurrence}
                onChange={handleChange}
                className="w-full border p-2 rounded"
                required
                placeholder="e.g., Weekly on Mondays, 8PM"
              />
            </div>

            <div>
              <label className="block mb-1">Sign-up Instructions:</label>
              <textarea
                name="signupInstructions"
                value={currentMic.signupInstructions}
                onChange={handleChange}
                className="w-full border p-2 rounded"
                rows="3"
                required
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
                  startDate: new Date().toISOString().split('T')[0]
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

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                      <div>
                        <span className="font-medium">Location:</span> {mic.location}
                      </div>
                      <div>
                        <span className="font-medium">When:</span> {mic.recurrence}
                      </div>
                      <div>
                        <span className="font-medium">Start Date:</span> {mic.startDate}
                      </div>
                      <div>
                        <span className="font-medium">Contact:</span> {mic.contactInfo}
                      </div>
                      <div className="md:col-span-2">
                        <span className="font-medium">How to Sign Up:</span> {mic.signupInstructions}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}

        {displayMode === 'calendar' && (
          <div className="bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setCalendarView('month')}
              className={`px-3 py-1 rounded ${calendarView === 'month' ? 'bg-white shadow' : ''}`}
            >
              Month
            </button>
            <button
              onClick={() => setCalendarView('week')}
              className={`px-3 py-1 rounded ${calendarView === 'week' ? 'bg-white shadow' : ''}`}
            >
              Week
            </button>
          </div>
        )}
    </div>
  );
};

export default MicFinder;
