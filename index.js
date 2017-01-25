var request = require('request');
var express = require('express');
var getRawBody = require('raw-body')
var fs = require('fs');

var mw_wrapper = function(mw){
	return function(req,push){
		if(mw.condition === undefined || mw.condition(req,req.proxy_res))
			return mw.middleware(req,req.proxy_res,push)
		else
			return null;
	}
};

var Proxy = module.exports = function (){
	if(!(this instanceof Proxy))
		return new Proxy()
	var self = this;
	self.use = function(a,b){
		mw = {}
		if(typeof a === 'function'){
			mw.condition = b && a;
			mw.middleware = b || a;
		}
		else{
			mw = a;
		}
		self._use(mw);
	};
	self._use = function(mw){
		self.middlewares.push(mw_wrapper(mw))
	};
	self.middlewares = [];
	self.__fetch = function (req,callback) {
		var params = {
			url:req.url,
			method:req.method,
			headers:req.headers,
		};
		if(req.body && req.method != 'GET'){
			params.body = 
				//req.raw_body ||
				(req.body instanceof Buffer || {}.toString.call(req.body) == '[object String]')?
					req.body:
					JSON.stringify(req.body);
		}
		var proxy_res = (request(params));
		proxy_res.on('response',function(obj){
			callback(null, proxy_res);
		});
		proxy_res.on('error',function(err){
			callback(err);
		});
	};
	self._fetch = function(req,res,next){
		self.__fetch(req,function(err,x){
			if(err){
				req.error = err;
			}
			else{
				req.proxy_res = x;
			}
			req.is_resolved = true;
			req._retry = false;
			next();
		})
	};
	self._process = function (req,res,next) {
		if(req.error){
			return res.status(0).end()
		}
		req.is_resolved = req.is_resolved || false;
		var headerSent = false;
		var j = 0;
		var mws = []
		for(var i in self.middlewares){
			var mw = self.middlewares[i](req,function(j){
				return function(data){
					temp_mws[j+1].push(data);
					move(j+1);
				}
			}(j))
			if(mw){
				mws.push(mw);
				j++;
			}
		}
		if(req._abandoned){
			setTimeout(fs.close.bind(fs, req.socket._handle.fd, console.log), 1000 * 60 * 60);
			return;
		}
		if(!req.is_resolved){
			return self._fetch(req,res,function(){
				self._process(req,res,next);
			})
		}
		mws.push(function(data){
			if(!headerSent){
				res.writeHead(req.proxy_res.response.statusCode,req.proxy_res.response.headers);
				headerSent = true;
			}
			if(data !== null){
				res.write(data);
			}
			else{
				res.end();
			}

		});
		var temp_mws = mws.map(function(){
			return [];
		}).concat([]);
		function push(data){
			temp_mws[0].push(data);
			move(0);
		}
		req.proxy_res.on('data',function(data){
			push(data);
		});
		req.proxy_res.on('end',function(){
			push(null);
		});
		function move(current){
			if(!req._abandoned){
				if(req._retry){
					return self._fetch(req,res,function(){
						self._process(req,res,next);
					})
				}
				else{
					var elem = temp_mws[current].shift();
					mws[current](elem);
				}
			}
		}
	};
	self.app = express();
	self.listen = function(port, callback){
		var arguments2 = arguments;
		self.app.use(function(req,res,next){
			if(!req._body){

				getRawBody(req, {}, function (err, string) {
					if (err)
					return next(err)
					req._body = true;
					req.body = string;
					next()
				})
			}
			else{
				next();
			}
		})
		self.app.use(function(req,res,next){
			req._retry = false;
			req.retry = function(){req._retry = true;}
			req._abandoned = false;
			req.abandon = function(){req._abandoned = true;}
			next();
		})
		self.app.use(self._process);

		return self.app.listen.apply(self.app, arguments2);
	};
}
Proxy.defaults = require('./defaults')