
var HashMap = require('hashmap'),
    setInterval = require('../helpers/timers').setInterval;

var _map = new HashMap();
var _log;

var ErrorHandler = function(log){
  // This will set a timer that will flush all errors messages to disk
  // every 30 seconds from the hashmap
  _log = log;
  setInterval(function(){
      _map.forEach(function(value, key) {
        _log.error(key + " : " + JSON.stringify(value, null, 2));
      });
      _map.clear();
  }, 30000);
};

ErrorHandler.prototype.addError = function(error){
  // TODO: For now use displayName and in the future we need to figure
  // out another mechanism to prevent errors from impacting cpu cycles.
  var displayName = error.displayName;
  if(_map.has(displayName)) {
    var e = _map.get(displayName);
    _map.set(displayName, {count: (e.count+1), message: error});
  } else {
    _log.error("Additional copies of this error will be suppressed, and reported as counts every 30 seconds.\n"+
      displayName + " : " + JSON.stringify(error, null, 2));
    _map.set(displayName, {count: 1, message: error});
  }
};

module.exports = ErrorHandler;
