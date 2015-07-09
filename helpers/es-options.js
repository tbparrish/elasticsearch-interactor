var moment = require('moment');

// Add range() function on to moment()
require('moment-range');

function constructQuery(filters) {
  return {
    filtered: {
      filter: {
        bool: {
          must: filters
        }
      }
    }
  };
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

  var filters = [],
      from = query.from,
      to = query.to,
      hostname = query.hostname;

  if (from && to) {

    var fromMoment = moment(from).utc(),
        toMoment = moment(to).utc();

    filters.push({
      range: {
        "@timestamp": {
          gte: fromMoment.toISOString(),
          lte: toMoment.toISOString(),
          format: 'date_optional_time'
        }
      }
    });
  }

  if (hostname) {
    filters.push({
      term: {
        hostname: hostname
      }
    })
  }

  var query = constructQuery(filters),
      sort = constructSort(query.sort);

  var searchOptions = {
    index: 'overwatch-*',
    type: query.type || 'syslog',
    ignore_unavailable: true,
    body: {
      from: query.offset || 0,
      size: query.size || 20,
      query: query,
      sort: sort
    }
  };

  return searchOptions;
}

module.exports = constructSearchOptions;