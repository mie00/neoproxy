#!/usr/bin/env node

var program = require('commander');
var integer = function(arg){
	return parseInt(arg)
};
var parse_limit = function(str){
	str = str.toString()
	var limit = parseInt(str);
	limit = isNaN(limit)?1:limit;
	if(~str.indexOf('k') || ~str.indexOf('K'))
		limit *= 1024;
	if(~str.indexOf('m') || ~str.indexOf('M'))
		limit *= 1024 * 1024;
	if(~str.indexOf('b'))
		limit *= 8;
	return limit;
};
program
	.version('0.2.0')
	.option('-l, --logging', 'enable logging')
	.option('-p, --port <port>','the port the proxy server listens to',integer,8087)
	.option('-L, --limit <bandwidth>','limit connection speed',parse_limit)
	.option('--interval <milliseconds>', 'the interval to calculate the limit (melliseconds)',integer,1000)
	.parse(process.argv);
	
var Proxy = require('./index');
var proxy = Proxy();
if(program.logging){
	console.log('Enabling logging');
	proxy.use(require('./examples/logging')(console.log));
}
if(program.limit){
	console.log('Enabling speed limit');
	proxy.use(require('./examples/speed_limit')(parse_limit(program.limit),program.interval));
}
console.log('starting the server');
var server = proxy.listen(program.port, function () {
	var host = server.address().address;
	var port = server.address().port;
	console.log('proxy server listening at http://'+host+':'+port);
});
