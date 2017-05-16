'use strict';

var $ = require('../util');

var _require = require('../services'),
    config = _require.config,
    EVENT = _require.EVENT,
    bookmarks = _require.bookmarks;

var isReady = false,
    el = null,
    issueBox = null,
    starBox = void 0,
    lastShortUrl = '',
    lastFullUrl = '',
    lastIssue = '',
    searchTerm = null;

var baseUrl = $.rtrim(config.get('baseUrl'), '/');
var repoToSearch = config.get('repoToSearch');

function getUnfocusedText() {
	if (searchTerm) return searchTerm;
	if (!lastIssue || !lastIssue.name) return lastShortUrl || '';
	var mod = lastIssue.repo ? lastIssue.repo.split('/').pop() : '';
	var url = mod + ' / ' + lastIssue.name;
	return url.replace(/(^[\/\s]+)|([\/\s]+$)/g, '');
}

function getFocusedText() {
	if (searchTerm) return searchTerm;
	return lastFullUrl;
}

function gotoIssue(id) {
	var url = [baseUrl, repoToSearch, 'issues', id].join('/');
	gotoUrl(url);
}

function star(exists) {
	starBox.toggleClass('is-starred', !!exists);
	$.trigger(EVENT.bookmark.exists, !!exists);
}

// BaseURL/Group/RepoName/issues?q=is:open is:issue...
function getSearchUrl(q) {
	var query = 'issues?q=is:open is:issue ' + q;
	return [baseUrl, repoToSearch, query].join('/');
}

function checkIfBookmarked(url) {
	if (url.indexOf('#') > -1) url = url.substr(0, url.indexOf('#'));
	bookmarks.getByUrl(url).then(star);
}

function gotoUrl(url) {
	searchTerm = null;

	if (url) el[0].value = url;
	url = el[0].value.trim();

	var validUrl = $.parseUrl(url);

	if (!validUrl) {
		// not a URL - do search
		searchTerm = url;
		url = getSearchUrl(url);
	}

	star(false);
	if (url) $.trigger(EVENT.frame.goto, url);
	$.trigger(EVENT.address.input.end);
}

function onUrlChanged(webview, issue) {
	if (issue) searchTerm = null;

	lastFullUrl = config.get('state.url');
	lastShortUrl = shortenUrl(lastFullUrl);
	lastIssue = issue || {};

	el[0].value = getUnfocusedText();
	issueBox[0].value = issue && issue.id ? issue.id : '';

	if (issue && issue.url) checkIfBookmarked(issue.url);
}

function shortenUrl() {
	var url = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';

	if (url.indexOf('?q=') > -1) {
		// it's search url
		return searchTerm = url.split('?q=').pop().replace(/is(:|%3A)(issue|open|closed)/g, '').replace(/(%20|\+)/g, ' ').trim();
	}
	return url.replace(config.get('baseUrl'), '').replace('pull/', '').replace('issues/', '').split('#').shift();
}

function focusAddressbar() {
	setTimeout(function () {
		el[0].select();
	}, 10);
}

function focusIssuebox() {
	setTimeout(function () {
		issueBox[0].select();
	}, 10);
}

function onFocus() {
	el[0].value = getFocusedText();
	el[0].select();
}

function onBlur() {
	el[0].value = getUnfocusedText();
}

function onKeyPress(e) {
	if (e.key === 'Enter') return gotoUrl();
}

function onKeyDown(e) {
	if (e.key === 'ArrowDown') return $.trigger(EVENT.history.focus);
	if (e.key === 'Escape') {
		e.target.value = getFocusedText();
		e.target.select();
		$.trigger(EVENT.address.input.end);
	}
}

function onInput(e) {
	$.trigger(EVENT.address.input.key, e);
}

function onIssueBoxFocus(e) {
	e.target.select();
	$.trigger(EVENT.address.input.end);
}

function onIssueBoxKeydown(e) {
	if (!$.isNumberField(e)) return e.preventDefault();
}

function onIssueBoxKeyup(e) {
	var val = e.target.value;
	if (!/^\d*$/.test(val)) e.target.value = parseInt(val, 10) || '';
}

function onIssueBoxPaste(e) {
	var pasteText = e.clipboardData && e.clipboardData.getData('Text');
	if (!/^\d*$/.test(pasteText)) e.preventDefault();
}

function init() {
	if (isReady) return;

	el = $('.addressbar');
	issueBox = $('.issue-id-bar');
	starBox = $('header .star-box');

	el.on('focus', onFocus);
	el.on('blur', onBlur);
	el.on('keydown', onKeyDown);
	el.on('keypress', onKeyPress);
	el.on('input', onInput);

	issueBox.on('focus', onIssueBoxFocus);
	issueBox.on('keypress', function (e) {
		if (e.key === 'Enter') gotoIssue(e.target.value);
	});
	issueBox.on('keydown', onIssueBoxKeydown);
	issueBox.on('keyup', onIssueBoxKeyup);
	issueBox.on('paste', onIssueBoxPaste);

	$.on(EVENT.url.change.to, gotoUrl);
	$.on(EVENT.url.change.done, onUrlChanged);
	$.on(EVENT.address.focus, focusAddressbar);
	$.on(EVENT.address.issueFocus, focusIssuebox);

	isReady = true;
}

module.exports = {
	init: init
};