import React from 'react';
import PropTypes from 'prop-types';
import {PivotData} from './Utilities';

// helper function for setting row/col-span in pivotTableRenderer
const spanSize = function(arr, i, j) {
  let x;
  if (i !== 0) {
    let asc, end;
    let noDraw = true;
    for (
      x = 0, end = j, asc = end >= 0;
      asc ? x <= end : x >= end;
      asc ? x++ : x--
    ) {
      if (arr[i - 1][x] !== arr[i][x]) {
        noDraw = false;
      }
    }
    if (noDraw) {
      return -1;
    }
  }
  let len = 0;
  while (i + len < arr.length) {
    let asc1, end1;
    let stop = false;
    for (
      x = 0, end1 = j, asc1 = end1 >= 0;
      asc1 ? x <= end1 : x >= end1;
      asc1 ? x++ : x--
    ) {
      if (arr[i][x] !== arr[i + len][x]) {
        stop = true;
      }
    }
    if (stop) {
      break;
    }
    len++;
  }
  return len;
};

function redColorScaleGenerator(values) {
  const min = Math.min.apply(Math, values);
  const max = Math.max.apply(Math, values);
  return x => {
    // eslint-disable-next-line no-magic-numbers
    const nonRed = 255 - Math.round((255 * (x - min)) / (max - min));
    return {backgroundColor: `rgb(255,${nonRed},${nonRed})`};
  };
}

function makeRenderer(opts = {}) {
  class TableRenderer extends React.PureComponent {
    render() {
      const pivotData = new PivotData(this.props);
      const colAttrs = pivotData.props.cols;
      const rowAttrs = pivotData.props.rows;
      const aggregations = pivotData.getAggregations();
      const primaryAggregation = pivotData.getPrimaryAggregation();
      const hasMultipleAggregators = aggregations.length > 1;
      const rowAttrsToRender = hasMultipleAggregators
        ? rowAttrs.concat(['Values'])
        : rowAttrs;
      const rowKeys = pivotData.getRowKeys();
      const baseRowKeys =
        hasMultipleAggregators && rowKeys.length === 0 ? [[]] : rowKeys;
      const renderedRows = hasMultipleAggregators
        ? baseRowKeys.reduce((acc, rowKey) => {
            aggregations.forEach(agg => {
              acc.push({
                displayKey: rowKey.concat([agg.label || agg.aggregatorName]),
                actualKey: rowKey,
                aggregationKey: agg.key,
              });
            });
            return acc;
          }, [])
        : baseRowKeys.map(rowKey => ({
            displayKey: rowKey,
            actualKey: rowKey,
            aggregationKey: primaryAggregation.key,
          }));
      const rowKeyValues = renderedRows.map(r => r.displayKey);
      const colKeys = pivotData.getColKeys();

      let valueCellColors = () => {};
      let rowTotalColors = () => {};
      let colTotalColors = () => {};
      if (opts.heatmapMode && !hasMultipleAggregators) {
        const colorScaleGenerator = this.props.tableColorScaleGenerator;
        const rowTotalValues = colKeys.map(x =>
          pivotData.getAggregator([], x, primaryAggregation.key).value()
        );
        rowTotalColors = colorScaleGenerator(rowTotalValues);
        const colTotalValues = rowKeys.map(x =>
          pivotData.getAggregator(x, [], primaryAggregation.key).value()
        );
        colTotalColors = colorScaleGenerator(colTotalValues);

        if (opts.heatmapMode === 'full') {
          const allValues = [];
          rowKeys.map(r =>
            colKeys.map(c =>
              allValues.push(
                pivotData.getAggregator(r, c, primaryAggregation.key).value()
              )
            )
          );
          const colorScale = colorScaleGenerator(allValues);
          valueCellColors = (r, c, v) => colorScale(v);
        } else if (opts.heatmapMode === 'row') {
          const rowColorScales = {};
          rowKeys.map(r => {
            const rowValues = colKeys.map(x =>
              pivotData.getAggregator(r, x, primaryAggregation.key).value()
            );
            rowColorScales[r] = colorScaleGenerator(rowValues);
          });
          valueCellColors = (r, c, v) => rowColorScales[r](v);
        } else if (opts.heatmapMode === 'col') {
          const colColorScales = {};
          colKeys.map(c => {
            const colValues = rowKeys.map(x =>
              pivotData.getAggregator(x, c, primaryAggregation.key).value()
            );
            colColorScales[c] = colorScaleGenerator(colValues);
          });
          valueCellColors = (r, c, v) => colColorScales[c](v);
        }
      }

      const getClickHandler =
        this.props.tableOptions && this.props.tableOptions.clickCallback
          ? (value, rowValues, colValues) => {
              const filters = {};
              for (const i of Object.keys(colAttrs || {})) {
                const attr = colAttrs[i];
                if (colValues[i] !== null) {
                  filters[attr] = colValues[i];
                }
              }
              for (const i of Object.keys(rowAttrs || {})) {
                const attr = rowAttrs[i];
                if (rowValues[i] !== null) {
                  filters[attr] = rowValues[i];
                }
              }
              return e =>
                this.props.tableOptions.clickCallback(
                  e,
                  value,
                  filters,
                  pivotData
                );
            }
          : null;

      return (
        <table className="pvtTable">
          <thead>
            {colAttrs.map(function(c, j) {
              return (
                <tr key={`colAttr${j}`}>
                  {j === 0 && rowAttrsToRender.length !== 0 && (
                    <th
                      colSpan={rowAttrsToRender.length}
                      rowSpan={colAttrs.length}
                    />
                  )}
                  <th className="pvtAxisLabel">{c}</th>
                  {colKeys.map(function(colKey, i) {
                    const x = spanSize(colKeys, i, j);
                    if (x === -1) {
                      return null;
                    }
                    return (
                      <th
                        className="pvtColLabel"
                        key={`colKey${i}`}
                        colSpan={x}
                        rowSpan={
                          j === colAttrs.length - 1 &&
                          rowAttrsToRender.length !== 0
                            ? 2
                            : 1
                        }
                      >
                        {colKey[j]}
                      </th>
                    );
                  })}

                  {j === 0 && (
                    <th
                      className="pvtTotalLabel"
                      rowSpan={
                        colAttrs.length +
                        (rowAttrsToRender.length === 0 ? 0 : 1)
                      }
                    >
                      Totals
                    </th>
                  )}
                </tr>
              );
            })}

            {rowAttrsToRender.length !== 0 && (
              <tr>
                {rowAttrsToRender.map(function(r, i) {
                  return (
                    <th className="pvtAxisLabel" key={`rowAttr${i}`}>
                      {r}
                    </th>
                  );
                })}
                <th className="pvtTotalLabel">
                  {colAttrs.length === 0 ? 'Totals' : null}
                </th>
              </tr>
            )}
          </thead>

          <tbody>
            {renderedRows.map(function(rowMeta, i) {
              const totalAggregator = pivotData.getAggregator(
                rowMeta.actualKey,
                [],
                rowMeta.aggregationKey
              );
              const displayKey = rowMeta.displayKey;
              return (
                <tr key={`rowKeyRow${i}`}>
                  {displayKey.map(function(txt, j) {
                    const x = spanSize(rowKeyValues, i, j);
                    if (x === -1) {
                      return null;
                    }
                    return (
                      <th
                        key={`rowKeyLabel${i}-${j}`}
                        className="pvtRowLabel"
                        rowSpan={x}
                        colSpan={
                          j === rowAttrsToRender.length - 1 &&
                          colAttrs.length !== 0
                            ? 2
                            : 1
                        }
                      >
                        {txt}
                      </th>
                    );
                  })}
                  {colKeys.map(function(colKey, j) {
                    const aggregator = pivotData.getAggregator(
                      rowMeta.actualKey,
                      colKey,
                      rowMeta.aggregationKey
                    );
                    const value = aggregator.value();
                    return (
                      <td
                        className="pvtVal"
                        key={`pvtVal${i}-${j}`}
                        onClick={
                          getClickHandler &&
                          getClickHandler(value, rowMeta.actualKey, colKey)
                        }
                        style={valueCellColors(
                          rowMeta.actualKey,
                          colKey,
                          value
                        )}
                      >
                        {aggregator.format(value)}
                      </td>
                    );
                  })}
                  <td
                    className="pvtTotal"
                    onClick={
                      getClickHandler &&
                      getClickHandler(
                        totalAggregator.value(),
                        rowMeta.actualKey,
                        [null]
                      )
                    }
                    style={colTotalColors(totalAggregator.value())}
                  >
                    {totalAggregator.format(totalAggregator.value())}
                  </td>
                </tr>
              );
            })}

            {(hasMultipleAggregators ? aggregations : [primaryAggregation]).map(
              function(agg) {
                const grandTotalAggregator = pivotData.getAggregator(
                  [],
                  [],
                  agg.key
                );
                const totalLabel = hasMultipleAggregators
                  ? `Totals – ${agg.label || agg.aggregatorName}`
                  : 'Totals';
                return (
                  <tr key={`totalRow-${agg.key}`}>
                    <th
                      className="pvtTotalLabel"
                      colSpan={
                        rowAttrsToRender.length +
                        (colAttrs.length === 0 ? 0 : 1)
                      }
                    >
                      {totalLabel}
                    </th>

                    {colKeys.map(function(colKey, i) {
                      const totalAggregator = pivotData.getAggregator(
                        [],
                        colKey,
                        agg.key
                      );
                      return (
                        <td
                          className="pvtTotal"
                          key={`total${agg.key}-${i}`}
                          onClick={
                            getClickHandler &&
                            getClickHandler(
                              totalAggregator.value(),
                              [null],
                              colKey
                            )
                          }
                          style={rowTotalColors(totalAggregator.value())}
                        >
                          {totalAggregator.format(totalAggregator.value())}
                        </td>
                      );
                    })}

                    <td
                      onClick={
                        getClickHandler &&
                        getClickHandler(
                          grandTotalAggregator.value(),
                          [null],
                          [null]
                        )
                      }
                      className="pvtGrandTotal"
                    >
                      {grandTotalAggregator.format(
                        grandTotalAggregator.value()
                      )}
                    </td>
                  </tr>
                );
              }
            )}
          </tbody>
        </table>
      );
    }
  }

  TableRenderer.defaultProps = PivotData.defaultProps;
  TableRenderer.propTypes = PivotData.propTypes;
  TableRenderer.defaultProps.tableColorScaleGenerator = redColorScaleGenerator;
  TableRenderer.defaultProps.tableOptions = {};
  TableRenderer.propTypes.tableColorScaleGenerator = PropTypes.func;
  TableRenderer.propTypes.tableOptions = PropTypes.object;
  return TableRenderer;
}

class TSVExportRenderer extends React.PureComponent {
  render() {
    const pivotData = new PivotData(this.props);
    const rowAttrs = pivotData.props.rows;
    const aggregations = pivotData.getAggregations();
    const hasMultipleAggregators = aggregations.length > 1;
    const rowKeys = pivotData.getRowKeys();
    const colKeys = pivotData.getColKeys();
    const safeRowKeys = rowKeys.length === 0 ? [[]] : rowKeys;
    const safeColKeys = colKeys.length === 0 ? [[]] : colKeys;

    const rowEntries = hasMultipleAggregators
      ? safeRowKeys.reduce((acc, rowKey) => {
          aggregations.forEach(agg => {
            acc.push({rowKey, aggregationKey: agg.key, label: agg.label});
          });
          return acc;
        }, [])
      : safeRowKeys.map(rowKey => ({
          rowKey,
          aggregationKey: aggregations[0].key,
          label: aggregations[0].label || aggregations[0].aggregatorName,
        }));

    const headerRow = rowAttrs.slice();
    if (hasMultipleAggregators) {
      headerRow.push('Values');
    }
    if (safeColKeys.length === 1 && safeColKeys[0].length === 0) {
      headerRow.push(
        hasMultipleAggregators
          ? 'Value'
          : aggregations[0].label || this.props.aggregatorName
      );
    } else {
      safeColKeys.map(c => headerRow.push(c.join('-')));
    }

    const result = rowEntries.map(entry => {
      const row = entry.rowKey.map(x => x);
      if (hasMultipleAggregators) {
        row.push(entry.label || '');
      }
      safeColKeys.map(colKey => {
        const v = pivotData
          .getAggregator(entry.rowKey, colKey, entry.aggregationKey)
          .value();
        row.push(v ? v : '');
      });
      return row;
    });

    result.unshift(headerRow);

    return (
      <textarea
        value={result.map(r => r.join('\t')).join('\n')}
        style={{width: window.innerWidth / 2, height: window.innerHeight / 2}}
        readOnly={true}
      />
    );
  }
}

TSVExportRenderer.defaultProps = PivotData.defaultProps;
TSVExportRenderer.propTypes = PivotData.propTypes;

export default {
  Table: makeRenderer(),
  'Table Heatmap': makeRenderer({heatmapMode: 'full'}),
  'Table Col Heatmap': makeRenderer({heatmapMode: 'col'}),
  'Table Row Heatmap': makeRenderer({heatmapMode: 'row'}),
  'Exportable TSV': TSVExportRenderer,
};
