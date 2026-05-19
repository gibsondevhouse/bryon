import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { apiError } from '$lib/server/http';
import { loadConfig } from '$lib/server/config';
import {
	MAX_FILE_BYTES,
	MAX_MESSAGE_BYTES,
	isAllowedUpload,
	saveUpload,
} from '$lib/server/uploads';

export const POST: RequestHandler = async ({ params, request }) => {
	let formData: FormData;
	try {
		formData = await request.formData();
	} catch {
		return apiError(400, 'INVALID_FORM', 'Expected multipart/form-data.');
	}

	const files = formData.getAll('files').filter((f): f is File => f instanceof File);
	if (files.length === 0) {
		return apiError(400, 'MISSING_FILES', 'Form field "files" is required.');
	}

	for (const file of files) {
		if (!isAllowedUpload(file)) {
			return apiError(
				415,
				'UNSUPPORTED_MEDIA_TYPE',
				`Unsupported type "${file.type || file.name}". Accepted: PNG, JPEG, WebP, PDF, TXT, MD, HTML, DOCX, XLSX, PPTX.`,
			);
		}
		if (file.size > MAX_FILE_BYTES) {
			return apiError(413, 'FILE_TOO_LARGE', `File "${file.name}" exceeds the 25 MB limit.`);
		}
	}

	const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
	if (totalBytes > MAX_MESSAGE_BYTES) {
		return apiError(413, 'MESSAGE_TOO_LARGE', 'Total upload exceeds the 100 MB per-message limit.');
	}

	const { config } = loadConfig();
	const results = [];

	for (const file of files) {
		try {
			const attachment = await saveUpload(params.id, file, config.app.data_dir);
			results.push(attachment);
		} catch (err) {
			return apiError(500, 'UPLOAD_FAILED', (err as Error).message);
		}
	}

	return json({ attachments: results }, { status: 201 });
};
