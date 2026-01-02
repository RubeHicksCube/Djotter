import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { format } from 'date-fns';

/**
 * Convert a UTC timestamp to user's timezone and format it
 * @param {string|Date} utcTimestamp - ISO timestamp or Date object in UTC
 * @param {string} timezone - IANA timezone string (e.g., 'America/New_York')
 * @param {string} formatString - date-fns format string (default: 'yyyy-MM-dd HH:mm:ss')
 * @returns {string} Formatted date string in user's timezone
 */
export function formatInUserTimezone(utcTimestamp, timezone = 'UTC', formatString = 'yyyy-MM-dd HH:mm:ss') {
  if (!utcTimestamp) return '';

  try {
    let date;
    if (typeof utcTimestamp === 'string') {
      // SQLite timestamps are in format 'YYYY-MM-DD HH:MM:SS' (UTC, but without timezone indicator)
      // Convert to ISO format with explicit UTC marker so JavaScript parses correctly
      const isoTimestamp = utcTimestamp.includes('T')
        ? utcTimestamp  // Already ISO format
        : utcTimestamp.replace(' ', 'T') + 'Z';  // Convert SQLite format to ISO with UTC
      date = new Date(isoTimestamp);
    } else {
      date = utcTimestamp;
    }

    // Check if the date is valid
    if (isNaN(date.getTime())) {
      console.error('Error formatting timestamp: Invalid time value', utcTimestamp);
      return 'Invalid Date';
    }

    // Format the date in the user's timezone
    return formatInTimeZone(date, timezone, formatString);
  } catch (error) {
    console.error('Error formatting timestamp:', error);
    return 'Invalid Date';
  }
}

/**
 * Format just the time portion (HH:mm:ss)
 */
export function formatTimeInUserTimezone(utcTimestamp, timezone = 'UTC') {
  return formatInUserTimezone(utcTimestamp, timezone, 'HH:mm:ss');
}

/**
 * Format just the date portion (yyyy-MM-dd)
 */
export function formatDateInUserTimezone(utcTimestamp, timezone = 'UTC') {
  return formatInUserTimezone(utcTimestamp, timezone, 'yyyy-MM-dd');
}

/**
 * Format for display in activity log (MMM dd, HH:mm)
 */
export function formatLogTimestamp(utcTimestamp, timezone = 'UTC') {
  return formatInUserTimezone(utcTimestamp, timezone, 'MMM dd, HH:mm');
}

/**
 * Format for display in activity log (just time: HH:mm)
 */
export function formatLogTime(utcTimestamp, timezone = 'UTC') {
  return formatInUserTimezone(utcTimestamp, timezone, 'HH:mm');
}

/**
 * Convert user's local time to UTC for sending to server
 * @param {Date} localDate - Date in user's timezone
 * @param {string} timezone - User's IANA timezone
 * @returns {string} ISO string in UTC
 */
export function convertToUTC(localDate, timezone = 'UTC') {
  try {
    // Get the zoned time, then convert to UTC ISO string
    const zonedDate = toZonedTime(localDate, timezone);
    return zonedDate.toISOString();
  } catch (error) {
    console.error('Error converting to UTC:', error);
    return localDate.toISOString();
  }
}

/**
 * Get current date in user's timezone (for "today" comparisons)
 */
export function getTodayInUserTimezone(timezone = 'UTC') {
  const now = new Date();
  return formatDateInUserTimezone(now, timezone);
}
