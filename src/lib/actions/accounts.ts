'use server';

import { prisma } from '@/lib/prisma'; // Adjust to your ORM setup

export async function fetchActiveAccounts(batchSize: number) {
	return await prisma.account.findMany({
		where: {
			is_deleted: false, token: { not: null },
			ws_token: { not: null }
		},
		take: batchSize,
	});
}

export async function fetchAutoplayConfig() {
	return await prisma.autoplayConfig.findFirst();
}

export async function updateAccountBalance(accountId: number, balance: number) {
	return await prisma.account.update({
		where: { id: accountId },
		data: { balance },
	});
}
