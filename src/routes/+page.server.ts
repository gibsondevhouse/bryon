import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	// Dashboard — data is provided by the layout server (chats, plans, projects, settings)
	return {};
};
