module.exports = function(limit,interval){
	var LIMIT = limit || 1024*10; // 10kB 
	var INTERVAL = interval || 1000; // 1s 
	return {
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
				setTimeout(self.process.bind(self),0);
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
	}
}