import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { PDFParse } from 'pdf-parse';
import type { Attachment } from '$lib/shared/types';

export const ALLOWED_IMAGE_MIMES = new Set([
	'image/png',
	'image/jpeg',
	'image/webp',
]);

export const ALLOWED_DOCUMENT_MIMES = new Set([
	'application/pdf',
	'text/plain',
	'text/markdown',
	'text/html',
	'application/xhtml+xml',
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const DOCUMENT_EXTENSIONS = new Set([
	'.pdf',
	'.txt',
	'.md',
	'.markdown',
	'.html',
	'.htm',
	'.docx',
	'.xlsx',
	'.pptx',
]);

export const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB per file
export const MAX_MESSAGE_BYTES = 100 * 1024 * 1024; // 100 MB per message
const MAX_EXTRACTED_TEXT_CHARS = 80_000;

type UploadKind = 'image' | 'document';

export async function saveUpload(
	chatId: string,
	file: File,
	dataDir: string,
): Promise<Attachment> {
	const kind = classifyUpload(file);
	if (!kind) {
		throw new Error(
			`Unsupported file type "${file.type || extname(file.name) || 'unknown'}". Accepted: PNG, JPEG, WebP, PDF, TXT, MD, HTML, DOCX, XLSX, PPTX.`,
		);
	}
	if (file.size > MAX_FILE_BYTES) {
		throw new Error(`File "${file.name}" exceeds the 25 MB per-file limit.`);
	}

	const id = randomUUID();
	const ext = normalizedExt(file);
	const dir = join(dataDir, 'uploads', chatId);
	mkdirSync(dir, { recursive: true });
	const path = join(dir, `${id}${ext}`);

	const buffer = Buffer.from(await file.arrayBuffer());
	writeFileSync(path, buffer);

	const base: Attachment = {
		id,
		path,
		name: file.name || basename(path),
		kind,
		mime: file.type || mimeFromExt(ext),
		sizeBytes: file.size,
	};

	if (kind === 'image') return base;

	const extracted = await extractDocumentText(path, base.name, base.mime);
	const text = truncateForStorage(extracted.text);
	const textPath = `${path}.txt`;
	writeFileSync(textPath, text, 'utf8');

	return {
		...base,
		title: extracted.title,
		textPath,
		textBytes: Buffer.byteLength(text, 'utf8'),
	};
}

export function classifyUpload(file: File): UploadKind | null {
	const ext = extname(file.name).toLowerCase();
	if (ALLOWED_IMAGE_MIMES.has(file.type) || IMAGE_EXTENSIONS.has(ext)) {
		return 'image';
	}
	if (ALLOWED_DOCUMENT_MIMES.has(file.type) || DOCUMENT_EXTENSIONS.has(ext)) {
		return 'document';
	}
	return null;
}

export function isAllowedUpload(file: File): boolean {
	return classifyUpload(file) !== null;
}

async function extractDocumentText(
	path: string,
	filename: string,
	mime: string,
): Promise<{ title: string | null; text: string }> {
	const ext = extname(filename).toLowerCase();
	const buffer = readFileSync(path);

	if (mime === 'application/pdf' || ext === '.pdf') {
		const parser = new PDFParse({ data: buffer });
		try {
			const [textResult, infoResult] = await Promise.all([
				parser.getText(),
				parser.getInfo().catch(() => null),
			]);
			const text = normalizeText(textResult.text ?? '');
			const title = typeof infoResult?.info?.Title === 'string'
				? infoResult.info.Title.trim()
				: '';
			return {
				title: title || firstLineTitle(text) || filename,
				text,
			};
		} finally {
			await parser.destroy();
		}
	}

	if (['.txt', '.md', '.markdown'].includes(ext) || mime.startsWith('text/')) {
		const raw = buffer.toString('utf8');
		const text =
			ext === '.html' || ext === '.htm' || mime.includes('html')
				? htmlToText(raw)
				: normalizeText(stripMarkdown(raw));
		return { title: firstLineTitle(text) || filename, text };
	}

	if (ext === '.docx') {
		const xml = unzipText(path, ['word/document.xml']);
		const text = xmlToText(xml);
		return { title: firstLineTitle(text) || filename, text };
	}

	if (ext === '.pptx') {
		const xml = unzipText(path, ['ppt/slides/slide*.xml', 'ppt/notesSlides/notesSlide*.xml']);
		const text = xmlToText(xml);
		return { title: firstLineTitle(text) || filename, text };
	}

	if (ext === '.xlsx') {
		const xml = unzipText(path, ['xl/sharedStrings.xml', 'xl/worksheets/sheet*.xml']);
		const text = xmlToText(xml);
		return { title: firstLineTitle(text) || filename, text };
	}

	throw new Error(`No extractor is available for "${filename}".`);
}

function unzipText(path: string, entries: string[]): string {
	const parts: string[] = [];
	for (const entry of entries) {
		try {
			const out = execFileSync('unzip', ['-p', path, entry], {
				encoding: 'utf8',
				maxBuffer: 12 * 1024 * 1024,
				stdio: ['ignore', 'pipe', 'ignore'],
			});
			if (out.trim()) parts.push(out);
		} catch {
			// Some Office packages omit optional entries such as notes slides.
		}
	}

	if (parts.length === 0) {
		throw new Error('Could not extract document text. Ensure `unzip` is installed and the Office file is valid.');
	}

	return parts.join('\n\n');
}

function htmlToText(html: string): string {
	return normalizeText(
		html
			.replace(/<script[\s\S]*?<\/script>/gi, '')
			.replace(/<style[\s\S]*?<\/style>/gi, '')
			.replace(/<\/?(p|div|section|article|header|footer|li|tr|br|h[1-6])[^>]*>/gi, '\n')
			.replace(/<[^>]+>/g, ' '),
	);
}

function xmlToText(xml: string): string {
	return normalizeText(xml.replace(/<[^>]+>/g, ' '));
}

function stripMarkdown(value: string): string {
	return value
		.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, '')
		.replace(/```[\s\S]*?```/g, '')
		.replace(/!\[.*?\]\(.*?\)/g, '')
		.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
		.replace(/^#{1,6}\s+/gm, '')
		.replace(/[*_`~]/g, '');
}

function normalizeText(value: string): string {
	return decodeEntities(value)
		.replace(/\r\n/g, '\n')
		.replace(/[ \t]{2,}/g, ' ')
		.replace(/\n[ \t]+/g, '\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

function decodeEntities(value: string): string {
	return value
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&#39;/g, "'");
}

function firstLineTitle(text: string): string | null {
	const line = text
		.split('\n')
		.map((item) => item.trim())
		.find((item) => item.length > 0);
	return line && line.length <= 120 ? line : null;
}

function truncateForStorage(text: string): string {
	if (text.length <= MAX_EXTRACTED_TEXT_CHARS) return text;
	return `${text.slice(0, MAX_EXTRACTED_TEXT_CHARS)}\n\n[Document text truncated for prompt safety.]`;
}

function normalizedExt(file: File): string {
	const ext = extname(file.name).toLowerCase();
	if (ext) return ext;
	return mimeToExt(file.type);
}

function mimeToExt(mime: string): string {
	if (mime === 'image/png') return '.png';
	if (mime === 'image/webp') return '.webp';
	if (mime === 'image/jpeg') return '.jpg';
	if (mime === 'application/pdf') return '.pdf';
	if (mime === 'text/html') return '.html';
	if (mime === 'text/markdown') return '.md';
	if (
		mime ===
		'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
	) {
		return '.docx';
	}
	if (
		mime ===
		'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
	) {
		return '.xlsx';
	}
	if (
		mime ===
		'application/vnd.openxmlformats-officedocument.presentationml.presentation'
	) {
		return '.pptx';
	}
	return '.txt';
}

function mimeFromExt(ext: string): string {
	switch (ext) {
		case '.png':
			return 'image/png';
		case '.jpg':
		case '.jpeg':
			return 'image/jpeg';
		case '.webp':
			return 'image/webp';
		case '.pdf':
			return 'application/pdf';
		case '.html':
		case '.htm':
			return 'text/html';
		case '.md':
		case '.markdown':
			return 'text/markdown';
		case '.docx':
			return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
		case '.xlsx':
			return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
		case '.pptx':
			return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
		default:
			return 'text/plain';
	}
}
