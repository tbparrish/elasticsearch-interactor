var moment = require('moment');

// Add range() function on to moment()
require('moment-range');

function generateIndexDates(fromMoment, toMoment) {

  var dayFormat = 'YYYY.MM.DD';

  if (toMoment.isBefore(fromMoment)) {
    var toBeforeFromMessage = "To date is before From date";
    log.error(toBeforeFromMessage, { from: from, to: to });
    throw { statusCode: 400, message: toBeforeFromMessage };
  }

  var indexDates = [];
  var dayRange = moment().range(fromMoment, toMoment)
  dayRange.by('days', function (day) {
    indexDates.push('overwatch-' + day.format(dayFormat));
  });

  return indexDates;
}

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

function chunkIndices(indexDates) {
  var i, chunkSize = 100, chunks = [];
  for (i = 0; i < indexDates.length; i += chunkSize) {
    chunks.push(indexDates.slice(i, i + chunkSize));
  }
  return chunks;
}

function constructSearchOptions(query) {

  var indexDates = ['overwatch-*']
      filters = [],
      from = query.from,
      to = query.to,
      hostname = query.hostname;

  if (from && to) {

    var fromMoment = moment(from).utc(),
        toMoment = moment(to).utc();

    indexDates = generateIndexDates(fromMoment, toMoment);

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
    index: indexDates.join(','),
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