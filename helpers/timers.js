var mySetInterval = function( callback, timeout, param ){
  global.setInterval( callback, timeout, param );
};


module.exports = {
  setInterval: mySetInterval
};
