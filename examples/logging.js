module.exports = function(log){
	log = log || console.log
	return {
		condition:function(req,res){
			return !req.is_resolved;
		},
		middleware:function(req,res,push){
			log(req.method + ': ' + req.url);
		}
	}
}