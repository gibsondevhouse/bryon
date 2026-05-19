import { z } from 'zod';
import { toolRegistry } from '../registry';

type PubChemSection = {
	TOCHeading?: string;
	Information?: Array<{
		Value?: {
			StringWithMarkup?: Array<{ String?: string }>;
		};
	}>;
	Section?: PubChemSection[];
};

type PubChemViewResponse = {
	Record?: {
		RecordTitle?: string;
		Section?: PubChemSection[];
	};
};

const lookupSdsArgsSchema = z.object({
	chemical: z
		.string()
		.min(1)
		.describe('Chemical name, CAS number, or molecular formula (e.g. "acetone", "67-64-1", "C3H6O")'),
	focus: z
		.string()
		.optional()
		.describe('Specific safety aspect to focus on (e.g. "first aid", "fire fighting", "exposure limits")'),
});

const lookupSdsResultSchema = z.object({
	name: z.string(),
	iupacName: z.string(),
	formula: z.string(),
	molecularWeight: z.string(),
	cid: z.number().int(),
	signal: z.string(),
	hazardStatements: z.array(z.string()),
	precautionaryCodes: z.array(z.string()),
	pubchemUrl: z.string(),
});

toolRegistry.register({
	name: 'lookup_sds',
	description:
		'Look up safety data for a chemical via PubChem. Returns GHS classification, hazard statements, signal word, and molecular properties. Use for SDS review, chemical hazard assessment, and regulatory compliance.',
	parameters: lookupSdsArgsSchema,
	returns: lookupSdsResultSchema,
	async execute(args, ctx) {
		const encodedName = encodeURIComponent(args.chemical);

		const cidRes = await fetch(
			`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodedName}/cids/JSON`,
			{ signal: ctx.signal },
		);
		if (!cidRes.ok) {
			throw new Error(`Chemical not found: "${args.chemical}". Try a different name or CAS number.`);
		}
		const cidData = (await cidRes.json()) as { IdentifierList?: { CID?: number[] } };
		const cid = cidData?.IdentifierList?.CID?.[0];
		if (!cid) {
			throw new Error(`No PubChem compound found for: "${args.chemical}"`);
		}

		const [propsRes, ghsRes] = await Promise.all([
			fetch(
				`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/property/IUPACName,MolecularFormula,MolecularWeight/JSON`,
				{ signal: ctx.signal },
			),
			fetch(
				`https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/${cid}/JSON?heading=GHS+Classification`,
				{ signal: ctx.signal },
			),
		]);

		const propsData = (await propsRes.json()) as {
			PropertyTable?: { Properties?: Array<Record<string, unknown>> };
		};
		const props = propsData?.PropertyTable?.Properties?.[0] ?? {};

		const ghsData = ghsRes.ok ? ((await ghsRes.json()) as PubChemViewResponse) : null;
		const sections = ghsData?.Record?.Section ?? [];

		const ghsSection = findSection(sections, 'GHS Classification');
		const signal = extractStrings(findSection(ghsSection?.Section ?? [], 'Signal')).join('') || '';
		const hazardStatements = extractStrings(findSection(ghsSection?.Section ?? [], 'GHS Hazard Statements'));
		const precautionaryCodes = extractStrings(
			findSection(ghsSection?.Section ?? [], 'Precautionary Statement Codes'),
		);

		return {
			name: ghsData?.Record?.RecordTitle ?? args.chemical,
			iupacName: String(props.IUPACName ?? ''),
			formula: String(props.MolecularFormula ?? ''),
			molecularWeight: String(props.MolecularWeight ?? ''),
			cid,
			signal,
			hazardStatements,
			precautionaryCodes,
			pubchemUrl: `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}#section=GHS-Classification`,
		};
	},
});

function findSection(
	sections: PubChemSection[],
	heading: string,
): PubChemSection | undefined {
	for (const s of sections) {
		if (s.TOCHeading === heading) return s;
	}
	return undefined;
}

function extractStrings(section: PubChemSection | undefined): string[] {
	if (!section) return [];
	const strings: string[] = [];
	for (const info of section.Information ?? []) {
		for (const swm of info.Value?.StringWithMarkup ?? []) {
			if (swm.String) strings.push(swm.String);
		}
	}
	return strings;
}
