import { addMonths, differenceInCalendarDays, startOfDay } from 'date-fns';

/**
 * Returns the length of time since I was born
 * e.g. 'XX years, XX months, XX days'
 * 
 * @param birthday - The date of my birthday
 * @returns The length of time since I was born
 */
export function dailyReadme(birthday: Date): string {
    const diff = relativedelta(new Date(), birthday);
    return `${diff.years} ${'year' + formatPlural(diff.years)}, ` +
        `${diff.months} ${'month' + formatPlural(diff.months)}, ` +
        `${diff.days} ${'day' + formatPlural(diff.days)}` +
        (diff.months === 0 && diff.days === 0 ? ' 🎂' : '');
}

/**
 * Returns a properly formatted number
 * e.g.
 * 'day' + format_plural(diff.days) == 5
 * >>> '5 days'
 * 'day' + format_plural(diff.days) == 1
 * >>> '1 day'
 * 
 * @param unit - The number to format
 * @returns - The properly formatted number
 */
export function formatPlural(unit: number): string {
    return unit !== 1 ? 's' : '';
}

/**
 * Equivalent of dateutil.relativedelta(dt1=to, dt2=from) for the units
 * daily_readme uses (years / months / days), built on date-fns. date-fns'
 * addMonths clamps overflowing days (e.g. Feb 29 -> Feb 28) and preserves the
 * base date's time-of-day, matching dateutil's calendar behavior.
 * 
 * Days are counted as calendar days (differenceInCalendarDays), not elapsed
 * 24-hour periods, so the current time of day never shifts the day count.
 * 
 * @param to - The date to compare to
 * @param from - The date to compare from
 * @returns The difference between the two dates in years, months, and days
 */
export function relativedelta(to: Date, from: Date): { years: number; months: number; days: number } {
    const base = startOfDay(from);
    let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());

    if(to < addMonths(base, months)) months -= 1;

    const anniversary = addMonths(base, months);
    const days = differenceInCalendarDays(startOfDay(to), anniversary);

    return {
        years: Math.floor(months / 12),
        months: ((months % 12) + 12) % 12,
        days
    };
}

/**
 * Function to format a number with commas as thousands separators.
 * 
 * @param value - The number to format
 * @returns The formatted number as a string
 */
export function comma(value: number): string {
    return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}