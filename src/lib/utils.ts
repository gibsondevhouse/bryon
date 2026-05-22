import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

/** 22MAY26 */
export function fmtDate(ts: number | Date): string {
	const d = ts instanceof Date ? ts : new Date(ts);
	const dd = String(d.getDate()).padStart(2, '0');
	const mmm = MONTHS[d.getMonth()];
	const yy = String(d.getFullYear()).slice(-2);
	return `${dd}${mmm}${yy}`;
}

/** 14:30 */
export function fmtTime(ts: number | Date): string {
	const d = ts instanceof Date ? ts : new Date(ts);
	return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
}

/** 22MAY26 · 14:30 */
export function fmtDateTime(ts: number | Date): string {
	return `${fmtDate(ts)} · ${fmtTime(ts)}`;
}

/** May 2026  — for natural-language group headings */
export function fmtMonthYear(ts: number | Date): string {
	const d = ts instanceof Date ? ts : new Date(ts);
	return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChild<T> = T extends { child?: any } ? Omit<T, 'child'> : T;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChildren<T> = T extends { children?: any }
	? Omit<T, 'children'>
	: T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & {
	ref?: U | null;
};
