import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { MAX_FILE_BYTES, isAllowedUpload, saveUpload } from './uploads';

const tempDirs: string[] = [];

afterEach(() => {
	for (const dir of tempDirs.splice(0)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

describe('uploads', () => {
	it('classifies supported rich-chat upload types', () => {
		const supported = [
			file('photo.png', 'image/png', 'x'),
			file('photo.jpg', 'image/jpeg', 'x'),
			file('photo.webp', 'image/webp', 'x'),
			file('doc.pdf', 'application/pdf', 'x'),
			file('notes.txt', 'text/plain', 'x'),
			file('notes.md', 'text/markdown', 'x'),
			file('page.html', 'text/html', 'x'),
			file('doc.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'x'),
			file('sheet.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'x'),
			file('deck.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'x'),
		];

		for (const item of supported) {
			expect(isAllowedUpload(item), item.name).toBe(true);
		}

		expect(isAllowedUpload(file('script.sh', 'application/x-sh', 'echo no'))).toBe(false);
	});

	it('extracts readable text for each supported document type', async () => {
		const cases = [
			{
				name: 'doc.pdf',
				mime: 'application/pdf',
				body: minimalPdf('Hello PDF'),
				expected: 'Hello PDF',
			},
			{
				name: 'notes.txt',
				mime: 'text/plain',
				body: 'Plain text content',
				expected: 'Plain text content',
			},
			{
				name: 'notes.md',
				mime: 'text/markdown',
				body: '# Markdown title\n\nImportant checklist',
				expected: 'Markdown title',
			},
			{
				name: 'page.html',
				mime: 'text/html',
				body: '<html><body><h1>HTML title</h1><p>Readable body</p></body></html>',
				expected: 'Readable body',
			},
			{
				name: 'doc.docx',
				mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
				body: zipEntries({ 'word/document.xml': '<w:document><w:t>Hello DOCX</w:t></w:document>' }),
				expected: 'Hello DOCX',
			},
			{
				name: 'sheet.xlsx',
				mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
				body: zipEntries({
					'xl/sharedStrings.xml': '<sst><si><t>Hello XLSX</t></si></sst>',
					'xl/worksheets/sheet1.xml': '<worksheet><sheetData><row><c><v>0</v></c></row></sheetData></worksheet>',
				}),
				expected: 'Hello XLSX',
			},
			{
				name: 'deck.pptx',
				mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
				body: zipEntries({ 'ppt/slides/slide1.xml': '<p:sld><a:t>Hello PPTX</a:t></p:sld>' }),
				expected: 'Hello PPTX',
			},
		];

		for (const item of cases) {
			const dataDir = makeTempDir();
			const attachment = await saveUpload('chat-docs', file(item.name, item.mime, item.body), dataDir);

			expect(attachment.kind, item.name).toBe('document');
			expect(attachment.textPath, item.name).toBeTruthy();
			expect(existsSync(attachment.textPath ?? ''), item.name).toBe(true);
			expect(readFileSync(attachment.textPath ?? '', 'utf8'), item.name).toContain(item.expected);
			expect(attachment.textBytes, item.name).toBeGreaterThan(0);
		}
	});

	it('enforces the per-file size limit before writing', async () => {
		const dataDir = makeTempDir();
		const oversized = file('big.txt', 'text/plain', Buffer.alloc(MAX_FILE_BYTES + 1));

		await expect(saveUpload('chat-docs', oversized, dataDir)).rejects.toThrow('25 MB');
	});
});

function makeTempDir(): string {
	const dir = mkdtempSync(join(tmpdir(), 'bryon-upload-test-'));
	tempDirs.push(dir);
	return dir;
}

function file(name: string, type: string, body: string | Buffer): File {
	const part =
		typeof body === 'string'
			? body
			: (body.buffer.slice(
					body.byteOffset,
					body.byteOffset + body.byteLength,
				) as ArrayBuffer);
	return new File([part], name, { type });
}

function minimalPdf(text: string): Buffer {
	const escapedText = text.replace(/[\\()]/g, '\\$&');
	const stream = `BT /F1 24 Tf 100 700 Td (${escapedText}) Tj ET`;
	const objects = [
		'1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
		'2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
		'3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj',
		'4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
		`5 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj`,
	];

	let pdf = '%PDF-1.4\n';
	const offsets = [0];
	for (const object of objects) {
		offsets.push(Buffer.byteLength(pdf));
		pdf += `${object}\n`;
	}

	const xrefStart = Buffer.byteLength(pdf);
	pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
	for (let index = 1; index < offsets.length; index += 1) {
		pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
	}
	pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

	return Buffer.from(pdf);
}

function zipEntries(entries: Record<string, string>): Buffer {
	const localParts: Buffer[] = [];
	const centralParts: Buffer[] = [];
	let offset = 0;

	for (const [name, value] of Object.entries(entries)) {
		const filename = Buffer.from(name);
		const data = Buffer.from(value);
		const crc = crc32(data);
		const local = Buffer.alloc(30 + filename.length);
		local.writeUInt32LE(0x04034b50, 0);
		local.writeUInt16LE(20, 4);
		local.writeUInt16LE(0, 6);
		local.writeUInt16LE(0, 8);
		local.writeUInt16LE(0, 10);
		local.writeUInt16LE(0, 12);
		local.writeUInt32LE(crc, 14);
		local.writeUInt32LE(data.length, 18);
		local.writeUInt32LE(data.length, 22);
		local.writeUInt16LE(filename.length, 26);
		local.writeUInt16LE(0, 28);
		filename.copy(local, 30);
		localParts.push(local, data);

		const central = Buffer.alloc(46 + filename.length);
		central.writeUInt32LE(0x02014b50, 0);
		central.writeUInt16LE(20, 4);
		central.writeUInt16LE(20, 6);
		central.writeUInt16LE(0, 8);
		central.writeUInt16LE(0, 10);
		central.writeUInt16LE(0, 12);
		central.writeUInt16LE(0, 14);
		central.writeUInt32LE(crc, 16);
		central.writeUInt32LE(data.length, 20);
		central.writeUInt32LE(data.length, 24);
		central.writeUInt16LE(filename.length, 28);
		central.writeUInt16LE(0, 30);
		central.writeUInt16LE(0, 32);
		central.writeUInt16LE(0, 34);
		central.writeUInt16LE(0, 36);
		central.writeUInt32LE(0, 38);
		central.writeUInt32LE(offset, 42);
		filename.copy(central, 46);
		centralParts.push(central);

		offset += local.length + data.length;
	}

	const centralDirectory = Buffer.concat(centralParts);
	const end = Buffer.alloc(22);
	end.writeUInt32LE(0x06054b50, 0);
	end.writeUInt16LE(0, 4);
	end.writeUInt16LE(0, 6);
	end.writeUInt16LE(centralParts.length, 8);
	end.writeUInt16LE(centralParts.length, 10);
	end.writeUInt32LE(centralDirectory.length, 12);
	end.writeUInt32LE(offset, 16);
	end.writeUInt16LE(0, 20);

	return Buffer.concat([...localParts, centralDirectory, end]);
}

function crc32(data: Buffer): number {
	let crc = 0xffffffff;
	for (const byte of data) {
		crc ^= byte;
		for (let index = 0; index < 8; index += 1) {
			crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
		}
	}
	return (crc ^ 0xffffffff) >>> 0;
}
