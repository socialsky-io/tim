const { session, getGlobal } = require('electron').remote;
const ses = session.fromPartition('persist:github');
const args = getGlobal('appArgs');


const { config, EVENT, helper, isDev, WebView } = require('../services');

const $ = require('../util');
const realnames = require('../realnames');
const swiping = require('./swiping');
const loginUrl = () => `${config.get('baseUrl')}login`;
const login2Url = () => `${config.get('baseUrl')}sessions/two-factor`;

let frame, webview, isReady = false, pageZoom = 0, isLoggedIn = false, lastURL = '', urlLoading = '';

const webviewHandlers = {
	documentClicked: () => $.trigger(EVENT.document.clicked),
	openInBrowser: url => helper.openInBrowser(url),
	isLogged: itIs => {
		if (itIs && !isLoggedIn) {				// wasn't but now it is!
			isLoggedIn = true;
			$.trigger(EVENT.notifications.reload);
		}
		else if (!itIs && !isLoggedIn) {		// wasn't and still isn't!
			if (urlLoading === loginUrl() || urlLoading === login2Url()) return;
			if (urlLoading.includes('/saml2/') || urlLoading.includes('/sso/')) return;
			gotoUrl(loginUrl());
		}
		if (!config.get('baseUrl')) $.trigger(EVENT.settings.show);
	},
	domChanged: onRendered,
};


const gotoActions = {
	prev: () => { if (webview[0].canGoBack()) webview[0].goBack(); },
	next: () => { if (webview[0].canGoForward()) webview[0].goForward(); },
	refresh: () => webview[0].reload(),
	stop: () => webview[0].stop()
};


function gotoUrl (where) {
	$.trigger(EVENT.search.stop);
	const isEvent = (where instanceof Event);
	urlLoading = (isEvent ? where.url : where);
	if (typeof urlLoading !== 'string' || !urlLoading || !webview.length) return;
	if (urlLoading in gotoActions) gotoActions[urlLoading]();
	else if (!isEvent && webview[0].loadURL) webview[0].loadURL(urlLoading);
}



function initialURL (initial) {
	if (initial && args) {
		const url = $.parseUrl(args.pop());
		if (url) return url;
	}
	if (initial && config.get('state.url')) return config.get('state.url');
	return loginUrl();
}


function purge () {
	config.clear();
	webview[0].clearHistory();
	ses.clearStorageData(webviewHandlers.isLogged);
	setTimeout(() => {
		gotoUrl(initialURL(true));
		helper.setBadge(0);
		$.trigger(EVENT.section.badge, 'notifications', 0);
		$.trigger(EVENT.section.badge, 'myissues', 0);
		$.trigger(EVENT.section.badge, 'bookmarks', 0);
		$.trigger(EVENT.notifications.reload);
	});
}



function onNavigationStart () {
	$.trigger(EVENT.search.stop);
	config.set('state.url', webview[0].getURL());
	$.trigger(EVENT.url.change.done, webview[0]);
}

function onNavigationError (er) {
	if (er.errorDescription === 'ERR_NAME_NOT_RESOLVED') $.trigger(EVENT.connection.error.show);
	else if (isDev) console.log('NavigationError:', er);
}

function onRendered (url, issue) {
	if (issue.url.indexOf('#') > -1) issue.url = issue.url.substr(0, issue.url.indexOf('#'));
	issue.url = $.rtrim(issue.url, '/files');
	issue.url = $.rtrim(issue.url, '/commits');

	config.set('state.url', url);
	config.set('state.issue', issue);
	realnames(webview[0]);
	if (lastURL !== url) $.trigger(EVENT.url.change.done, webview[0], issue);
	else $.trigger(EVENT.frame.domchanged, issue);
	lastURL = url;
}

function loadingStart () {
	if (!urlLoading) urlLoading = webview.attr('src');
	const pageType = helper.getPageTypeFromUrl(urlLoading);

	webview.skeleton.attr('class', `skeleton ${pageType}`);
	frame.addClass('loading');
	webview[0].focus();
	$.trigger(EVENT.url.change.start);
}

function loadingStop () {
	frame.removeClass('loading');
	$.trigger(EVENT.url.change.end);
	urlLoading = '';
}


function setZoom (n) {
	pageZoom = (n === 0 ? 0 : pageZoom + n);
	webview[0].send('zoom', pageZoom);
}



function init () {
	if (isReady) return;

	const skeletonHtml = '<div class="skeleton"><div class="skeleton-header"></div><div class="skeleton-sidebar"></div><div class="skeleton-main"></div><div class="skeleton-shine"></div></div>';

	frame = $('#frame');

	webview = WebView({
		url: initialURL(true),
		renderTo: frame,
		js: `${__dirname}/webview.js`,
		css: `${__dirname}/webview.css`,
		msgHandlers: webviewHandlers,
		skeletonHtml,
		events: {
			focus: () => $.trigger(EVENT.frame.focused),
			'will-navigate': gotoUrl,
			'did-navigate-in-page': onNavigationStart,
			'did-fail-load': onNavigationError,
			'did-start-loading': loadingStart,
			'did-stop-loading': loadingStop,
		},
	});

	$.on(EVENT.frame.goto, gotoUrl);
	$.on(EVENT.frame.devtools, webview.toggleDevTools);
	$.on(EVENT.frame.purge, purge);
	$.on(EVENT.settings.changed, () => gotoUrl(initialURL()));
	$.on(EVENT.frame.lookup, () => webview[0].showDefinitionForSelection());

	$.on(EVENT.frame.zoomout, () => setZoom(-1));
	$.on(EVENT.frame.zoomin, () => setZoom(1));
	$.on(EVENT.frame.resetzoom, () => setZoom(0));
	$.on(EVENT.window.focus, () => webview[0].focus());


	swiping(frame, webview);

	isReady = true;
}


module.exports = {
	init
};
