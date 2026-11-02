import React, { useState } from 'react';
import { RRule } from 'rrule';

const WEEKDAYS = [
  { value: 'MO', label: 'Monday', rruleValue: RRule.MO },
  { value: 'TU', label: 'Tuesday', rruleValue: RRule.TU },
  { value: 'WE', label: 'Wednesday', rruleValue: RRule.WE },
  { value: 'TH', label: 'Thursday', rruleValue: RRule.TH },
  { value: 'FR', label: 'Friday', rruleValue: RRule.FR },
  { value: 'SA', label: 'Saturday', rruleValue: RRule.SA },
  { value: 'SU', label: 'Sunday', rruleValue: RRule.SU },
];

const parseRecurrence = (value) => {
  if (!value) {
    return { isRecurring: false, frequency: 'WEEKLY', interval: 1, byDay: [] };
  }

  try {
    const rule = RRule.fromString(value);
    return {
      isRecurring: true,
      frequency: rule.options.freq === RRule.MONTHLY ? 'MONTHLY' : 'WEEKLY',
      interval: rule.options.interval || 1,
      byDay: rule.options.byweekday
        ? rule.options.byweekday.map(day => WEEKDAYS[day].value)
        : [],
    };
  } catch (error) {
    console.error('Error parsing RRule:', error);
    return { isRecurring: false, frequency: 'WEEKLY', interval: 1, byDay: [] };
  }
};

const buildRecurrence = ({ frequency, interval, byDay }) => {
  const options = {
    freq: frequency === 'WEEKLY' ? RRule.WEEKLY : RRule.MONTHLY,
    interval,
  };

  if (frequency === 'WEEKLY' && byDay.length > 0) {
    options.byweekday = byDay.map(day =>
      WEEKDAYS.find(weekday => weekday.value === day).rruleValue
    );
  }

  return new RRule(options).toString();
};

const RecurrenceSelector = ({
  value,
  onChange,
  startDate,
  recurrenceEndDate,
  onRecurrenceEndDateChange,
  excludedDates,
  onExcludedDatesChange,
}) => {
  const [options, setOptions] = useState(() => parseRecurrence(value));
  const [dateToExclude, setDateToExclude] = useState('');
  const [exclusionError, setExclusionError] = useState('');

  const updateOptions = (changes) => {
    const nextOptions = { ...options, ...changes };
    setOptions(nextOptions);
    onChange(nextOptions.isRecurring ? buildRecurrence(nextOptions) : '');
  };

  const setRecurring = (isRecurring) => {
    updateOptions({ isRecurring });
    if (!isRecurring) {
      onRecurrenceEndDateChange('');
      onExcludedDatesChange([]);
      setDateToExclude('');
      setExclusionError('');
    }
  };

  const handleDayChange = (day) => {
    const byDay = options.byDay.includes(day)
      ? options.byDay.filter(selectedDay => selectedDay !== day)
      : [...options.byDay, day];
    updateOptions({ byDay });
  };

  const addExcludedDate = () => {
    if (!dateToExclude) {
      setExclusionError('Choose a date to skip.');
      return;
    }
    if (startDate && dateToExclude < startDate) {
      setExclusionError('Skipped dates cannot be before the series starts.');
      return;
    }
    if (recurrenceEndDate && dateToExclude > recurrenceEndDate) {
      setExclusionError('Skipped dates cannot be after the series ends.');
      return;
    }
    if (excludedDates.includes(dateToExclude)) {
      setExclusionError('That date is already skipped.');
      return;
    }

    onExcludedDatesChange([...excludedDates, dateToExclude].sort());
    setDateToExclude('');
    setExclusionError('');
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center">
        <input
          type="checkbox"
          id="is-recurring"
          checked={options.isRecurring}
          onChange={(event) => setRecurring(event.target.checked)}
          className="mr-2"
        />
        <label htmlFor="is-recurring" className="font-medium">This is a recurring event</label>
      </div>

      {options.isRecurring && (
        <div className="space-y-4 border-l-2 border-blue-200 pl-3">
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="recurrence-interval" className="whitespace-nowrap">Repeats every</label>
            <input
              id="recurrence-interval"
              type="number"
              min="1"
              max="99"
              value={options.interval}
              onChange={(event) => updateOptions({ interval: parseInt(event.target.value, 10) || 1 })}
              className="border rounded p-1 w-16 text-center"
            />
            <select
              aria-label="Recurrence frequency"
              value={options.frequency}
              onChange={(event) => updateOptions({ frequency: event.target.value })}
              className="border rounded p-1"
            >
              <option value="WEEKLY">week(s)</option>
              <option value="MONTHLY">month(s)</option>
            </select>
          </div>

          {options.frequency === 'WEEKLY' && (
            <fieldset>
              <legend className="mb-1">On these days:</legend>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map((day) => (
                  <label key={day.value} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={options.byDay.includes(day.value)}
                      onChange={() => handleDayChange(day.value)}
                      className="mr-1"
                    />
                    {day.label}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <div>
            <label htmlFor="recurrence-end" className="block mb-1">Ends:</label>
            <div className="flex flex-wrap items-center gap-2">
              <select
                id="recurrence-end"
                value={recurrenceEndDate ? 'date' : 'never'}
                onChange={(event) => onRecurrenceEndDateChange(
                  event.target.value === 'date' ? (startDate || '') : ''
                )}
                className="border rounded p-1"
              >
                <option value="never">Never</option>
                <option value="date">On date</option>
              </select>
              {recurrenceEndDate && (
                <input
                  aria-label="Recurrence end date"
                  type="date"
                  min={startDate}
                  value={recurrenceEndDate}
                  onChange={(event) => onRecurrenceEndDateChange(event.target.value)}
                  className="border rounded p-1"
                  required
                />
              )}
            </div>
          </div>

          <div>
            <label htmlFor="excluded-date" className="block mb-1">Skip individual dates:</label>
            <div className="flex flex-wrap gap-2">
              <input
                id="excluded-date"
                type="date"
                min={startDate}
                max={recurrenceEndDate || undefined}
                value={dateToExclude}
                onChange={(event) => {
                  setDateToExclude(event.target.value);
                  setExclusionError('');
                }}
                className="border rounded p-1"
              />
              <button
                type="button"
                onClick={addExcludedDate}
                className="bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded"
              >
                Skip date
              </button>
            </div>
            {exclusionError && <p className="text-red-600 text-sm mt-1">{exclusionError}</p>}
            {excludedDates.length > 0 && (
              <ul className="mt-2 space-y-1">
                {excludedDates.map(date => (
                  <li key={date} className="flex items-center gap-2">
                    <span>{date}</span>
                    <button
                      type="button"
                      onClick={() => onExcludedDatesChange(
                        excludedDates.filter(excludedDate => excludedDate !== date)
                      )}
                      className="text-blue-600 hover:underline text-sm"
                    >
                      Restore
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RecurrenceSelector;
