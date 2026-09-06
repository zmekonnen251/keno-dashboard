import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function randRequestId(): string {
	const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
	let s = '';
	for (let i = 0; i < 4; i++)
		s += chars[Math.floor(Math.random() * chars.length)];
	return s;
}