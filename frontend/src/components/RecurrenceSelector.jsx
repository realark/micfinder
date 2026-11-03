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

const MONTHLY_POSITIONS = [
  { value: 1, label: 'First' },
  { value: 2, label: 'Second' },
  { value: 3, label: 'Third' },
  { value: 4, label: 'Fourth' },
  { value: -1, label: 'Last' },
];

const parseRecurrence = (value, startDate) => {
  const startWeekday = startDate ? new Date(`${startDate}T12:00:00`).getDay() : 1;
  const defaults = {
    isRecurring: false,
    frequency: 'WEEKLY',
    interval: 1,
    byDay: [],
    monthlyMode: 'date',
    monthlyPosition: 1,
    monthlyWeekday: WEEKDAYS[(startWeekday + 6) % 7].value,
  };
  if (!value) return defaults;

  try {
    const rule = RRule.fromString(value);
    return {
      ...defaults,
      isRecurring: true,
      frequency: rule.options.freq === RRule.MONTHLY ? 'MONTHLY' : 'WEEKLY',
      interval: rule.options.interval || 1,
      byDay: rule.options.byweekday
        ? rule.options.byweekday.map(day => WEEKDAYS[day].value)
        : [],
      monthlyMode: rule.options.bysetpos?.length === 1 && rule.options.byweekday?.length === 1
        ? 'weekday'
        : 'date',
      monthlyPosition: rule.options.bysetpos?.[0] ?? defaults.monthlyPosition,
      monthlyWeekday: rule.options.byweekday?.length === 1
        ? WEEKDAYS[rule.options.byweekday[0]].value
        : defaults.monthlyWeekday,
    };
  } catch (error) {
    console.error('Error parsing RRule:', error);
    return defaults;
  }
};

const buildRecurrence = ({ frequency, interval, byDay, monthlyMode, monthlyPosition, monthlyWeekday }) => {
  const options = {
    freq: frequency === 'WEEKLY' ? RRule.WEEKLY : RRule.MONTHLY,
    interval,
  };

  if (frequency === 'WEEKLY' && byDay.length > 0) {
    options.byweekday = byDay.map(day =>
      WEEKDAYS.find(weekday => weekday.value === day).rruleValue
    );
  }
  if (frequency === 'MONTHLY' && monthlyMode === 'weekday') {
    options.byweekday = WEEKDAYS.find(day => day.value === monthlyWeekday).rruleValue;
    options.bysetpos = monthlyPosition;
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
  const [options, setOptions] = useState(() => parseRecurrence(value, startDate));
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

          {options.frequency === 'MONTHLY' && (
            <fieldset className="min-w-0 space-y-2">
              <legend className="mb-1">Monthly schedule:</legend>
              <select
                aria-label="Monthly schedule"
                value={options.monthlyMode}
                onChange={(event) => updateOptions({ monthlyMode: event.target.value })}
                className="border rounded p-1 max-w-full"
              >
                <option value="date">Same day of the month as the start date</option>
                <option value="weekday">On a specific weekday</option>
              </select>
              {options.monthlyMode === 'weekday' && (
                <div className="flex flex-wrap items-center gap-2">
                  <span>On the</span>
                  <select
                    aria-label="Weekday occurrence"
                    value={options.monthlyPosition}
                    onChange={(event) => updateOptions({ monthlyPosition: Number(event.target.value) })}
                    className="border rounded p-1"
                  >
                    {MONTHLY_POSITIONS.map(position => (
                      <option key={position.value} value={position.value}>{position.label}</option>
                    ))}
                  </select>
                  <select
                    aria-label="Monthly weekday"
                    value={options.monthlyWeekday}
                    onChange={(event) => updateOptions({ monthlyWeekday: event.target.value })}
                    className="border rounded p-1"
                  >
                    {WEEKDAYS.map(day => (
                      <option key={day.value} value={day.value}>{day.label}</option>
                    ))}
                  </select>
                </div>
              )}
              {options.monthlyMode === 'date' && (
                <p className="text-sm text-gray-500">Months without that date are skipped.</p>
              )}
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
