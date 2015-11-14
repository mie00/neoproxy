module.exports = {
	concat: {
		condition: function(req,res){
			return req.is_resolved;
		},
		middleware: function(req,res,push){
			var a = new Buffer(0);
			return function(x){
				if(x !== null)
					a = Buffer.concat([a,x])
				else{
					push(a);
					push(null)
				}
			};
		}
	}
}