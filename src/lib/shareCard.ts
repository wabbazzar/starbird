import { base } from '$app/paths';
import { VALUE_BY_ID, type ValueId } from './values';

/**
 * Render a card-specific share image on an offscreen canvas and return
 * it as a PNG Blob. Each card produces a unique image — nothing is static.
 *
 * Dimensions: 1200×630 at 2× for retina. This is the OG standard
 * (1200×630) which looks good in iMessage, Slack, and link unfurlers.
 *
 * Canvas uses fonts already loaded by the page (DM Sans, DM Mono,
 * Bebas Neue via Google Fonts link in app.html). If fonts aren't ready
 * the text renders in a fallback — acceptable degradation.
 */

const W = 1200;
const H = 630;
const SCALE = 2;

const BG = '#0d0d0d';
const SURFACE = '#1a1a1a';
const INK = '#f0ebe3';
const INK_MUTED = '#a09890';
const INK_FAINT = '#666';
const PRIMARY = '#5fc4d0';
const GOLD = '#e8a83e';
const AVOID = '#e06c5f';
const ALIGN = '#5fbf7a';

let logoCache: HTMLImageElement | null = null;

function loadLogo(): Promise<HTMLImageElement> {
	if (logoCache) return Promise.resolve(logoCache);
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.crossOrigin = 'anonymous';
		img.onload = () => {
			logoCache = img;
			resolve(img);
		};
		img.onerror = reject;
		img.src = `${base}/logo-dark.png`;
	});
}

function wrapText(
	ctx: CanvasRenderingContext2D,
	text: string,
	x: number,
	y: number,
	maxWidth: number,
	lineHeight: number,
	maxLines: number
): number {
	const words = text.split(' ');
	let line = '';
	let lineCount = 0;

	for (let i = 0; i < words.length; i++) {
		const test = line + words[i] + ' ';
		const metrics = ctx.measureText(test);
		if (metrics.width > maxWidth && line !== '') {
			lineCount++;
			if (lineCount > maxLines) {
				// Truncate with ellipsis
				ctx.fillText(line.trim() + '…', x, y);
				return y + lineHeight;
			}
			ctx.fillText(line.trim(), x, y);
			line = words[i] + ' ';
			y += lineHeight;
		} else {
			line = test;
		}
	}
	if (line.trim()) {
		lineCount++;
		if (lineCount > maxLines) {
			ctx.fillText(line.trim().slice(0, -3) + '…', x, y);
		} else {
			ctx.fillText(line.trim(), x, y);
		}
		y += lineHeight;
	}
	return y;
}

export interface ShareCardOpts {
	type: 'brand' | 'firm';
	name: string;
	category?: string;
	ownership?: string;
	harmScore?: number;
	verdict: string;
	verdictKind: 'avoid' | 'align' | 'neutral';
	tags: { value: ValueId; variant: 'avoid' | 'align' | 'neutral' }[];
	why: string;
}

export async function renderShareCard(opts: ShareCardOpts): Promise<Blob> {
	const canvas = document.createElement('canvas');
	canvas.width = W * SCALE;
	canvas.height = H * SCALE;
	const ctx = canvas.getContext('2d')!;
	ctx.scale(SCALE, SCALE);

	// ── Background ────────────────────────────────────────────────
	ctx.fillStyle = BG;
	ctx.fillRect(0, 0, W, H);

	// Card area
	const cardX = 32;
	const cardY = 72;
	const cardW = W - 64;
	const cardH = H - 100;
	ctx.fillStyle = SURFACE;
	ctx.beginPath();
	ctx.roundRect(cardX, cardY, cardW, cardH, 16);
	ctx.fill();

	// Left accent stripe
	const accentColor =
		opts.verdictKind === 'avoid' ? AVOID : opts.verdictKind === 'align' ? ALIGN : INK_FAINT;
	ctx.fillStyle = accentColor;
	ctx.fillRect(cardX, cardY + 14, 5, cardH - 28);

	// ── Logo + STARBIRD header ─────────────────────────────────────
	try {
		const logo = await loadLogo();
		ctx.drawImage(logo, 44, 10, 50, 50);
	} catch {
		// skip logo
	}
	ctx.font = "700 40px 'Bebas Neue', sans-serif";
	ctx.fillStyle = INK;
	ctx.letterSpacing = '3px';
	ctx.fillText('STARBIRD', 104, 48);
	ctx.letterSpacing = '0px';

	// ── Card content ───────────────────────────────────────────────
	const cx = cardX + 40;
	const maxTextW = cardW - 80;
	let cy = cardY + 50;

	// Name — large display
	ctx.font = "700 44px 'Bebas Neue', sans-serif";
	ctx.fillStyle = INK;
	ctx.letterSpacing = '2px';
	const displayName = opts.name.toUpperCase();
	ctx.fillText(displayName, cx, cy);

	// Category badge next to name
	if (opts.category) {
		const nameW = ctx.measureText(displayName).width;
		ctx.font = "500 16px 'DM Mono', monospace";
		ctx.fillStyle = INK_FAINT;
		ctx.letterSpacing = '2px';
		ctx.fillText(opts.category.toUpperCase(), cx + nameW + 24, cy);
	}
	ctx.letterSpacing = '0px';

	cy += 18;

	// Ownership or harm score
	if (opts.ownership) {
		ctx.font = "400 22px 'DM Sans', sans-serif";
		ctx.fillStyle = INK_MUTED;
		ctx.fillText(opts.ownership, cx, cy + 22);
		cy += 36;
	}
	if (opts.harmScore !== undefined) {
		ctx.font = "700 26px 'Bebas Neue', sans-serif";
		ctx.fillStyle = opts.harmScore >= 75 ? AVOID : PRIMARY;
		ctx.fillText(`HARM SCORE: ${opts.harmScore}/100`, cx, cy + 22);
		cy += 36;
	}

	cy += 4;

	// Verdict
	ctx.font = "500 16px 'DM Mono', monospace";
	ctx.fillStyle =
		opts.verdictKind === 'avoid' ? AVOID : opts.verdictKind === 'align' ? ALIGN : INK_FAINT;
	ctx.letterSpacing = '2px';
	ctx.fillText(opts.verdict.toUpperCase(), cx, cy + 16);
	ctx.letterSpacing = '0px';
	cy += 36;

	// Value tag chips
	if (opts.tags.length > 0) {
		let chipX = cx;
		for (const tag of opts.tags) {
			const def = VALUE_BY_ID[tag.value];
			if (!def) continue;
			const chipText = `${def.icon} ${def.label}`;
			ctx.font = "500 15px 'DM Mono', monospace";
			const tw = ctx.measureText(chipText).width;
			const chipW = tw + 24;
			const chipH = 32;

			// Chip fill
			if (tag.variant === 'avoid') ctx.fillStyle = 'rgba(224, 108, 95, 0.18)';
			else if (tag.variant === 'align') ctx.fillStyle = 'rgba(95, 191, 122, 0.18)';
			else ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
			ctx.beginPath();
			ctx.roundRect(chipX, cy, chipW, chipH, 16);
			ctx.fill();

			// Chip border
			ctx.strokeStyle =
				tag.variant === 'avoid' ? AVOID : tag.variant === 'align' ? ALIGN : INK_FAINT;
			ctx.lineWidth = 1.5;
			ctx.stroke();

			// Chip label
			ctx.fillStyle =
				tag.variant === 'avoid' ? AVOID : tag.variant === 'align' ? ALIGN : INK_MUTED;
			ctx.fillText(chipText, chipX + 12, cy + 21);

			chipX += chipW + 10;
			if (chipX > cx + maxTextW - 60) {
				chipX = cx;
				cy += chipH + 8;
			}
		}
		cy += 44;
	}

	// Divider line
	ctx.strokeStyle = 'rgba(255,255,255,0.08)';
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(cx, cy - 6);
	ctx.lineTo(cx + maxTextW, cy - 6);
	ctx.stroke();

	// Why text (wrapped, max 5 lines)
	ctx.font = "400 19px 'DM Sans', sans-serif";
	ctx.fillStyle = INK_MUTED;
	cy = wrapText(ctx, opts.why, cx, cy + 10, maxTextW, 26, 5);

	// ── Footer ─────────────────────────────────────────────────────
	ctx.font = "400 15px 'DM Mono', monospace";
	ctx.fillStyle = PRIMARY;
	ctx.fillText('→ wabbazzar.github.io/starbird', cx, cardY + cardH - 16);

	// ── Export ──────────────────────────────────────────────────────
	return new Promise<Blob>((resolve, reject) => {
		canvas.toBlob(
			(blob) => {
				if (blob) resolve(blob);
				else reject(new Error('canvas.toBlob returned null'));
			},
			'image/png',
			1.0
		);
	});
}
