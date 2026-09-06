'use server';

import { Account } from '../types';
import { prisma } from '@/lib/prisma';

export interface AutoplayConfigData {
	id: number;
	enabled: boolean;
	mode: 'A' | 'B' | 'C';
	batch_size: number;
	stake: number;
	split_ratio: 'uniform' | '1/2' | '1/3';
	base_tickets: number[][] | null;
	digit_count: 2 | 3;
	updated_at: Date | null;
}

export async function getAutoplayConfigServerAction(): Promise<AutoplayConfigData | null> {
	const config = await prisma.autoplay_config.findFirst({
		where: { id: 1 },
	});

	if (!config) return null;

	let parsedTickets: number[][] | null = null;
	if (config.base_tickets) {
		try {
			parsedTickets = JSON.parse(config.base_tickets);
		} catch {
			parsedTickets = null;
		}
	}

	return {
		id: config.id,
		enabled: config.enabled,
		mode: config.mode as 'A' | 'B' | 'C',
		batch_size: config.batch_size,
		stake: config.stake,
		split_ratio: config.split_ratio as 'uniform' | '1/2' | '1/3',
		base_tickets: parsedTickets,
		digit_count: (config.digit_count as 2 | 3) || 3,
		updated_at: config.updated_at,
	};
}

export async function updateAutoplayConfigServerAction(data: {
	stake?: number;
	batch_size?: number;
	mode?: 'A' | 'B' | 'C';
	split_ratio?: 'uniform' | '1/2' | '1/3';
	digit_count?: 2 | 3;
	base_tickets?: number[][] | null;
	enabled?: boolean;
}) {
	const updateData: Record<string, unknown> = {
		updated_at: new Date(),
	};

	if (data.stake !== undefined) updateData.stake = data.stake;
	if (data.batch_size !== undefined) updateData.batch_size = data.batch_size;
	if (data.mode !== undefined) updateData.mode = data.mode;
	if (data.split_ratio !== undefined) updateData.split_ratio = data.split_ratio;
	if (data.digit_count !== undefined) updateData.digit_count = data.digit_count;
	if (data.enabled !== undefined) updateData.enabled = data.enabled;
	if (data.base_tickets !== undefined) {
		updateData.base_tickets = data.base_tickets
			? JSON.stringify(data.base_tickets)
			: null;
	}

	return await prisma.autoplay_config.upsert({
		where: { id: 1 },
		update: updateData,
		create: {
			id: 1,
			enabled: data.enabled ?? false,
			mode: data.mode ?? 'A',
			batch_size: data.batch_size ?? 1,
			stake: data.stake ?? 2,
			split_ratio: data.split_ratio ?? 'uniform',
			digit_count: data.digit_count ?? 3,
			base_tickets: data.base_tickets
				? JSON.stringify(data.base_tickets)
				: null,
		},
	});
}

export async function getActiveAccountsServerAction() {
	const accounts = await prisma.accounts.findMany({
		where: { is_deleted: false },
		select: { id: true, phone: true, token: true, ws_token: true },
	});
	return accounts.map((acc: Account) => ({
		id: Number(acc.id),
		phone: acc.phone,
    token: acc.token,
    ws_token: acc.ws_token,
	}));
}




