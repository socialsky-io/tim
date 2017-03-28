const GitHub = require('./class.gh');
const jenkins = require('./jenkins');
const config = require('./config');
const isDev = require('electron-is-dev');

const hostname = isDev ? 'https://api.github.com' : config.get('baseUrl') + 'api/v3';
const github = new GitHub(config.get('ghToken'), hostname);
const ci_url = config.get('ciUrl');



/*** TRANSFORMERS *********************************************************************************/
function getTotalFromNotificationsHeader (headers) {
	const lastPage = headers.link.split(',').pop();
	let total = 0;
	if (lastPage.indexOf('rel="last"') > -1) {
		const pages = lastPage.match(/^.*page=(\d+).*$/);
		if (pages && pages.length) total = pages[1];
		total = Math.min(total, 9999);
	}
	return total;
}

function getCItargetUrlFromStatuses (statuses) {
	if (!statuses || !statuses.length || !ci_url) return;
	const status = statuses
		.filter(s => s.target_url)
		.filter(s => s.target_url.indexOf(ci_url) > -1)[0];
	return status && status.target_url || '';
}


function getJenkinsStatus (pr, stat) {
	const url = getCItargetUrlFromStatuses(stat.statuses);
	if (!url) return { result: stat.state };
	pr.buildUrl = url;
	return jenkins.getStatus(url);
}
/**************************************************************************************************/




function getUserById (id) {
	return github.get(`/users/${id}`).then(res => res ? { id, name: res.name } : { id });
}


function getNotificationsCount (participating = true) {
	return github.get('/notifications', { participating, per_page: 1 }, true)
		.then(res => getTotalFromNotificationsHeader(res.headers));
}


function getProjects () {
	return github.get(`/repos/${config.get('repoToSearch')}/projects`);
}


function getCommitStatuses (repo, sha) {
	return github.get(`/repos/${repo}/commits/${sha}/status`);

}


function getBuildStatus (pr) {
	return github.get(`/repos/${pr.repo}/pulls/${pr.id}`)
		.then(res => getCommitStatuses(pr.repo, res.head.sha))
		.then(res => getJenkinsStatus(pr, res));
}


function checkForUnreadComments (issue) {
	let params = {};
	if (issue.updated_at) params.since = new Date(issue.updated_at).toISOString();
	return github.get(`/repos/${issue.repo}/issues/${issue.id}/comments`, params)
		.then(res => {
			if (res.length) issue.unread = true;
			return issue;
		});
}


function checkIssuesForUpdates (issues) {
	issues = issues
		.filter(i => i.type in { pr: 1, issue: 1 } && !i.unread) // ignore when already marked as unread
		.map(checkForUnreadComments);
	return Promise.all(issues).then(res => res.filter(i => i.unread));
}


module.exports = {
	getNotificationsCount,
	getBuildStatus,
	getProjects,
	getUserById,
	checkIssuesForUpdates,
};
