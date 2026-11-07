import { addMonths, differenceInCalendarDays, differenceInCalendarMonths } from 'date-fns';

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
 * @param to - The date to compare to
 * @param from - The date to compare from
 * @returns The difference between the two dates in years, months, and days
 */
export function relativedelta(to: Date, from: Date): { years: number; months: number; days: number } {
    const timeOfDay = (d: Date): number =>
        d.getHours() * 3600000 + d.getMinutes() * 60000 + d.getSeconds() * 1000 + d.getMilliseconds();
    // Get year / month delta between the two
    let months = differenceInCalendarMonths(to, from);

    let anchor = addMonths(from, months);
    if(to < from) {
        // target before the base date: grow the month count; the anchor may pass
        // the target and the resulting negative timedelta flows into the day count
        while(to > anchor) {
            months += 1;
            anchor = addMonths(from, months);
        }
    } 
    else {
        // target after (or equal to) the base date: shrink until the anchor is behind it
        while(anchor > to) {
            months -= 1;
            anchor = addMonths(from, months);
        }
    }
    // wall-clock timedelta between the months-adjusted anchor and the target,
    // cascaded to whole days (which truncates the
    // days and keeps the remaining hours/minutes/seconds out of .days)
    const wallDelta = differenceInCalendarDays(to, anchor) * 86400000
        + timeOfDay(to) - timeOfDay(anchor);
    const days = Math.trunc(wallDelta / 86400000);
    // Split into years + leftover months
    const years = Math.trunc(months / 12);
    return { years, months: months - years * 12, days };
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