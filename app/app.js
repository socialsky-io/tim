const $ = require('./app/util');
const init = c => require(`./app/${c}`).init();
const components = [
	'header',
	'frame',
	'sidebar',
	'addressbar',
	'settings',
	'notifications',
	'history',
	'search',
	'main-menu',
	'contextmenu',
];

components.forEach(init);


const ipc = require('electron').ipcRenderer;
const EVENT = require('./app/db/events');
ipc.on('event', (ev, name) => $.trigger(name));
ipc.on(EVENT.frame.goto, (ev, url) => $.trigger(EVENT.frame.goto, url));

document.addEventListener('click', e => $.trigger(EVENT.document.clicked, e));
