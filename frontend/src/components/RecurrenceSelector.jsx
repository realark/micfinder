import React, { useState, useEffect } from 'react';
import { RRule } from 'rrule';

const RecurrenceSelector = ({ value, onChange }) => {
  const [frequency, setFrequency] = useState('WEEKLY');
  const [interval, setInterval] = useState(1);
  const [byDay, setByDay] = useState([]);
  const [isRecurring, setIsRecurring] = useState(!!value);

  const weekdays = [
    { value: 'MO', label: 'Monday' },
    { value: 'TU', label: 'Tuesday' },
    { value: 'WE', label: 'Wednesday' },
    { value: 'TH', label: 'Thursday' },
    { value: 'FR', label: 'Friday' },
    { value: 'SA', label: 'Saturday' },
    { value: 'SU', label: 'Sunday' },
  ];

  // Parse the RRule string when the value changes
  useEffect(() => {
    if (value) {
      try {
        const rule = RRule.fromString(value);
        setFrequency(rule.options.freq === RRule.WEEKLY ? 'WEEKLY' : 'MONTHLY');
        setInterval(rule.options.interval || 1);
        setByDay(rule.options.byweekday ? 
          rule.options.byweekday.map(day => weekdays[day].value) : []);
        setIsRecurring(true);
      } catch (error) {
        console.error('Error parsing RRule:', error);
      }
    } else {
      setIsRecurring(false);
    }
  }, []);

  // Generate the RRule string when options change
  const generateRRule = () => {
    if (!isRecurring) {
      onChange('');
      return;
    }

    try {
      const options = {
        freq: frequency === 'WEEKLY' ? RRule.WEEKLY : RRule.MONTHLY,
        interval: interval,
      };

      if (frequency === 'WEEKLY' && byDay.length > 0) {
        options.byweekday = byDay.map(day => {
          switch (day) {
            case 'MO': return RRule.MO;
            case 'TU': return RRule.TU;
            case 'WE': return RRule.WE;
            case 'TH': return RRule.TH;
            case 'FR': return RRule.FR;
            case 'SA': return RRule.SA;
            case 'SU': return RRule.SU;
            default: return null;
          }
        }).filter(Boolean);
      }

      const rule = new RRule(options);
      onChange(rule.toString());
    } catch (error) {
      console.error('Error generating RRule:', error);
    }
  };

  // Handle checkbox changes for weekdays
  const handleDayChange = (day) => {
    const newByDay = byDay.includes(day)
      ? byDay.filter(d => d !== day)
      : [...byDay, day];
    
    setByDay(newByDay);
  };

  // Update the RRule when any option changes
  useEffect(() => {
    generateRRule();
  }, [frequency, interval, byDay, isRecurring]);

  return (
    <div className="space-y-3">
      <div className="flex items-center">
        <input
          type="checkbox"
          id="is-recurring"
          checked={isRecurring}
          onChange={() => setIsRecurring(!isRecurring)}
          className="mr-2"
        />
        <label htmlFor="is-recurring" className="font-medium">This is a recurring event</label>
      </div>

      {isRecurring && (
        <>
          <div className="flex items-center gap-2">
            <label className="whitespace-nowrap">Repeats every</label>
            <input
              type="number"
              min="1"
              max="99"
              value={interval}
              onChange={(e) => setInterval(parseInt(e.target.value) || 1)}
              className="border rounded p-1 w-16 text-center"
            />
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              className="border rounded p-1"
            >
              <option value="WEEKLY">week(s)</option>
              <option value="MONTHLY">month(s)</option>
            </select>
          </div>

          {frequency === 'WEEKLY' && (
            <div className="mt-2">
              <label className="block mb-1">On these days:</label>
              <div className="flex flex-wrap gap-2">
                {weekdays.map((day) => (
                  <label key={day.value} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={byDay.includes(day.value)}
                      onChange={() => handleDayChange(day.value)}
                      className="mr-1"
                    />
                    {day.label}
                  </label>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default RecurrenceSelector;
