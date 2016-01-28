var moment = require('moment');

// Add range() function on to moment()
require('moment-range');

function constructQuery(mustFilters, shouldFilters) {

  if(shouldFilters.length === 0) {
    return {
      filtered: {
        filter: {
          bool: {
            must: mustFilters
          }
        }
      }
    };
  } else {
    return {
      filtered: {
        filter: {
          bool: {
            must: mustFilters,
            should: shouldFilters
          }
        }
      }
    };
}


}

function constructSort(sortUrlParam) {
  var sortParam = sortUrlParam || '-@timestamp',
      direction = sortParam.charAt(0) === '-' ? 'desc' : 'asc',
      field = direction === 'desc' ? sortParam.substr(1) : sortParam;

  var sort = [ { } ];
  sort[0][field] = { order: direction, ignore_unmapped: true };
  return sort;
}

function constructSearchOptions(query) {

  var mustFilters = [],
      shouldFilters = [],
      from = query.from,
      to = query.to,
      hostname = query.hostname,
      mFilters = query.mustFilters,
      sFilters = query.shouldFilters;

  if (from && to) {

    var fromMoment = moment(from).utc(),
        toMoment = moment(to).utc();

    mustFilters.push({
      range: {
        "@timestamp": {
          gte: fromMoment.toISOString(),
          lte: toMoment.toISOString(),
          format: 'date_optional_time'
        }
      }
    });
  }

  for (var mterm in mFilters) {
      if (mFilters.hasOwnProperty(mterm)) {
          var mfilter = mFilters[mterm];

          mustFilters.push({
              term: mfilter
          });
      }
  }

  for (var sterm in sFilters) {
      if (sFilters.hasOwnProperty(sterm)) {
          var sfilter = sFilters[sterm];

          shouldFilters.push({
              term: sfilter
          });
      }
  }

  if (hostname && hostname.length) {
    filters.push({
      terms: {
        hostname: hostname
      }
    });
  }

  var filterQuery = constructQuery(mustFilters, shouldFilters),
      sort = constructSort(query.sort);

  var searchOptions = {
    index: 'overwatch-*',
    type: query.type || 'syslog',
    ignore_unavailable: true,
    body: {
      from: query.offset || 0,
      size: query.size || 20,
      query: filterQuery,
      sort: sort
    }
  };

  return searchOptions;
}

module.exports = constructSearchOptions;
