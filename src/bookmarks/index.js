const Ractive = require('ractive');
const fade = require('ractive-transitions-fade');
const { EVENT, bookmarks, github, helper } = require('../services');
const $ = require('../util');

const BuildStatus = require('./build-status');

const DEFAULT_REPO_NAME = 'Pages';				// for ungrouped pages
const DEFAULT_PROJECTS_REPO_NAME = 'Projects';	// for ungrouped projects
const issueTypeCls = {
	pr: 'ion-ios-git-pull-request',
	issue: 'ion-ios-bug-outline',
	project: 'ion-ios-cube-outline',
	page: 'ion-ios-document-outline',
	default: 'ion-ios-document-outline',
};


const template = `
	{{#groupedBookmarks:repo}}
		<div class="repo-box">
			<h2>
				{{#if hasUrl }}
					<span class="hdr">{{repoShortName}}</span>
				{{else}}
					<a href="{{repoUrl}}" class="hdr" on-click="openRepo">{{repoShortName}}</a>
				{{/if}}
			</h2>
			<ul class="repo-box-issues">
				{{#items}}
					<li class="issue-box {{issueCls(this)}} {{state}} type-{{type}} {{unread ? 'unread' : ''}}" fade-in>
						<i class="issue-icon {{issueIcon(this)}}"></i>
						<a href="{{url}}" class="btn bookmark" title="{{id || name}}" on-click="openIssue">{{name}}</a>
						{{#if type === 'pr'}}<BuildStatus issue="{{this}}" />{{/if}}
					</li>
				{{/items}}
			</ul>
		</div>
	{{/groupedBookmarks}}
`;


const data = {
	bookmarks: [],
	issueIcon: iss => issueTypeCls[iss.type],
	issueCls: iss => {
		const repo = (iss.repo || '').replace(/[\/\.]/g, '-').toLowerCase();
		return iss.id ? `issue-${repo}-${iss.id}` : '';
	},
};



let throttled = null;
const throttle = () => {
	if (throttled) clearTimeout(throttled);
	throttled = setTimeout(() => { throttled = null; }, 1000);
};

function openIssue (e) {
	e.original.preventDefault();
	if (throttled) return throttle();	// if clicked during quiet time - throttle again
	throttle();
	const iss = e.get();
	if (iss) {
		iss.unread = false;
		bookmarks.setUnreadByUrl(iss.url, false);
		$.trigger(EVENT.url.change.to, iss.url);
	}
}


function openRepo (e) {
	$.trigger(EVENT.url.change.to, e.get().repoUrl);
	return false;
}


function addBookmark (issue) {
	issue = copleteIssueModel(issue);
	bookmarks.add(issue);
	data.bookmarks.push(issue);
	render(data.bookmarks);
	github.checkIssuesForUpdates([issue]).then(() => render(data.bookmarks));
}

function removeBookmark (issue) {
	const iss = Module.get('bookmarks').filter(i => i.url === issue.url)[0];
	if (!iss) return;
	$(`.${data.issueCls(iss)}`).animate({opacity: 1}, {opacity: 0}).then(() => {
		bookmarks.remove(issue);
		Module.set('bookmarks', Module.get('bookmarks').filter(i => i.url !== issue.url));
	});
}


function onUrlChanged (wv, issue) {
	if (!issue || !issue.url) return;
	const iss = data.bookmarks.filter(i => i.url === issue.url)[0];
	if (iss) iss.unread = false;
	Module.set('bookmarks', data.bookmarks);
	bookmarks.setUnreadByUrl(issue.url, false);
}


function refresh (reset) {
	if (Module && reset === true) {
		data.bookmarks = [];
		Module.reset(data);
	}

	bookmarks.get()
		.then(render)
		.then(github.checkIssuesForUpdates)
		.then(render);
}


function copleteIssueModel (iss) {
	if (!iss.repo) {
		if (helper.getPageActualTypeFromUrl(iss.url) === 'project') {
			iss.repo = DEFAULT_PROJECTS_REPO_NAME;
			iss.type = 'project';
		}
		else {
			iss.repo = DEFAULT_REPO_NAME;
			iss.type = 'page';
		}
	}
	iss.build = iss.build || {};
	return iss;
}



function render (issues) {
	issues = issues.map(copleteIssueModel);
	issues = helper.mergeArrays(issues, data.bookmarks);
	Module.set('bookmarks', issues);
	return issues;
}


function oninit () {
	$.on(EVENT.bookmark.add, addBookmark);
	$.on(EVENT.bookmark.remove, removeBookmark);
	$.on(EVENT.section.refresh, sectionRefresh);
	$.on(EVENT.section.change, sectionChanged);
	$.on(EVENT.url.change.done, onUrlChanged);
	this.on({ openRepo, openIssue });
}


function sectionRefresh (id) {
	if (id === 'bookmarks') refresh(true);
}

function sectionChanged (id) {
	if (id === 'bookmarks' && !data.bookmarks.length) refresh();
}

const Module = new Ractive({
	el: '#subnav .subnav-bookmarks .subnav-section-list',
	data,
	template,
	oninit,
	components: { BuildStatus },
	computed: {
		groupedBookmarks: function () {
			return helper.groupIssues(this.get('bookmarks'));
		}
	},
	transitions: { fade }
});

module.exports = Module;
