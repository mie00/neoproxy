# NeoProxy

NeoProxy is a node.js proxy server based on express.js and request modules, that can be customized with plugins.

## Installation

At your project's home directory:

`npm install --save neoproxy`

## Plugins (examples [below](#examples))

Plugins are used to customize neoproxy behavior. It is called on every request in series. It is a json object consisting of two functions
1. condition: this is an optional function that returns true or false specifying whether this plugin will be used for the request.
2. middleware: this is the function that have the real logic, it is called once for each request that passes the request. It returns a function that is called for every chunk of data that is available in the response. the latter function just pushes the data (or any other thing) to the next plugin until it is transmitted to the client. Each plugin is considered finished when it pushes null to the next plugin.

### Plugins API

#### Plugin object

It consists of two attributes as explained above

1. condition
  * arguments:
    1. req: request came from the client
    2. res: response came from the server (if it exists)
  * returns:
    * boolean: weather or not this plugin will be used for this request
2. middleware
  * arguments:
    1. req: request came from the client
    2. res: response came from the server (if it exists)
    3. push: the function to push each chunk of data when it is finished.
  * returns:
    * a function: accepts the chunk of data that is pushed to this plugin, or null as the last chunk in the request.

#### Request object:

It is an express request object with added attributes

1. req.is_resolved: Specifies if the req is resolved or not, as the request is used on every plugin twice, once before it's resolved and once after.

2. req.retry(): It's a function that to be called if the plugin wants the proxy server to resolve the request again, It can be useful in cases of changing the request based on the response. this method should be called before this plugin call push for this request.

3. req.body: By default, this contains the body of the request that came from the client as a buffer, you can use any body parser middleware that is supported by express instead, for example `proxy.app.use(require('body-parser').urlencoded({ extended: false }))`.

  if it is a buffer or a string it will be passed to the server without modification, else it will be stringified as a json object using `JSON.stringify`.

4. req.abandon(): It's a function that tells the proxy server to abandon the connection.

#### Response object

It is a response object of the module [require](https://github.com/request/request), although you shouldn't **unless you know what you are doing** bind it to another stream or add an event listener to it, as this is done internally in the proxy.

#### The proxy instance

The proxy server instance has three methods
1. use: this is where you can attach plugins to the proxy using either
  * `proxy.use({condition:function(){/* condition */},middleware:function(){/* middleware */}})`
  * `proxy.use({middleware:function(){/* middleware */}})`
  * `proxy.use(function(){/* condition */},function(){/* middleware */})`
  * `proxy.use(function(){/* middleware */})`
2. app: this is the express instance that is used internally within the app, feel free to add any express middle-wares you like.
3. listen: this is the function called to start the proxy server it takes two arguments port, callback.

## Examples

Please note that the first example is the only complete example, others may only contain the plugin.

1. Just a proxy
  
  ```js
  var Proxy = require('neoproxy');
  var proxy = Proxy();
  
  //proxy.use(plugin1);
  //proxy.use(condition2,middleware2);
  //proxy.use(middleware3);
  
  var server = proxy.listen(8000, function () {
  	var host = server.address().address;
  	var port = server.address().port;
  	console.log('proxy server listening at http://%s:%s', host, port);
  });
  
  ```
  
2. Log urls to the standard output
  
  ```js
  proxy.use(function(req,res){
  	return !req.is_resolved;
  },function(req,res,push){
  	console.log(req.url);
  	//please note that middle wares that work with non resolved requests doesn't have a return value.
  });
  ```
  
3. Abandoning connections from a specific ip
  
  ```js
  proxy.use(function(req,res){
  	return !req.is_resolved && req.ip = '10.0.0.5';
  },function(req,res,push){
  	req.abandon();
  });
  ```
  
4. Just passes the data after it is resolved
  
  ```js
  proxy.use(function(req,res){
  	return req.is_resolved;
  },function(req,res,push){
  	return function(x){
  		push(x);
  	}
  	// or you could do
  	// return push;
  });
  ```
  
5. Calculating the traffic used by every ip
  
  ```js
  var traffic = {};
  proxy.use(function(req,res){
  	return req.is_resolved;
  },function(req,res,push){
  	req.mySize = req.mySize || 0;
  	traffic[req.ip] = (traffic[req.ip]||0)-req.mySize;
  	req.mySize = 0;
  	return function(x){
  		traffic[req.ip]+=(x||'').length;
  		req.mySize+=(x||'').length;
  		push(x)
  	}
  });
  ```
  
  Or simply (but you have to make sure no following plugin will call req.retry)
  
  ```js
  var traffic = {};
  proxy.use(function(req,res){
  	return req.is_resolved;
  },function(req,res,push){
  	traffic[req.ip] = (traffic[req.ip]||0);
  	return function(x){
  		traffic[req.ip]+=(x||'').length;
  		push(x)
  	}
  });
  ```
  
6. Replace something in the body of the response
  
  ```js
  var defaults = Proxy.defaults;
  // this builtin plugin will concat the whole response in a single chunk
  proxy.use(defaults.concat)
  proxy.use(function(req,res){
  	return req.is_resolved;
  },function(req,res,push){
  	var enconding = 'utf8'
  	return function(x){
  		if(x){
  			if(x instanceof Buffer){
  				x = new Buffer(x.toString(encoding).replace(/foo/g,'bar'),encoding);
  			}
  			else{
  				x = x.replace(/foo/g,'bar');
  			}
  		}
  		push(x)
  	}
  });
  ```
  
7. Abort the connection if a string was found in the response.
  
  ```js
  var defaults = Proxy.defaults;
  proxy.use(defaults.concat)
  proxy.use(function(req,res){
  	return req.is_resolved;
  },function(req,res,push){
  	var enconding = 'utf8'
  	return function(x){
  		var str;
  		if(x){
  			if(x instanceof Buffer){
  				str = x.toString(encoding)
  			}
  			else{
  				str = x
  			}
  			if(str.match(/foo/g)){
  				return req.abandon();
  			}
  		}
  		push(x);
  	}
  });
  ```
  
8. Block requests to a particular site
  
  ```js
  proxy.use(function(req,res){
  	return !req.is_resolved && req.hostname === 'google.com';
  },function(req,res,push){
  	req.abandon();
  });
  ```
  
9. Remove or alter a specific header from request or response
  
  ```js
  proxy.use(function(req,res){
  	return !req.is_resolved;
  },function(req,res,push){
  	delete req.headers.referer;
  });
  ```
  
  ```js
  proxy.use(function(req,res){
  	return req.is_resolved;
  },function(req,res,push){
  	res.response.headers['Cache-Control'] = 'max-age=0';
  });
  ```
  
10. Limit the data passed every second to 10kB to mock slow internet connections. (Please note that tis snippet can be used for test purposes only, feel free to add more accurate middleware)
  
  ```js
  var INTERVAL = 1000, // 1s
  var LIMIT = 1024*10, // 10kB
  proxy.use({
  	// to store timestamp, data length for calculations.
  	obj: {},
  	queue: [],
  	process: function(){
  		var self = this;
  		var queue = self.queue;
  		var obj = self.obj;
  		while(Array.isArray(queue[0]) && queue[0][0] === null){
  			var packet = queue.shift();;
  			var chunk = packet[0];
  			var push = packet[1];
  			push(chunk);
  		}
  		if(queue.length){
  			var date = Date.now();
  			var count = 0;
  			for (var i in obj){
  				if(date-i>INTERVAL){
  					delete obj[i];
  				}
  				else{
  					count += obj[i];
  				}
  			}
  			if(count<LIMIT){
  				var packet = queue.shift();;
  				var chunk = packet[0];
  				var push = packet[1];
  				push(chunk);
  				obj[date] = chunk.length;
  			}
  			setTimeout(process,0);
  		}
  	},
  	condition: function(req,res){
  		return req.is_resolved;
  	},
  	middleware: function(req,res,push){
  		var self = this;
  		return function(x){
  			self.queue.push([x,push]);
  			self.process();
  		}
  	}
  })
  ```

## Contribution

If you like contributing to this project, I am waiting for the pull request. :)

## Todo

  1. Error handling.
  2. Testing.
  3. Hanling file uploads.
  4. Accepting optional parameters.
  5. Seperating public and private methods.

## License
[MIT](./LICENSE) @ 2015 [Mohamed Elawadi](http://www.github.com/mie00)