import adapter from '@sveltejs/adapter-node';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
		runes: ({ filename }) =>
			filename.split(/[/\\]/).includes('node_modules') ? undefined : true,
	},
	kit: {
		adapter: adapter({ precompress: false }),
		// Bryon is a local single-user app (127.0.0.1). Disabling strict origin
		// checks prevents false 403s for multipart uploads when ORIGIN is unset.
		csrf: { trustedOrigins: ['*'] },
	},
};

export default config;
