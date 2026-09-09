'use client';

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
	try {
		if (typeof window === 'undefined') return null;
		if (!ctx) {
			const AC =
				window.AudioContext ??
				(window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
			if (!AC) return null;
			ctx = new AC();
		}
		if (ctx.state === 'suspended') void ctx.resume();
		return ctx;
	} catch {
		return null;
	}
}

// Short ascending fanfare for a full match (C5 → E5 → G5 → C6).
export function playWinSound(): void {
	const ac = audio();
	if (!ac) return;
	try {
		const notes = [523.25, 659.25, 783.99, 1046.5];
		notes.forEach((freq, i) => {
			const osc = ac.createOscillator();
			const gain = ac.createGain();
			osc.type = 'sine';
			osc.frequency.value = freq;
			const t = ac.currentTime + i * 0.12;
			gain.gain.setValueAtTime(0.0001, t);
			gain.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
			gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
			osc.connect(gain);
			gain.connect(ac.destination);
			osc.start(t);
			osc.stop(t + 0.4);
		});
	} catch {
		// Audio unavailable (e.g. blocked autoplay) — stay silent.
	}
}

export type NotifyPermission = 'granted' | 'denied' | 'default' | 'unsupported';

export function notificationPermission(): NotifyPermission {
	if (typeof window === 'undefined' || typeof Notification === 'undefined') return 'unsupported';
	return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotifyPermission> {
	try {
		if (typeof window === 'undefined' || typeof Notification === 'undefined') return 'unsupported';
		if (Notification.permission === 'granted' || Notification.permission === 'denied') {
			return Notification.permission;
		}
		return await Notification.requestPermission();
	} catch {
		return 'unsupported';
	}
}

export function pushWinNotification(title: string, body: string): boolean {
	try {
		if (typeof window === 'undefined' || typeof Notification === 'undefined') return false;
		if (Notification.permission !== 'granted') return false;
		new Notification(title, { body });
		return true;
	} catch {
		return false;
	}
}
