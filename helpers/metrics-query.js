var _ = require('lazy.js');

function constructOptions(type, body) {
  return {
    index: 'overwatch-*',
    search_type: 'count',
    type: type,
    ignore_unavailable: true,
    body: _(body).defaults({ size: 0 }).toObject()
  };
}

function constructFilter(fromIso, toIso, mustTerms, shouldTerms) {
  var shouldFilters = [], mustFilters = [];

  if((fromIso !== null) && (toIso !== null)) {
    mustFilters.push({
      range: {
        "@timestamp": {
          gte: fromIso,
          lte: toIso,
          format: 'date_optional_time'
        }
      }
    });
  }

  if (mustTerms) {
    _(mustTerms).each(function (value, key) {
      var obj = {}; obj[key] = value; mustFilters.push({ term: obj });
    });
  }

  if(shouldTerms) {
    if(shouldTerms.length > 0) {
      shouldTerms.map(function(shouldTerm) {
          var obj = {}; obj = shouldTerm; shouldFilters.push({ term: obj });
      });
    }
  }

  if((mustFilters.length > 0) && (shouldFilters.length > 0 )) {
    return {
      filtered: { filter: { bool: { must: mustFilters, should: shouldFilters }}}
    };
  } else if((mustFilters.length > 0) && (shouldFilters.length === 0 )){
    return {
      filtered: { filter: { bool: { must: mustFilters }}}
    };
  } else if((mustFilters.length === 0) && (shouldFilters.length > 0 )){
    return {
      filtered: { filter: { bool: { must: shouldFilters }}}
    };
  }
}

module.exports = {
  constructOptions: constructOptions,
  constructFilter: constructFilter
};
