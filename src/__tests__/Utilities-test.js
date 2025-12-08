import * as utils from '../Utilities';
/* eslint-disable no-magic-numbers */

/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const fixtureData = [
  ['name', 'gender', 'colour', 'birthday', 'trials', 'successes'],
  ['Nick', 'male', 'blue', '1982-11-07', 103, 12],
  ['Jane', 'female', 'red', '1982-11-08', 95, 25],
  ['John', 'male', 'blue', '1982-12-08', 112, 30],
  ['Carol', 'female', 'yellow', '1983-12-08', 102, 14],
];

const aggregationConfig = (aggregatorName, vals = [], key) => ({
  key: key || `${aggregatorName}-${vals.length ? vals.join('|') : 'none'}`,
  aggregatorName,
  vals,
});

describe('  utils', function () {
  describe('.PivotData()', function () {
    describe('with no options', function () {
      const aoaInput = [['a', 'b'], [1, 2], [3, 4]];
      const pd = new utils.PivotData({ data: aoaInput });

      it('has the correct grand total value', () =>
        expect(pd.getAggregator([], []).value()).toBe(2));
    });

    describe('with array-of-array input', function () {
      const aoaInput = [['a', 'b'], [1, 2], [3, 4]];
      const pd = new utils.PivotData({
        data: aoaInput,
        aggregations: [aggregationConfig('Sum over Sum', ['a', 'b'])],
      });

      it('has the correct grand total value', () =>
        expect(pd.getAggregator([], []).value()).toBe((1 + 3) / (2 + 4)));
    });

    describe('with array-of-object input', function () {
      const aosInput = [{ a: 1, b: 2 }, { a: 3, b: 4 }];
      const pd = new utils.PivotData({
        data: aosInput,
        aggregations: [aggregationConfig('Sum over Sum', ['a', 'b'])],
      });

      it('has the correct grand total value', () =>
        expect(pd.getAggregator([], []).value()).toBe((1 + 3) / (2 + 4)));
    });

    describe('with ragged array-of-object input', function () {
      const raggedAosInput = [{ a: 1 }, { b: 4 }, { a: 3, b: 2 }];
      const pd = new utils.PivotData({
        data: raggedAosInput,
        aggregations: [aggregationConfig('Sum over Sum', ['a', 'b'])],
      });

      it('has the correct grand total value', () =>
        expect(pd.getAggregator([], []).value()).toBe((1 + 3) / (2 + 4)));
    });

    describe('with function input', function () {
      const functionInput = function (record) {
        record({ a: 1, b: 2 });
        record({ a: 3, b: 4 });
      };
      const pd = new utils.PivotData({
        data: functionInput,
        aggregations: [aggregationConfig('Sum over Sum', ['a', 'b'])],
      });

      it('has the correct grand total value', () =>
        expect(pd.getAggregator([], []).value()).toBe((1 + 3) / (2 + 4)));
    });

    describe('with rows/cols', function () {
      const pd = new utils.PivotData({
        data: fixtureData,
        rows: ['name', 'colour'],
        cols: ['trials', 'successes'],
      });

      it('has correctly-ordered row keys', () =>
        expect(pd.getRowKeys()).toEqual([
          ['Carol', 'yellow'],
          ['Jane', 'red'],
          ['John', 'blue'],
          ['Nick', 'blue'],
        ]));

      it('has correctly-ordered col keys', () =>
        expect(pd.getColKeys()).toEqual([
          [95, 25],
          [102, 14],
          [103, 12],
          [112, 30],
        ]));

      it('can be iterated over', function () {
        let numNotNull = 0;
        let numNull = 0;
        for (const r of Array.from(pd.getRowKeys())) {
          for (const c of Array.from(pd.getColKeys())) {
            if (pd.getAggregator(r, c).value() !== null) {
              numNotNull++;
            } else {
              numNull++;
            }
          }
        }
        expect(numNotNull).toBe(4);
        expect(numNull).toBe(12);
      });

      it('returns matching records', function () {
        const records = [];
        pd.forEachMatchingRecord({ gender: 'male' }, x => records.push(x.name));
        expect(records).toEqual(['Nick', 'John']);
      });

      it('has a correct spot-checked aggregator', function () {
        const agg = pd.getAggregator(['Carol', 'yellow'], [102, 14]);
        const val = agg.value();
        expect(val).toBe(1);
        expect(agg.format(val)).toBe('1');
      });

      it('has a correct grand total aggregator', function () {
        const agg = pd.getAggregator([], []);
        const val = agg.value();
        expect(val).toBe(4);
        expect(agg.format(val)).toBe('4');
      });
    });

    describe('with multiple aggregators selected', function () {
      const pd = new utils.PivotData({
        data: fixtureData,
        rows: ['gender'],
        aggregators: utils.aggregators,
        aggregations: [
          { key: 'count-gender', aggregatorName: 'Count' },
          { key: 'sum-trials', aggregatorName: 'Sum', vals: ['trials'] },
        ],
      });

      it('lists all active aggregators', function () {
        expect(pd.getAggregatorNames()).toEqual(['Count', 'Sum']);
      });

      it('defaults to the primary aggregator when none specified', function () {
        expect(pd.getAggregator(['female'], []).value()).toBe(2);
      });

      it('can retrieve a specific aggregator by key', function () {
        expect(pd.getAggregator(['female'], [], 'sum-trials').value()).toBe(197);
      });

      it('falls back to aggregator names for backwards compatibility', function () {
        expect(pd.getAggregator(['female'], [], 'Sum').value()).toBe(197);
      });

      it('adds a default aggregation when none are supplied', function () {
        const alt = new utils.PivotData({
          data: fixtureData,
          rows: ['gender'],
          aggregators: utils.aggregators,
        });
        expect(alt.getAggregations().length).toBe(1);
        const expectedPrimary = Object.keys(utils.aggregators)[0];
        expect(alt.getAggregatorNames()).toEqual([expectedPrimary]);
        expect(alt.getPrimaryAggregation().aggregatorName).toBe(expectedPrimary);
      });

      it('respects legacy aggregatorName/vals when aggregations are omitted', function () {
        const alt = new utils.PivotData({
          data: fixtureData,
          rows: ['gender'],
          aggregators: utils.aggregators,
          aggregatorName: 'Sum',
          vals: ['trials'],
        });
        expect(alt.getAggregations()[0]).toEqual(
          expect.objectContaining({
            aggregatorName: 'Sum',
            vals: ['trials'],
          })
        );
      });

      it('ignores legacy aggregatorName/vals when aggregations are supplied', function () {
        const alt = new utils.PivotData({
          data: fixtureData,
          rows: ['gender'],
          aggregators: utils.aggregators,
          aggregatorName: 'Sum',
          vals: ['trials'],
          aggregations: [{ key: 'count-only', aggregatorName: 'Count' }],
        });
        expect(alt.getPrimaryAggregation().aggregatorName).toBe('Count');
        expect(alt.getPrimaryAggregation().vals).toEqual([]);
      });
    });
  });

  describe('.aggregatorTemplates', function () {
    const getVal = (agg, vals) => {
      return new utils.PivotData({
        data: fixtureData,
        aggregators: { agg },
        aggregations: [aggregationConfig('agg', vals)],
      })
        .getAggregator([], [])
        .value();
    };
    const tpl = utils.aggregatorTemplates;

    describe('.count', () =>
      it('works', () => expect(getVal(tpl.count(), [])).toBe(4)));

    describe('.countUnique', () =>
      it('works', () => expect(getVal(tpl.countUnique(), ['gender'])).toBe(2)));

    describe('.listUnique', () =>
      it('works', () =>
        expect(getVal(tpl.listUnique(), ['gender'])).toBe('male,female')));

    describe('.average', () =>
      it('works', () => expect(getVal(tpl.average(), ['trials'])).toBe(103)));

    describe('.sum', () =>
      it('works', () => expect(getVal(tpl.sum(), ['trials'])).toBe(412)));

    describe('.min', () =>
      it('works', () => expect(getVal(tpl.min(), ['trials'])).toBe(95)));

    describe('.max', () =>
      it('works', () => expect(getVal(tpl.max(), ['trials'])).toBe(112)));

    describe('.first', () =>
      it('works', () => expect(getVal(tpl.first(), ['name'])).toBe('Carol')));

    describe('.last', () =>
      it('works', () => expect(getVal(tpl.last(), ['name'])).toBe('Nick')));

    describe('.average', () =>
      it('works', () => expect(getVal(tpl.average(), ['trials'])).toBe(103)));

    describe('.median', () =>
      it('works', () => expect(getVal(tpl.median(), ['trials'])).toBe(102.5)));

    describe('.quantile', () =>
      it('works', function () {
        expect(getVal(tpl.quantile(0), ['trials'])).toBe(95);
        expect(getVal(tpl.quantile(0.1), ['trials'])).toBe(98.5);
        expect(getVal(tpl.quantile(0.25), ['trials'])).toBe(98.5);
        expect(getVal(tpl.quantile(1 / 3), ['trials'])).toBe(102);
        expect(getVal(tpl.quantile(1), ['trials'])).toBe(112);
      }));

    describe('.var', () =>
      it('works', () =>
        expect(getVal(tpl.var(), ['trials'])).toBe(48.666666666666686)));

    describe('.stdev', () =>
      it('works', () =>
        expect(getVal(tpl.stdev(), ['trials'])).toBe(6.976149845485451)));

    describe('.sumOverSum', () =>
      it('works', () =>
        expect(getVal(tpl.sumOverSum(), ['successes', 'trials'])).toBe(
          (12 + 25 + 30 + 14) / (95 + 102 + 103 + 112)
        )));

    describe('.fractionOf', () =>
      it('works', () =>
        expect(getVal(tpl.fractionOf(tpl.sum()), ['trials'])).toBe(1)));
  });

  describe('.naturalSort()', function () {
    const { naturalSort } = utils;

    const sortedArr = [
      null,
      NaN,
      -Infinity,
      '-Infinity',
      -3,
      '-3',
      -2,
      '-2',
      -1,
      '-1',
      0,
      '2e-1',
      1,
      '01',
      '1',
      2,
      '002',
      '002e0',
      '02',
      '2',
      '2e-0',
      3,
      10,
      '10',
      '11',
      '12',
      '1e2',
      '112',
      Infinity,
      'Infinity',
      '1a',
      '2a',
      '12a',
      '20a',
      'A',
      'A',
      'NaN',
      'a',
      'a',
      'a01',
      'a012',
      'a02',
      'a1',
      'a2',
      'a12',
      'a12',
      'a21',
      'a21',
      'b',
      'c',
      'd',
      'null',
    ];

    it('sorts naturally (null, NaN, numbers & numbery strings, Alphanum for text strings)', () =>
      expect(sortedArr.slice().sort(naturalSort)).toEqual(sortedArr));
  });

  describe('.sortAs()', function () {
    const { sortAs } = utils;

    it('sorts with unknown values sorted at the end', () =>
      expect([5, 2, 3, 4, 1].sort(sortAs([4, 3, 2]))).toEqual([4, 3, 2, 1, 5]));

    it('sorts lowercase after uppercase', () =>
      expect(['Ab', 'aA', 'aa', 'ab'].sort(sortAs(['Ab', 'Aa']))).toEqual([
        'Ab',
        'ab',
        'aa',
        'aA',
      ]));
  });

  describe('.numberFormat()', function () {
    const { numberFormat } = utils;

    it('formats numbers', function () {
      const nf = numberFormat();
      expect(nf(1234567.89123456)).toEqual('1,234,567.89');
    });

    it('formats booleans', function () {
      const nf = numberFormat();
      expect(nf(true)).toEqual('1.00');
    });

    it('formats numbers in strings', function () {
      const nf = numberFormat();
      expect(nf('1234567.89123456')).toEqual('1,234,567.89');
    });

    it("doesn't formats strings", function () {
      const nf = numberFormat();
      expect(nf('hi there')).toEqual('');
    });

    it("doesn't formats objects", function () {
      const nf = numberFormat();
      expect(nf({ a: 1 })).toEqual('');
    });

    it('formats percentages', function () {
      const nf = numberFormat({ scaler: 100, suffix: '%' });
      expect(nf(0.12345)).toEqual('12.35%');
    });

    it('adds separators', function () {
      const nf = numberFormat({ thousandsSep: 'a', decimalSep: 'b' });
      expect(nf(1234567.89123456)).toEqual('1a234a567b89');
    });

    it('adds prefixes and suffixes', function () {
      const nf = numberFormat({ prefix: 'a', suffix: 'b' });
      expect(nf(1234567.89123456)).toEqual('a1,234,567.89b');
    });

    it('scales and rounds', function () {
      const nf = numberFormat({ digitsAfterDecimal: 3, scaler: 1000 });
      expect(nf(1234567.89123456)).toEqual('1,234,567,891.235');
    });
  });

  describe('.derivers', function () {
    describe('.dateFormat()', function () {
      const df = utils.derivers.dateFormat(
        'x',
        'abc % %% %%% %a %y %m %n %d %w %x %H %M %S',
        true
      );

      it('formats date objects', () =>
        expect(df({ x: new Date('2015-01-02T23:43:11Z') })).toBe(
          'abc % %% %%% %a 2015 01 Jan 02 Fri 5 23 43 11'
        ));

      it('formats input parsed by Date.parse()', function () {
        expect(df({ x: '2015-01-02T23:43:11Z' })).toBe(
          'abc % %% %%% %a 2015 01 Jan 02 Fri 5 23 43 11'
        );

        expect(df({ x: 'bla' })).toBe('');
      });
    });

    describe('.bin()', function () {
      const binner = utils.derivers.bin('x', 10);

      it('bins numbers', function () {
        expect(binner({ x: 11 })).toBe(10);

        expect(binner({ x: 9 })).toBe(0);

        expect(binner({ x: 111 })).toBe(110);
      });

      it('bins booleans', () => expect(binner({ x: true })).toBe(0));

      it('bins negative numbers', () => expect(binner({ x: -12 })).toBe(-10));

      it("doesn't bin strings", () => expect(binner({ x: 'a' })).toBeNaN());

      it("doesn't bin objects", () => expect(binner({ x: { a: 1 } })).toBeNaN());
    });
  });

  describe('aggregation grouping', function () {
    describe('.groupAggregationsByType()', function () {
      it('returns object with default Count aggregation when no aggregations provided', function () {
        // Note: PivotData normalizes empty aggregations to a default Count
        const pd = new utils.PivotData({
          data: fixtureData,
          aggregations: [],
        });
        const grouped = pd.groupAggregationsByType();

        expect(Object.keys(grouped)).toEqual(['Count']);
        expect(grouped['Count']).toHaveLength(1);
      });

      it('groups aggregations by aggregatorName', function () {
        const aggregations = [
          aggregationConfig('Count', ['name'], 'count-name'),
          aggregationConfig('Count', ['gender'], 'count-gender'),
          aggregationConfig('Sum', ['trials'], 'sum-trials'),
        ];
        const pd = new utils.PivotData({
          data: fixtureData,
          aggregations,
        });
        const grouped = pd.groupAggregationsByType();

        expect(Object.keys(grouped)).toEqual(['Count', 'Sum']);
        expect(grouped['Count']).toHaveLength(2);
        expect(grouped['Sum']).toHaveLength(1);
        expect(grouped['Count'][0].key).toBe('count-name');
        expect(grouped['Count'][1].key).toBe('count-gender');
        expect(grouped['Sum'][0].key).toBe('sum-trials');
      });

      it('handles single aggregation', function () {
        const aggregations = [
          aggregationConfig('Count', ['name'], 'count-name'),
        ];
        const pd = new utils.PivotData({
          data: fixtureData,
          aggregations,
        });
        const grouped = pd.groupAggregationsByType();

        expect(Object.keys(grouped)).toEqual(['Count']);
        expect(grouped['Count']).toHaveLength(1);
        expect(grouped['Count'][0].key).toBe('count-name');
      });

      it('handles multiple different aggregator types', function () {
        const aggregations = [
          aggregationConfig('Count', ['name'], 'count-name'),
          aggregationConfig('Sum', ['trials'], 'sum-trials'),
          aggregationConfig('Average', ['successes'], 'avg-successes'),
        ];
        const pd = new utils.PivotData({
          data: fixtureData,
          aggregations,
        });
        const grouped = pd.groupAggregationsByType();

        expect(Object.keys(grouped)).toEqual(['Count', 'Sum', 'Average']);
        expect(grouped['Count']).toHaveLength(1);
        expect(grouped['Sum']).toHaveLength(1);
        expect(grouped['Average']).toHaveLength(1);
      });
    });

    describe('.getAggregationsByType()', function () {
      it('returns aggregations for specific aggregator type', function () {
        const aggregations = [
          aggregationConfig('Count', ['name'], 'count-name'),
          aggregationConfig('Count', ['gender'], 'count-gender'),
          aggregationConfig('Sum', ['trials'], 'sum-trials'),
        ];
        const pd = new utils.PivotData({
          data: fixtureData,
          aggregations,
        });
        const countAggs = pd.getAggregationsByType('Count');
        const sumAggs = pd.getAggregationsByType('Sum');

        expect(countAggs).toHaveLength(2);
        expect(countAggs.every(agg => agg.aggregatorName === 'Count')).toBe(true);
        expect(sumAggs).toHaveLength(1);
        expect(sumAggs[0].aggregatorName).toBe('Sum');
      });

      it('returns empty array for non-existent aggregator type', function () {
        const aggregations = [
          aggregationConfig('Count', ['name'], 'count-name'),
        ];
        const pd = new utils.PivotData({
          data: fixtureData,
          aggregations,
        });
        const sumAggs = pd.getAggregationsByType('Sum');

        expect(sumAggs).toEqual([]);
      });
    });
  });
});
