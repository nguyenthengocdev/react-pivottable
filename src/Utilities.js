/* eslint-disable no-undefined */
import PropTypes from 'prop-types';

/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS104: Avoid inline assignments
 * DS201: Simplify complex destructure assignments
 * DS203: Remove `|| {}` from converted for-own loops
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */

const addSeparators = function(nStr, thousandsSep, decimalSep) {
  const x = String(nStr).split('.');
  let x1 = x[0];
  const x2 = x.length > 1 ? decimalSep + x[1] : '';
  const rgx = /(\d+)(\d{3})/;
  while (rgx.test(x1)) {
    x1 = x1.replace(rgx, `$1${thousandsSep}$2`);
  }
  return x1 + x2;
};

const numberFormat = function(opts_in) {
  const defaults = {
    digitsAfterDecimal: 2,
    scaler: 1,
    thousandsSep: ',',
    decimalSep: '.',
    prefix: '',
    suffix: '',
    showOriginal: false,
  };
  const opts = Object.assign({}, defaults, opts_in);
  return function(x) {
    if (isNaN(x) || !isFinite(x)) {
      return '';
    }
    // Show completely original value if showOriginal is true
    if (opts.showOriginal) {
      return String(opts.scaler * x);
    }
    // When thousandsSep is empty, apply decimal formatting but skip thousand separator
    if (opts.thousandsSep === '') {
      const scaledValue = opts.scaler * x;
      const fixedValue = scaledValue.toFixed(opts.digitsAfterDecimal);
      // Apply decimal separator if needed
      const result = fixedValue.replace('.', opts.decimalSep);
      return `${opts.prefix}${result}${opts.suffix}`;
    }
    // Normal formatting with thousand separator
    const result = addSeparators(
      (opts.scaler * x).toFixed(opts.digitsAfterDecimal),
      opts.thousandsSep,
      opts.decimalSep
    );
    return `${opts.prefix}${result}${opts.suffix}`;
  };
};

const rx = /(\d+)|(\D+)/g;
const rd = /\d/;
const rz = /^0/;
const naturalSort = (as, bs) => {
  // nulls first
  if (bs !== null && as === null) {
    return -1;
  }
  if (as !== null && bs === null) {
    return 1;
  }

  // then raw NaNs
  if (typeof as === 'number' && isNaN(as)) {
    return -1;
  }
  if (typeof bs === 'number' && isNaN(bs)) {
    return 1;
  }

  // numbers and numbery strings group together
  const nas = Number(as);
  const nbs = Number(bs);
  if (nas < nbs) {
    return -1;
  }
  if (nas > nbs) {
    return 1;
  }

  // within that, true numbers before numbery strings
  if (typeof as === 'number' && typeof bs !== 'number') {
    return -1;
  }
  if (typeof bs === 'number' && typeof as !== 'number') {
    return 1;
  }
  if (typeof as === 'number' && typeof bs === 'number') {
    return 0;
  }

  // 'Infinity' is a textual number, so less than 'A'
  if (isNaN(nbs) && !isNaN(nas)) {
    return -1;
  }
  if (isNaN(nas) && !isNaN(nbs)) {
    return 1;
  }

  // finally, "smart" string sorting per http://stackoverflow.com/a/4373421/112871
  let a = String(as);
  let b = String(bs);
  if (a === b) {
    return 0;
  }
  if (!rd.test(a) || !rd.test(b)) {
    return a > b ? 1 : -1;
  }

  // special treatment for strings containing digits
  a = a.match(rx);
  b = b.match(rx);
  while (a.length && b.length) {
    const a1 = a.shift();
    const b1 = b.shift();
    if (a1 !== b1) {
      if (rd.test(a1) && rd.test(b1)) {
        return a1.replace(rz, '.0') - b1.replace(rz, '.0');
      }
      return a1 > b1 ? 1 : -1;
    }
  }
  return a.length - b.length;
};

const sortAs = function(order) {
  const mapping = {};

  // sort lowercased keys similarly
  const l_mapping = {};
  for (const i in order) {
    const x = order[i];
    mapping[x] = i;
    if (typeof x === 'string') {
      l_mapping[x.toLowerCase()] = i;
    }
  }
  return function(a, b) {
    if (a in mapping && b in mapping) {
      return mapping[a] - mapping[b];
    } else if (a in mapping) {
      return -1;
    } else if (b in mapping) {
      return 1;
    } else if (a in l_mapping && b in l_mapping) {
      return l_mapping[a] - l_mapping[b];
    } else if (a in l_mapping) {
      return -1;
    } else if (b in l_mapping) {
      return 1;
    }
    return naturalSort(a, b);
  };
};

// Built-in sort functions for different data types
const builtInSorters = {
  // Number sorter - handles numeric values
  number: (a, b) => {
    if (a === null || a === undefined || a === '') {
      return b === null || b === undefined || b === '' ? 0 : -1;
    }
    if (b === null || b === undefined || b === '') {
      return 1;
    }
    const numA = typeof a === 'number' ? a : parseFloat(a);
    const numB = typeof b === 'number' ? b : parseFloat(b);
    if (isNaN(numA) && isNaN(numB)) {
      return 0;
    }
    if (isNaN(numA)) {
      return -1;
    }
    if (isNaN(numB)) {
      return 1;
    }
    return numA - numB;
  },

  // Date sorter - handles date values
  date: (a, b) => {
    if (a === null || a === undefined || a === '') {
      return b === null || b === undefined || b === '' ? 0 : -1;
    }
    if (b === null || b === undefined || b === '') {
      return 1;
    }
    const dateA = a instanceof Date ? a : new Date(a);
    const dateB = b instanceof Date ? b : new Date(b);
    if (isNaN(dateA.getTime()) && isNaN(dateB.getTime())) {
      return 0;
    }
    if (isNaN(dateA.getTime())) {
      return -1;
    }
    if (isNaN(dateB.getTime())) {
      return 1;
    }
    return dateA.getTime() - dateB.getTime();
  },

  // String sorter - case-sensitive
  string: (a, b) => {
    if (a === null || a === undefined || a === '') {
      return b === null || b === undefined || b === '' ? 0 : -1;
    }
    if (b === null || b === undefined || b === '') {
      return 1;
    }
    const strA = String(a);
    const strB = String(b);
    return strA > strB ? 1 : strA < strB ? -1 : 0;
  },

  // String sorter - case-insensitive
  stringCaseInsensitive: (a, b) => {
    if (a === null || a === undefined || a === '') {
      return b === null || b === undefined || b === '' ? 0 : -1;
    }
    if (b === null || b === undefined || b === '') {
      return 1;
    }
    const strA = String(a).toLowerCase();
    const strB = String(b).toLowerCase();
    return strA > strB ? 1 : strA < strB ? -1 : 0;
  },

  // Natural sort (default)
  natural: naturalSort,
};

// Alias for backward compatibility
// const sorters = builtInSorters;

// Auto-detect data type from sample values
const detectDataType = function(values) {
  if (!values || values.length === 0) {
    return 'natural';
  }

  const sampleSize = Math.min(10, values.length);
  const samples = values.slice(0, sampleSize);

  let numberCount = 0;
  let dateCount = 0;
  let stringCount = 0;

  for (const val of samples) {
    if (val === null || val === undefined || val === '') {
      continue;
    }

    // Check if it's a number
    if (typeof val === 'number' || (!isNaN(parseFloat(val)) && isFinite(val))) {
      numberCount++;
    }
    // Check if it's a date
    else if (
      val instanceof Date ||
      (!isNaN(Date.parse(val)) && String(val).match(/^\d{4}-\d{2}-\d{2}/))
    ) {
      dateCount++;
    }
    // Otherwise it's a string
    else {
      stringCount++;
    }
  }

  // Determine the most common type
  if (numberCount > dateCount && numberCount > stringCount) {
    return 'number';
  } else if (dateCount > stringCount) {
    return 'date';
  } else if (stringCount > 0) {
    return 'string';
  }

  return 'natural';
};

// Create a sorter based on data type
const createSorterByType = function(dataType) {
  if (typeof dataType === 'function') {
    return dataType;
  }

  if (typeof dataType === 'string' && dataType in builtInSorters) {
    return builtInSorters[dataType];
  }

  // Auto-detect if dataType is an array of values
  if (Array.isArray(dataType)) {
    const detectedType = detectDataType(dataType);
    return builtInSorters[detectedType] || naturalSort;
  }

  return naturalSort;
};

// Get sorter for an attribute, with auto-detection support
const getSort = function(sorters, attr, attrValues = null) {
  if (sorters) {
    if (typeof sorters === 'function') {
      const sort = sorters(attr);
      if (typeof sort === 'function') {
        return sort;
      }
    } else if (attr in sorters) {
      const sorter = sorters[attr];
      // If it's a string (data type name) or array (sample values), create appropriate sorter
      if (typeof sorter === 'string' || Array.isArray(sorter)) {
        return createSorterByType(sorter);
      }
      // If it's already a function, use it
      if (typeof sorter === 'function') {
        return sorter;
      }
    }
  }

  // Auto-detect if attrValues are provided
  if (attrValues && typeof attrValues === 'object') {
    const values = Object.keys(attrValues);
    if (values.length > 0) {
      const detectedType = detectDataType(values);
      return builtInSorters[detectedType] || naturalSort;
    }
  }

  return naturalSort;
};

// aggregator templates default to US number formatting but this is overrideable
const usFmt = numberFormat();
const usFmtInt = numberFormat({digitsAfterDecimal: 0});
const usFmtPct = numberFormat({
  digitsAfterDecimal: 1,
  scaler: 100,
  suffix: '%',
});

const aggregatorTemplates = {
  count(formatter = usFmtInt) {
    return () =>
      function() {
        return {
          count: 0,
          push() {
            this.count++;
          },
          value() {
            return this.count;
          },
          format: formatter,
        };
      };
  },

  uniques(fn, formatter = usFmtInt) {
    return function([attr]) {
      return function() {
        return {
          uniq: [],
          push(record) {
            if (!Array.from(this.uniq).includes(record[attr])) {
              this.uniq.push(record[attr]);
            }
          },
          value() {
            return fn(this.uniq);
          },
          format: formatter,
          numInputs: typeof attr !== 'undefined' ? 0 : 1,
        };
      };
    };
  },

  sum(formatter = usFmt) {
    return function([attr]) {
      return function() {
        return {
          sum: 0,
          push(record) {
            if (!isNaN(parseFloat(record[attr]))) {
              this.sum += parseFloat(record[attr]);
            }
          },
          value() {
            return this.sum;
          },
          format: formatter,
          numInputs: typeof attr !== 'undefined' ? 0 : 1,
        };
      };
    };
  },

  extremes(mode, formatter = usFmt) {
    return function([attr]) {
      return function(data) {
        return {
          val: null,
          sorter: getSort(
            typeof data !== 'undefined' ? data.sorters : null,
            attr
          ),
          push(record) {
            let x = record[attr];
            if (['min', 'max'].includes(mode)) {
              x = parseFloat(x);
              if (!isNaN(x)) {
                this.val = Math[mode](x, this.val !== null ? this.val : x);
              }
            }
            if (
              mode === 'first' &&
              this.sorter(x, this.val !== null ? this.val : x) <= 0
            ) {
              this.val = x;
            }
            if (
              mode === 'last' &&
              this.sorter(x, this.val !== null ? this.val : x) >= 0
            ) {
              this.val = x;
            }
          },
          value() {
            return this.val;
          },
          format(x) {
            if (isNaN(x)) {
              return x;
            }
            return formatter(x);
          },
          numInputs: typeof attr !== 'undefined' ? 0 : 1,
        };
      };
    };
  },

  quantile(q, formatter = usFmt) {
    return function([attr]) {
      return function() {
        return {
          vals: [],
          push(record) {
            const x = parseFloat(record[attr]);
            if (!isNaN(x)) {
              this.vals.push(x);
            }
          },
          value() {
            if (this.vals.length === 0) {
              return null;
            }
            this.vals.sort((a, b) => a - b);
            const i = (this.vals.length - 1) * q;
            return (this.vals[Math.floor(i)] + this.vals[Math.ceil(i)]) / 2.0;
          },
          format: formatter,
          numInputs: typeof attr !== 'undefined' ? 0 : 1,
        };
      };
    };
  },

  runningStat(mode = 'mean', ddof = 1, formatter = usFmt) {
    return function([attr]) {
      return function() {
        return {
          n: 0.0,
          m: 0.0,
          s: 0.0,
          push(record) {
            const x = parseFloat(record[attr]);
            if (isNaN(x)) {
              return;
            }
            this.n += 1.0;
            if (this.n === 1.0) {
              this.m = x;
            }
            const m_new = this.m + (x - this.m) / this.n;
            this.s = this.s + (x - this.m) * (x - m_new);
            this.m = m_new;
          },
          value() {
            if (mode === 'mean') {
              if (this.n === 0) {
                return 0 / 0;
              }
              return this.m;
            }
            if (this.n <= ddof) {
              return 0;
            }
            switch (mode) {
              case 'var':
                return this.s / (this.n - ddof);
              case 'stdev':
                return Math.sqrt(this.s / (this.n - ddof));
              default:
                throw new Error('unknown mode for runningStat');
            }
          },
          format: formatter,
          numInputs: typeof attr !== 'undefined' ? 0 : 1,
        };
      };
    };
  },

  sumOverSum(formatter = usFmt) {
    return function([num, denom]) {
      return function() {
        return {
          sumNum: 0,
          sumDenom: 0,
          push(record) {
            if (!isNaN(parseFloat(record[num]))) {
              this.sumNum += parseFloat(record[num]);
            }
            if (!isNaN(parseFloat(record[denom]))) {
              this.sumDenom += parseFloat(record[denom]);
            }
          },
          value() {
            return this.sumNum / this.sumDenom;
          },
          format: formatter,
          numInputs:
            typeof num !== 'undefined' && typeof denom !== 'undefined' ? 0 : 2,
        };
      };
    };
  },

  fractionOf(wrapped, type = 'total', formatter = usFmtPct) {
    return (...x) =>
      function(data, rowKey, colKey) {
        return {
          selector: {total: [[], []], row: [rowKey, []], col: [[], colKey]}[
            type
          ],
          inner: wrapped(...Array.from(x || []))(data, rowKey, colKey),
          push(record) {
            this.inner.push(record);
          },
          format: formatter,
          value() {
            return (
              this.inner.value() /
              data
                .getAggregator(...Array.from(this.selector || []))
                .inner.value()
            );
          },
          numInputs: wrapped(...Array.from(x || []))().numInputs,
        };
      };
  },
};

aggregatorTemplates.countUnique = f =>
  aggregatorTemplates.uniques(x => x.length, f);
aggregatorTemplates.listUnique = s =>
  aggregatorTemplates.uniques(
    x => x.join(s),
    x => x
  );
aggregatorTemplates.max = f => aggregatorTemplates.extremes('max', f);
aggregatorTemplates.min = f => aggregatorTemplates.extremes('min', f);
aggregatorTemplates.first = f => aggregatorTemplates.extremes('first', f);
aggregatorTemplates.last = f => aggregatorTemplates.extremes('last', f);
aggregatorTemplates.median = f => aggregatorTemplates.quantile(0.5, f);
aggregatorTemplates.average = f =>
  aggregatorTemplates.runningStat('mean', 1, f);
aggregatorTemplates.var = (ddof, f) =>
  aggregatorTemplates.runningStat('var', ddof, f);
aggregatorTemplates.stdev = (ddof, f) =>
  aggregatorTemplates.runningStat('stdev', ddof, f);

class AggregatorCell {
  constructor(instances, primaryKey) {
    this.instances = instances;
    this.primaryKey = primaryKey;
  }

  push(record) {
    Object.keys(this.instances).forEach(key => {
      this.instances[key].push(record);
    });
  }

  getInstance(key) {
    const targetKey = key || this.primaryKey;
    if (targetKey && this.instances[targetKey]) {
      return this.instances[targetKey];
    }
    const first =
      this.instances[this.primaryKey] ||
      this.instances[Object.keys(this.instances)[0]];
    return first || null;
  }
}

// default aggregators & renderers use US naming and number formatting
const aggregators = (tpl => ({
  Count: tpl.count(usFmtInt),
  'Count Unique Values': tpl.countUnique(usFmtInt),
  'List Unique Values': tpl.listUnique(', '),
  Sum: tpl.sum(usFmt),
  'Integer Sum': tpl.sum(usFmtInt),
  Average: tpl.average(usFmt),
  Median: tpl.median(usFmt),
  'Sample Variance': tpl.var(1, usFmt),
  'Sample Standard Deviation': tpl.stdev(1, usFmt),
  Minimum: tpl.min(usFmt),
  Maximum: tpl.max(usFmt),
  First: tpl.first(usFmt),
  Last: tpl.last(usFmt),
  'Sum over Sum': tpl.sumOverSum(usFmt),
  'Sum as Fraction of Total': tpl.fractionOf(tpl.sum(), 'total', usFmtPct),
  'Sum as Fraction of Rows': tpl.fractionOf(tpl.sum(), 'row', usFmtPct),
  'Sum as Fraction of Columns': tpl.fractionOf(tpl.sum(), 'col', usFmtPct),
  'Count as Fraction of Total': tpl.fractionOf(tpl.count(), 'total', usFmtPct),
  'Count as Fraction of Rows': tpl.fractionOf(tpl.count(), 'row', usFmtPct),
  'Count as Fraction of Columns': tpl.fractionOf(tpl.count(), 'col', usFmtPct),
}))(aggregatorTemplates);

const locales = {
  en: {
    aggregators,
    localeStrings: {
      renderError: 'An error occurred rendering the PivotTable results.',
      computeError: 'An error occurred computing the PivotTable results.',
      uiRenderError: 'An error occurred rendering the PivotTable UI.',
      selectAll: 'Select All',
      selectNone: 'Select None',
      tooMany: '(too many to list)',
      filterResults: 'Filter values',
      apply: 'Apply',
      cancel: 'Cancel',
      totals: 'Totals',
      vs: 'vs',
      by: 'by',
    },
  },
};

// dateFormat deriver l10n requires month and day names to be passed in directly
const mthNamesEn = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
const dayNamesEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const zeroPad = number => `0${number}`.substr(-2, 2); // eslint-disable-line no-magic-numbers

const derivers = {
  bin(col, binWidth) {
    return record => record[col] - (record[col] % binWidth);
  },
  dateFormat(
    col,
    formatString,
    utcOutput = false,
    mthNames = mthNamesEn,
    dayNames = dayNamesEn
  ) {
    const utc = utcOutput ? 'UTC' : '';
    return function(record) {
      const date = new Date(Date.parse(record[col]));
      if (isNaN(date)) {
        return '';
      }
      return formatString.replace(/%(.)/g, function(m, p) {
        switch (p) {
          case 'y':
            return date[`get${utc}FullYear`]();
          case 'm':
            return zeroPad(date[`get${utc}Month`]() + 1);
          case 'n':
            return mthNames[date[`get${utc}Month`]()];
          case 'd':
            return zeroPad(date[`get${utc}Date`]());
          case 'w':
            return dayNames[date[`get${utc}Day`]()];
          case 'x':
            return date[`get${utc}Day`]();
          case 'H':
            return zeroPad(date[`get${utc}Hours`]());
          case 'M':
            return zeroPad(date[`get${utc}Minutes`]());
          case 'S':
            return zeroPad(date[`get${utc}Seconds`]());
          default:
            return `%${p}`;
        }
      });
    };
  },
};

/*
Data Model class
*/

class PivotData {
  constructor(inputProps = {}) {
    this.props = Object.assign({}, PivotData.defaultProps, inputProps);
    PropTypes.checkPropTypes(
      PivotData.propTypes,
      this.props,
      'prop',
      'PivotData'
    );

    this.aggregations = this.normalizeAggregations();
    this.aggregationKeyLookup = {};
    this.aggregations.forEach(agg => {
      if (!(agg.aggregatorName in this.aggregationKeyLookup)) {
        this.aggregationKeyLookup[agg.aggregatorName] = agg.key;
      }
    });
    if (this.aggregations.length === 0) {
      throw new Error('PivotData requires at least one aggregation');
    }
    this.primaryAggregation = this.aggregations[0];
    this.primaryAggregatorName = this.primaryAggregation.aggregatorName;

    this.aggregatorFactories = this.buildAggregatorFactories();
    this.tree = {};
    this.rowKeys = [];
    this.colKeys = [];
    this.rowTotals = {};
    this.colTotals = {};
    this.allTotal = this.createAggregatorCell([], []);
    this.sorted = false;

    // iterate through input, accumulating data for cells
    PivotData.forEachRecord(
      this.props.data,
      this.props.derivedAttributes,
      record => {
        if (this.filter(record)) {
          this.processRecord(record);
        }
      }
    );
  }

  filter(record) {
    for (const k in this.props.valueFilter) {
      if (record[k] in this.props.valueFilter[k]) {
        return false;
      }
    }
    return true;
  }

  forEachMatchingRecord(criteria, callback) {
    return PivotData.forEachRecord(
      this.props.data,
      this.props.derivedAttributes,
      record => {
        if (!this.filter(record)) {
          return;
        }
        for (const k in criteria) {
          const v = criteria[k];
          if (v !== (k in record ? record[k] : 'null')) {
            return;
          }
        }
        callback(record);
      }
    );
  }

  arrSort(attrs) {
    let a;
    const sortersArr = (() => {
      const result = [];
      for (a of Array.from(attrs)) {
        result.push(getSort(this.props.sorters, a));
      }
      return result;
    })();
    return function(a, b) {
      for (const i of Object.keys(sortersArr || {})) {
        const sorter = sortersArr[i];
        const comparison = sorter(a[i], b[i]);
        if (comparison !== 0) {
          return comparison;
        }
      }
      return 0;
    };
  }

  sortKeys() {
    if (!this.sorted) {
      this.sorted = true;
      const v = (r, c) => this.getAggregator(r, c).value();

      // Handle per-row sorting
      if (this.props.rowSorts && Object.keys(this.props.rowSorts).length > 0) {
        const rowSorts = this.props.rowSorts;
        this.rowKeys.sort((a, b) => {
          // First, check if any sorted attribute has a difference
          for (let i = 0; i < this.props.rows.length; i++) {
            const attr = this.props.rows[i];
            if (attr && rowSorts[attr]) {
              const sortDir = rowSorts[attr] === 'ASC' ? 1 : -1;
              const sorter = getSort(this.props.sorters, attr);
              const comparison = sorter(a[i] || '', b[i] || '');
              if (comparison !== 0) {
                return sortDir * comparison;
              }
            }
          }
          // If sorted attributes are equal, use default sorting for remaining attributes
          return this.arrSort(this.props.rows)(a, b);
        });
      } else {
        // Use global row order
        switch (this.props.rowOrder) {
          case 'value_a_to_z':
            this.rowKeys.sort((a, b) => naturalSort(v(a, []), v(b, [])));
            break;
          case 'value_z_to_a':
            this.rowKeys.sort((a, b) => -naturalSort(v(a, []), v(b, [])));
            break;
          default:
            this.rowKeys.sort(this.arrSort(this.props.rows));
        }
      }

      // Handle per-column sorting
      if (this.props.colSorts && Object.keys(this.props.colSorts).length > 0) {
        const colSorts = this.props.colSorts;
        this.colKeys.sort((a, b) => {
          // First, check if any sorted attribute has a difference
          for (let i = 0; i < this.props.cols.length; i++) {
            const attr = this.props.cols[i];
            if (attr && colSorts[attr]) {
              const sortDir = colSorts[attr] === 'ASC' ? 1 : -1;
              const sorter = getSort(this.props.sorters, attr);
              const comparison = sorter(a[i] || '', b[i] || '');
              if (comparison !== 0) {
                return sortDir * comparison;
              }
            }
          }
          // If sorted attributes are equal, use default sorting for remaining attributes
          return this.arrSort(this.props.cols)(a, b);
        });
      } else {
        // Use global col order
        switch (this.props.colOrder) {
          case 'value_a_to_z':
            this.colKeys.sort((a, b) => naturalSort(v([], a), v([], b)));
            break;
          case 'value_z_to_a':
            this.colKeys.sort((a, b) => -naturalSort(v([], a), v([], b)));
            break;
          default:
            this.colKeys.sort(this.arrSort(this.props.cols));
        }
      }
    }
  }

  getColKeys() {
    this.sortKeys();
    return this.colKeys;
  }

  getRowKeys() {
    this.sortKeys();
    return this.rowKeys;
  }

  processRecord(record) {
    // this code is called in a tight loop
    const colKey = [];
    const rowKey = [];
    for (const x of Array.from(this.props.cols)) {
      colKey.push(x in record ? record[x] : 'null');
    }
    for (const x of Array.from(this.props.rows)) {
      rowKey.push(x in record ? record[x] : 'null');
    }
    const flatRowKey = rowKey.join(String.fromCharCode(0));
    const flatColKey = colKey.join(String.fromCharCode(0));

    this.allTotal.push(record);

    if (rowKey.length !== 0) {
      if (!this.rowTotals[flatRowKey]) {
        this.rowKeys.push(rowKey);
        this.rowTotals[flatRowKey] = this.createAggregatorCell(rowKey, []);
      }
      this.rowTotals[flatRowKey].push(record);
    }

    if (colKey.length !== 0) {
      if (!this.colTotals[flatColKey]) {
        this.colKeys.push(colKey);
        this.colTotals[flatColKey] = this.createAggregatorCell([], colKey);
      }
      this.colTotals[flatColKey].push(record);
    }

    if (colKey.length !== 0 && rowKey.length !== 0) {
      if (!this.tree[flatRowKey]) {
        this.tree[flatRowKey] = {};
      }
      if (!this.tree[flatRowKey][flatColKey]) {
        this.tree[flatRowKey][flatColKey] = this.createAggregatorCell(
          rowKey,
          colKey
        );
      }
      this.tree[flatRowKey][flatColKey].push(record);
    }
  }

  getAggregator(rowKey, colKey, aggregationKey = this.primaryAggregation.key) {
    let resolvedKey = aggregationKey;
    if (
      resolvedKey &&
      !(resolvedKey in this.aggregatorFactories) &&
      this.aggregationKeyLookup[resolvedKey]
    ) {
      resolvedKey = this.aggregationKeyLookup[resolvedKey];
    }
    const cell = this.getAggregatorCell(rowKey, colKey);
    if (!cell) {
      return PivotData.emptyAggregator;
    }
    return cell.getInstance(resolvedKey) || PivotData.emptyAggregator;
  }

  getAggregatorCell(rowKey, colKey) {
    let cell;
    const flatRowKey = rowKey.join(String.fromCharCode(0));
    const flatColKey = colKey.join(String.fromCharCode(0));
    if (rowKey.length === 0 && colKey.length === 0) {
      cell = this.allTotal;
    } else if (rowKey.length === 0) {
      cell = this.colTotals[flatColKey];
    } else if (colKey.length === 0) {
      cell = this.rowTotals[flatRowKey];
    } else {
      cell =
        this.tree[flatRowKey] && this.tree[flatRowKey][flatColKey]
          ? this.tree[flatRowKey][flatColKey]
          : null;
    }
    return cell || null;
  }

  getAggregatorNames() {
    return this.aggregations.map(agg => agg.aggregatorName);
  }

  getAggregations() {
    return this.aggregations.map(agg => Object.assign({}, agg));
  }

  getPrimaryAggregatorName() {
    return this.primaryAggregatorName;
  }

  getPrimaryAggregation() {
    return Object.assign({}, this.primaryAggregation);
  }

  /**
   * Groups aggregations by their aggregatorName
   * @returns {Object} Object mapping aggregator names to arrays of aggregations
   * Example: { 'Count': [agg1, agg2], 'Sum': [agg3] }
   */
  groupAggregationsByType() {
    const grouped = {};
    this.aggregations.forEach(agg => {
      const aggName = agg.aggregatorName;
      if (!grouped[aggName]) {
        grouped[aggName] = [];
      }
      grouped[aggName].push(agg);
    });
    return grouped;
  }

  /**
   * Gets aggregations for a specific aggregator type
   * @param {string} aggregatorName - The aggregator name (e.g., 'Count', 'Sum')
   * @returns {Array} Array of aggregation configurations
   */
  getAggregationsByType(aggregatorName) {
    return this.aggregations.filter(agg => agg.aggregatorName === aggregatorName);
  }

  normalizeAggregations() {
    const defaultAggregatorName = Object.keys(this.props.aggregators)[0];
    const aggregationsProvided =
      Array.isArray(this.props.aggregations) &&
      this.props.aggregations.length > 0;
    const legacyAggregatorName =
      typeof this.props.aggregatorName === 'string'
        ? this.props.aggregatorName
        : null;
    const fallbackAggregatorName =
      legacyAggregatorName || defaultAggregatorName;
    const fallbackVals = Array.isArray(this.props.vals) ? this.props.vals : [];
    let aggregations = [];
    if (aggregationsProvided) {
      aggregations = this.props.aggregations;
    } else {
      aggregations = [
        {
          aggregatorName: fallbackAggregatorName,
          vals: fallbackVals,
        },
      ];
    }
    return aggregations.map((agg, idx) => {
      const aggregatorName =
        agg.aggregatorName ||
        (aggregationsProvided ? defaultAggregatorName : fallbackAggregatorName);
      const vals =
        typeof agg.vals !== 'undefined'
          ? agg.vals
          : aggregationsProvided
          ? []
          : fallbackVals.slice();
      const normalizedVals = Array.isArray(vals) ? vals : [];
      const key =
        agg.key ||
        `${aggregatorName || 'agg'}-${
          normalizedVals.length ? normalizedVals.join('|') : ''
        }-${idx}`;
      const label =
        agg.label ||
        (normalizedVals.length
          ? `${aggregatorName} of ${normalizedVals.join(', ')}`
          : aggregatorName);
      return {
        key,
        aggregatorName,
        vals: normalizedVals,
        label,
      };
    });
  }

  buildAggregatorFactories() {
    const factories = {};
    this.aggregations.forEach(agg => {
      if (!(agg.aggregatorName in this.props.aggregators)) {
        throw new Error(`unknown aggregator ${agg.aggregatorName}`);
      }
      factories[agg.key] = this.props.aggregators[agg.aggregatorName](agg.vals);
    });
    return factories;
  }

  createAggregatorCell(rowKey, colKey) {
    const instances = {};
    this.aggregations.forEach(agg => {
      instances[agg.key] = this.aggregatorFactories[agg.key](
        this,
        rowKey,
        colKey
      );
    });
    return new AggregatorCell(instances, this.primaryAggregation.key);
  }
}

PivotData.emptyAggregator = {
  push() {},
  value() {
    return null;
  },
  format() {
    return '';
  },
};

// can handle arrays or jQuery selections of tables
PivotData.forEachRecord = function(input, derivedAttributes, f) {
  let addRecord, record;
  if (Object.getOwnPropertyNames(derivedAttributes).length === 0) {
    addRecord = f;
  } else {
    addRecord = function(record) {
      for (const k in derivedAttributes) {
        const derived = derivedAttributes[k](record);
        if (derived !== null) {
          record[k] = derived;
        }
      }
      return f(record);
    };
  }

  // if it's a function, have it call us back
  if (typeof input === 'function') {
    return input(addRecord);
  } else if (Array.isArray(input)) {
    if (Array.isArray(input[0])) {
      // array of arrays
      return (() => {
        const result = [];
        for (const i of Object.keys(input || {})) {
          const compactRecord = input[i];
          if (i > 0) {
            record = {};
            for (const j of Object.keys(input[0] || {})) {
              const k = input[0][j];
              record[k] = compactRecord[j];
            }
            result.push(addRecord(record));
          }
        }
        return result;
      })();
    }

    // array of objects
    return (() => {
      const result1 = [];
      for (record of Array.from(input)) {
        result1.push(addRecord(record));
      }
      return result1;
    })();
  }
  throw new Error('unknown input format');
};

PivotData.defaultProps = {
  aggregators: aggregators,
  cols: [],
  rows: [],
  vals: [],
  aggregatorName: Object.keys(aggregators)[0],
  aggregations: [],
  sorters: {},
  valueFilter: {},
  rowOrder: 'key_a_to_z',
  colOrder: 'key_a_to_z',
  rowSorts: {},
  colSorts: {},
  derivedAttributes: {},
};

PivotData.propTypes = {
  data: PropTypes.oneOfType([PropTypes.array, PropTypes.object, PropTypes.func])
    .isRequired,
  aggregatorName: PropTypes.string,
  aggregations: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string,
      aggregatorName: PropTypes.string,
      vals: PropTypes.arrayOf(PropTypes.string),
      label: PropTypes.string,
    })
  ),
  cols: PropTypes.arrayOf(PropTypes.string),
  rows: PropTypes.arrayOf(PropTypes.string),
  vals: PropTypes.arrayOf(PropTypes.string),
  valueFilter: PropTypes.objectOf(PropTypes.objectOf(PropTypes.bool)),
  sorters: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.objectOf(PropTypes.func),
  ]),
  derivedAttributes: PropTypes.objectOf(PropTypes.func),
  rowOrder: PropTypes.oneOf(['key_a_to_z', 'value_a_to_z', 'value_z_to_a']),
  colOrder: PropTypes.oneOf(['key_a_to_z', 'value_a_to_z', 'value_z_to_a']),
  rowSorts: PropTypes.objectOf(PropTypes.oneOf(['ASC', 'DESC'])),
  colSorts: PropTypes.objectOf(PropTypes.oneOf(['ASC', 'DESC'])),
};

export {
  aggregatorTemplates,
  aggregators,
  derivers,
  locales,
  naturalSort,
  numberFormat,
  getSort,
  sortAs,
  builtInSorters,
  detectDataType,
  createSorterByType,
  PivotData,
};
