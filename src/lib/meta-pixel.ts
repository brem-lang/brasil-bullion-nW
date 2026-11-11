export const META_PIXEL_ID = "1141837911869784";

/**
 * Only production builds load the pixel, so `npm run dev` sends nothing to Meta.
 * Without the base code fbq stays undefined and trackPageView/trackLead do nothing.
 */
export const META_PIXEL_ENABLED = import.meta.env.PROD;

/** Meta's base code: loads fbevents.js and sends the first PageView. */
export const META_PIXEL_SNIPPET = `!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${META_PIXEL_ID}');
fbq('track', 'PageView');`;

export const META_PIXEL_NOSCRIPT_URL = `https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`;

// Optional call: fbq is undefined if the base code did not run (tests, some blockers).
function track(event: "PageView" | "Lead") {
  (window as unknown as { fbq?: (cmd: "track", name: string) => void }).fbq?.("track", event);
}

/** For client-side navigations; the base code already covers the first page load. */
export const trackPageView = () => track("PageView");

/** Call only after the CRM has accepted the lead. */
export const trackLead = () => track("Lead");
