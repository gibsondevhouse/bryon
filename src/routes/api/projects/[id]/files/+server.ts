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
import { ProjectService } from '$lib/server/features/projects/project';

export const GET: RequestHandler = async ({ params, url }) => {
	const service = new ProjectService();
	const project = service.get(params.id);
	if (!project) return apiError(404, 'PROJECT_NOT_FOUND', 'Project not found.');
	const includeArchived = url.searchParams.get('includeArchived') === 'true';
	return json({ files: service.listFiles(params.id, includeArchived) });
};

export const POST: RequestHandler = async ({ params, request }) => {
	const service = new ProjectService();
	const project = service.get(params.id);
	if (!project) return apiError(404, 'PROJECT_NOT_FOUND', 'Project not found.');

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
			return apiError(415, 'UNSUPPORTED_MEDIA_TYPE', `Unsupported type "${file.type || file.name}".`);
		}
		if (file.size > MAX_FILE_BYTES) {
			return apiError(413, 'FILE_TOO_LARGE', `File "${file.name}" exceeds the 25 MB limit.`);
		}
	}
	const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
	if (totalBytes > MAX_MESSAGE_BYTES) {
		return apiError(413, 'MESSAGE_TOO_LARGE', 'Total upload exceeds the 100 MB limit.');
	}

	const { config } = loadConfig();
	const uploaded = [];
	for (const file of files) {
		try {
			const attachment = await saveUpload(`project-${params.id}`, file, config.app.data_dir);
			uploaded.push(service.addFile(params.id, attachment));
		} catch (error) {
			return apiError(
				500,
				'UPLOAD_FAILED',
				error instanceof Error ? error.message : 'Upload failed.',
			);
		}
	}

	return json({ files: uploaded }, { status: 201 });
};
