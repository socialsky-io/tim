const REQ = require('request-promise-native');
const isDev = require('./isDev');


module.exports = class GitHub {

	constructor () {
		this.user_agent = 'GithubBrowser';
		this.reqCount = 0;
		this.fetchingUser = false;
	}

	fetchUser () {
		if (this.user || this.fetchingUser) return;
		this.fetchingUser = true;
		this.get('/user').then(res => {
			this.user = res;
			this.fetchingUser = false;
		});
	}

	setOptions (token, host = 'https://api.github.com') {
		this.host = host;
		this.token = token;
		this.fetchUser();
	}

	getOptions (url, qs = {}, fullResp = false) {
		const uri = `${this.host}${url}`;
		const headers = { 'User-Agent': 'GithubBrowser' };
		if (url.indexOf('projects') > -1) headers.Accept = 'application/vnd.github.inertia-preview+json';
		if (this.token) qs.access_token = this.token;

		return { uri, qs, headers, json: true, resolveWithFullResponse: fullResp, strictSSL: false };
	}

	get (url, params, fullResp = false) {
		this.reqCount++;
		if (isDev) {
			// console.log(url, params);
			// console.log('No of GH requests so far:', this.reqCount);
		}
		console.log('No of GH requests so far:', this.reqCount);
		const options = this.getOptions(url, params, fullResp);
		return REQ(options)
			.then(res => {
				if (!fullResp) return res;
				return { headers: res.headers, body: res.body };
			});
			// .catch(err => {
			// 	if (isDev) console.error(options.uri, err);
			// });
	}
};
