module.exports = function(allow,deny){
	if(allow && deny){
		var err = new Error('You cannot use both allow and deny for ip addresses');
		throw err;
	}
	
	var condition = allow?function(req,res){
		return !req.is_resolved && !~allow.indexOf(req.ip);
	}:function(req,res){
		return !req.is_resolved && ~deny.indexOf(req.ip);
	};

	return {
		condition:condition,
		middleware:function(req,res,push){
  			req.abandon();
		}
	};
};