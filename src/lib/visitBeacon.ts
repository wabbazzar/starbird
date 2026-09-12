// Page-view beacon → the wabbazzar-ice dashboard. A plain GET that Caddy
// answers with 204; the access-log line becomes a `web.visit` event.
// Nothing is stored in the browser. Fires only on the production host so
// local dev and preview builds stay out of the numbers.
const HOST = /(^|\.)starbird42\.com$/;

export function sendVisit(): void {
	if (typeof window === 'undefined' || !HOST.test(window.location.hostname)) return;
	try {
		const u =
			'https://api.wabbazzar.com/v?app=starbird&path=' +
			encodeURIComponent(window.location.pathname) +
			'&ref=' +
			encodeURIComponent(document.referrer || '');
		fetch(u, { mode: 'no-cors', keepalive: true }).catch(() => {});
	} catch {
		/* never let analytics break the page */
	}
}
